# Crop Disease Detection

A full-stack plant disease detection system using a CNN model for disease identification.

## Project Structure

```
crop-disease/
├── crop-disease-python/     # ML Backend (Flask + Keras)
├── crop-disease-js/          # Node.js + React Native App
│   ├── backend/              # Express API server
│   └── frontend/             # React Native mobile app
└── README.md
```

## Quick Start

### 1. Python Backend (ML Server)

**Prerequisites:** Python 3.10+

```bash
cd crop-disease-python

# Create virtual environment
py -3.10 -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

The Flask server will start on `http://0.0.0.0:6000`

### 2. Node.js Backend

```bash
cd crop-disease-js/backend

# Install dependencies
npm install

# Create .env file with Gemini API key (optional)
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Run the server
npm start
```

The Node.js server will start on `http://0.0.0.0:5000`

### 3. React Native Frontend

```bash
cd crop-disease-js/frontend

# Install dependencies
npm install

# Run on device/emulator
npm start
```

## Architecture

```
[React Native App] ──► [Node.js Backend :5000] ──► [Flask ML API :6000]
                                                  │
                                             [Keras CNN Model]
                                                  │
      [Node.js Backend] ◄─── [Gemini API] ◄───────┘
      (Treatment recommendations)
```

## API Endpoints

### Flask ML API (Port 6000)
- `POST /predict` - Upload image for disease detection
- `GET /health` - Health check

### Node.js API (Port 5000)
- `POST /detect-disease` - Full detection with treatment recommendations
- `GET /health` - Health check

## Supported Crops

The model supports disease detection for 15 crops including:
- Apple, Blueberry, Cherry, Corn, Grape
- Orange, Peach, Pepper, Potato, Raspberry
- Soybean, Squash, Strawberry, Tomato

## Notes

- The ML model (`Model.hdf5`) is not included in the repository. You'll need to train or obtain a compatible model.
- Gemini API key is optional - the app works with fallback data if not provided.
- The Python backend requires Python 3.10 specifically due to TensorFlow compatibility.
