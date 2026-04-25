import dotenv from "dotenv";
import axios from "axios";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const ASSISTANT_NAME = "crop-disease";

async function similaritySearch(query) {
  if (!process.env.PINECONE_API_KEY) {
    console.warn("⚠️ Pinecone API key not configured");
    return { success: false, content: null, error: "Pinecone not configured" };
  }

  try {
    console.log(`🔍 [Pinecone] Searching for: "${query}"`);
    const assistant = pc.assistant({ name: ASSISTANT_NAME });
    
    const response = await assistant.chat({
      messages: [{ role: "user", content: query }],
      model: "gemini-2.5-pro",
    });

    console.log(`✅ [Pinecone] Search completed`);
    console.log(`📋 [Pinecone] Response:`, JSON.stringify(response, null, 2));

    return {
      success: true,
      content: response,
      error: null
    };
  } catch (error) {
    console.error("❌ [Pinecone] Search failed:", error.message);
    console.error("📋 [Pinecone] Error details:", error.response?.data || error);
    return { success: false, content: null, error: error.message };
  }
}

async function searchWeb(query) {
  if (!process.env.TAVILY_API_KEY) {
    console.warn("⚠️ [Tavily] API key not configured");
    return null;
  }

  try {
    console.log(`🔍 [Tavily] Searching web for: "${query}"`);
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 5
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000
      }
    );
    const results = response.data.results || [];
    console.log(`✅ [Tavily] Found ${results.length} results`);
    
    // Filter out Amazon links, keep Flipkart, local agricultural sites, and educational resources
    const filteredResults = results.filter(r => 
      !r.url?.includes('amazon') && 
      !r.url?.includes('amazon.')
    );
    
    console.log(`📋 [Tavily] Filtered Results (excluding Amazon):`, JSON.stringify(filteredResults, null, 2));
    return filteredResults;
  } catch (error) {
    console.warn("⚠️ [Tavily] Search failed:", error.message);
    return null;
  }
}

async function combineWithGroq(ragContent, webResults, crop, disease, isHealthy, lang = 'en') {
  if (!process.env.GROQ_API_KEY) {
    console.warn("⚠️ [Groq] API key not configured, using fallback combination");
    return fallbackCombine(ragContent, webResults, crop, disease, isHealthy, lang);
  }

  if (!process.env.GROQ_API_KEY.startsWith("gsk_")) {
    console.warn("⚠️ [Groq] Invalid API key format (should start with 'gsk_'). Get a free key at https://console.groq.com/");
    return fallbackCombine(ragContent, webResults, crop, disease, isHealthy, lang);
  }

  const langNames = {
    en: 'English', hi: 'Hindi', mr: 'Marathi', te: 'Telugu'
  };
  const langName = langNames[lang] || 'English';

  try {
    const ragText = ragContent 
      ? (typeof ragContent === 'string' ? ragContent : JSON.stringify(ragContent, null, 2))
      : "No RAG content available";
    
    const webText = webResults?.length > 0
      ? webResults.map(r => `- ${r.title}: ${r.url}`).join("\n")
      : "No web search results available";

    const diseaseContext = isHealthy
      ? "The plant is healthy. Provide general care tips and growth recommendations."
      : `${disease} has been detected. Provide treatment, prevention, and control measures.`;

    const prompt = `You are an agricultural expert helping farmers with crop disease diagnosis and treatment.

DETECTION RESULT:
- Crop: ${crop}
- Disease: ${disease}
- Status: ${diseaseContext}

RAG KNOWLEDGE BASE INFO:
${ragText}

WEB SEARCH RESULTS:
${webText}

TASK: Combine the RAG knowledge and web search results into a comprehensive response in ${langName} language (lang code: ${lang}):
1. description - Brief explanation of the condition (2-3 sentences)
2. treatment - Specific treatment steps (if diseased) or care tips (if healthy)
3. prevention - Prevention measures to avoid spread or recurrence
4. recommended_products - 3 specific product recommendations with purchase links from Flipkart, local agricultural stores, or plant care websites (AVOID Amazon)
5. articles - 2-3 educational resources for further reading in ${langName}

IMPORTANT:
- Respond ALL content in ${langName}
- Do NOT include Amazon links in recommended_products
- Use Flipkart, local agricultural websites, or plant care e-commerce sites instead

Return ONLY valid JSON in this exact format, no markdown or explanations:
{
  "description": "string (in ${langName})",
  "treatment": ["string", "string", "string"] (all in ${langName}),
  "prevention": ["string", "string", "string"] (all in ${langName}),
  "recommended_products": [{"title": "string", "url": "string"}] (AVOID Amazon links),
  "articles": [{"title": "string", "url": "string"}] (in ${langName})
}`;

    console.log(`🤖 [Groq] Sending request to Llama 3.1...`);

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful agricultural expert. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    console.log(`✅ [Groq] Response received`);
    console.log(`📋 [Groq] Raw response:`, content);

    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`📋 [Groq] Parsed result:`, JSON.stringify(parsed, null, 2));
        return parsed;
      }
    }

    console.warn("⚠️ [Groq] Could not parse response, using fallback");
    return fallbackCombine(ragContent, webResults, crop, disease, isHealthy);

  } catch (error) {
    console.error("❌ [Groq] Request failed:", error.message);
    if (error.response) {
      console.error("📋 [Groq] Status:", error.response.status);
      console.error("📋 [Groq] Response:", error.response.data);
    }
    return fallbackCombine(ragContent, webResults, crop, disease, isHealthy);
  }
}

function fallbackCombine(ragContent, webResults, crop, disease, isHealthy, lang = 'en') {
  if (isHealthy) {
    return {
      description: `Your ${crop} plant appears to be healthy! Continue with regular care and monitoring to maintain plant health.`,
      treatment: [
        "Continue regular watering schedule",
        "Ensure adequate sunlight exposure",
        "Apply balanced fertilizer every 2-3 weeks",
        "Monitor for any unusual leaf discoloration",
        "Prune dead or damaged branches regularly"
      ],
      prevention: [
        "Maintain proper spacing between plants",
        "Ensure good air circulation",
        "Water at the base to avoid leaf wetness",
        "Remove weeds promptly",
        "Rotate crops if planting new seasons"
      ],
      recommended_products: [
        { title: "Organic Plant Growth Promoter", url: "https://www.flipkart.com/search?q=plant+growth+promoter+organic" },
        { title: "Balanced NPK Fertilizer", url: "https://www.flipkart.com/search?q=npk+fertilizer+for+plants" },
        { title: "Soil Moisture Meter", url: "https://www.bighaat.com/collections/soil-testing-meters" }
      ],
      articles: [
        { title: `Best Practices for ${crop} Cultivation`, url: "https://www.agritechtoday.com/cultivation-guides/" },
        { title: "Organic Farming Techniques", url: "https://www.krishijagran.com/organic-farming/" },
        { title: "Water Management in Agriculture", url: "https://www.fao.org/water-management/en/" }
      ]
    };
  } else {
    return {
      description: `${disease} has been detected in your ${crop} plant. This is a common fungal/bacterial infection that requires immediate attention to prevent spread to other plants.`,
      treatment: [
        "Remove and destroy affected leaves immediately",
        "Apply appropriate fungicide or bactericide",
        "Improve air circulation around plants",
        "Reduce leaf wetness by watering at base",
        "Isolate affected plants if possible"
      ],
      prevention: [
        "Avoid overhead watering",
        "Maintain proper plant spacing",
        "Use resistant varieties when available",
        "Practice crop rotation",
        "Sanitize tools between plants"
      ],
      recommended_products: [
        { title: "Copper Fungicide for Plant Diseases", url: "https://www.flipkart.com/search?q=copper+fungicide+for+plants" },
        { title: "Neem Oil Organic Pesticide", url: "https://www.flipkart.com/search?q=neem+oil+organic+pesticide" },
        { title: "Disease Control Spray Kit", url: "https://www.agrostar.in/category/plant-protection" }
      ],
      articles: [
        { title: `How to Treat ${disease} in ${crop}`, url: "https://www.plantdiseasehandbook.com/treatments" },
        { title: "Integrated Pest Management Guide", url: "https://www.ipmguides.org/common-plant-diseases" },
        { title: "Organic Disease Control Methods", url: "https://www.rodalesinstitute.org/organic-pest-control/" }
      ]
    };
  }
}

export { similaritySearch, searchWeb, combineWithGroq };