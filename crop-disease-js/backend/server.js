import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import FormData from "form-data";
import { similaritySearch, searchWeb, combineWithGroq } from "./assistant.js";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    server: "Plant Disease Detection API",
    version: "2.0.0",
    endpoints: {
      "POST /detect-disease": "Upload plant image for disease detection",
      "GET /health": "Health check endpoint"
    },
    services: {
      tavily: !!process.env.TAVILY_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
      groq: !!process.env.GROQ_API_KEY
    }
  });
});

// Main detection endpoint
app.post("/detect-disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: "No image uploaded",
        success: false 
      });
    }

    const targetLang = req.query.lang || 'en';
    console.log(`📤 Received image: ${req.file.originalname || req.file.filename}`);
    console.log(`📁 Temporary path: ${req.file.path}`);
    console.log(`🌐 Target language for web search: ${targetLang}`);

    /* ===============================
       1️⃣ Send image → Flask ML API
       =============================== */
    const formData = new FormData();
    formData.append("image", fs.createReadStream(req.file.path));

    console.log("📤 Sending image to Flask API at http://127.0.0.1:6000/predict...");
    
    const mlResponse = await axios.post(
      "http://127.0.0.1:6000/predict",
      formData,
      { 
        headers: formData.getHeaders(),
        timeout: 30000 // 30 second timeout for ML processing
      }
    );

    console.log("📥 Flask API response received successfully");
    
    // Check if Flask API returned an error
    if (!mlResponse.data.success) {
      throw new Error(`Flask API error: ${mlResponse.data.error || 'Unknown error'}`);
    }

    const { crop, disease, confidence } = mlResponse.data;
    console.log(`🌱 Detected: ${crop} - ${disease} (${(confidence * 100).toFixed(1)}%)`);

    // Get preferred language from query param (default: en)
    const lang = req.query.lang || 'en';
    console.log(`🌐 Preferred language: ${lang}`);

    // Check if plant is healthy
    const isHealthy = disease.toLowerCase().includes('healthy');

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
      console.log("🗑️ Temporary file cleaned up");
    } catch (err) {
      console.warn("⚠️ Could not delete temporary file:", err.message);
    }

    /* ===============================
       2️⃣ Get RAG info from Pinecone Assistant
       =============================== */
    const searchQuery = isHealthy 
      ? `healthy ${crop} plant care and maintenance tips`
      : `${disease} in ${crop} plants symptoms treatment prevention`;
    
    console.log("🔍 Running similarity search on Pinecone Assistant...");
    const ragResult = await similaritySearch(searchQuery);
    
    /* ===============================
       3️⃣ Search web for products and articles
       =============================== */
    const langMap = {
      'hi': 'Hindi',
      'mr': 'Marathi',
      'te': 'Telugu',
      'en': 'English'
    };
    const langName = langMap[targetLang] || 'English';
    
    const webQuery = isHealthy 
      ? `best fertilizers growth promoters for ${crop} plants ${langName} Amazon Flipkart India`
      : `best fungicides treatments for ${disease} in ${crop} plants ${langName} Amazon Flipkart India`;
    
    console.log("🔍 Searching web for products and articles...");
    const webResults = await searchWeb(webQuery);
    
    let searchResults = { products: [], articles: [] };
    if (webResults && webResults.length > 0) {
      searchResults.products = webResults
        .filter(r => r.url?.includes('amazon') || r.url?.includes('flipkart') || r.url?.includes('bighaat'))
        .slice(0, 5)
        .map(r => ({ title: r.title, url: r.url }));
      
      searchResults.articles = webResults
        .filter(r => !r.url?.includes('amazon') && !r.url?.includes('flipkart'))
        .slice(0, 3)
        .map(r => ({ title: r.title, url: r.url }));
    }
    
    /* ===============================
       4️⃣ Combine RAG + Web results using Groq
       =============================== */
    console.log("🤖 Combining results with Groq Llama...");
    const combinedResult = await combineWithGroq(
      ragResult.content,
      webResults,
      crop,
      disease,
      isHealthy,
      lang
    );
    
    /* ===============================
       5️⃣ Final response to app
       =============================== */
    const response = {
      success: true,
      crop,
      disease,
      confidence,
      isHealthy,
      lang,
      ...combinedResult,
      timestamp: new Date().toISOString()
    };

    console.log("✅ Request completed successfully");
    res.json(response);

  } catch (error) {
    console.error("❌ Error in /detect-disease endpoint:");
    console.error("Message:", error.message);
    
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    } else if (error.request) {
      console.error("No response received. Flask API might be down or unreachable.");
      console.error("Make sure Flask is running on http://127.0.0.1:6000");
    } else {
      console.error("Request setup error:", error.message);
    }
    
    // Clean up uploaded file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Cleaned up temporary file after error");
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: "Detection failed",
      details: error.message,
      suggestion: "Please check if the Flask ML server is running on port 6000"
    });
  }
});

// Fallback data function
function getFallbackData(crop, disease, isHealthy) {
  if (isHealthy) {
    return {
      description: `Your ${crop} plant is healthy! Continue with regular care and monitoring.`,
      growth_tips: [
        "Ensure adequate sunlight exposure",
        "Water regularly but avoid overwatering",
        "Use balanced fertilizer every 2-3 weeks",
        "Prune regularly to promote growth",
        "Monitor for pests and diseases"
      ],
      recommended_products: [
        {
          title: "Organic Plant Growth Promoter",
          url: "https://www.amazon.com/s?k=plant+growth+promoter+organic"
        },
        {
          title: "Balanced NPK Fertilizer",
          url: "https://www.flipkart.com/search?q=npk+fertilizer+for+plants"
        },
        {
          title: "Soil Moisture Meter",
          url: "https://www.bighaat.com/collections/soil-testing-meters"
        }
      ],
      articles: [
        {
          title: `Best Practices for ${crop} Cultivation`,
          url: "https://www.agritechtoday.com/cultivation-guides/"
        },
        {
          title: "Organic Farming Techniques",
          url: "https://www.krishijagran.com/organic-farming/"
        },
        {
          title: "Water Management in Agriculture",
          url: "https://www.fao.org/water-management/en/"
        }
      ]
    };
  } else {
    return {
      description: `${disease} has been detected in your ${crop} plant. Immediate action is recommended to prevent spread.`,
      prevention: [
        "Remove and destroy affected leaves",
        "Improve air circulation around plants",
        "Avoid overhead watering to reduce moisture",
        "Apply appropriate fungicide/pesticide",
        "Rotate crops to prevent recurrence"
      ],
      recommended_products: [
        {
          title: "Copper Fungicide for Plant Diseases",
          url: "https://www.amazon.com/s?k=copper+fungicide+for+plants"
        },
        {
          title: "Neem Oil Organic Pesticide",
          url: "https://www.flipkart.com/search?q=neem+oil+for+plants"
        },
        {
          title: "Disease Control Spray Kit",
          url: "https://www.agrostar.in/category/plant-protection"
        }
      ],
      articles: [
        {
          title: `How to Treat ${disease} in ${crop}`,
          url: "https://www.plantdiseasehandbook.com/treatments"
        },
        {
          title: "Integrated Pest Management Guide",
          url: "https://www.ipmguides.org/common-plant-diseases"
        },
        {
          title: "Organic Disease Control Methods",
          url: "https://www.rodalesinstitute.org/organic-pest-control/"
        }
      ]
    };
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("🚨 Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    available_endpoints: [
      "POST /detect-disease",
      "GET /health"
    ]
  });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("📁 Created uploads directory");
}

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Node.js Server running on http://${HOST}:${PORT}`);
  console.log(`🔍 Health check: http://${HOST}:${PORT}/health`);
  console.log(`📤 Upload endpoint: POST http://${HOST}:${PORT}/detect-disease`);
  console.log(`🔍 Tavily Search: ${process.env.TAVILY_API_KEY ? "Configured" : "Not configured (using fallback)"}`);
  console.log(`🧠 Pinecone RAG: ${process.env.PINECONE_API_KEY ? "Configured" : "Not configured"}`);
  console.log(`🤖 Groq Combine: ${process.env.GROQ_API_KEY ? "Configured" : "Not configured (using fallback)"}`);
  console.log(`🌱 Make sure Flask ML API is running on http://127.0.0.1:6000`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});