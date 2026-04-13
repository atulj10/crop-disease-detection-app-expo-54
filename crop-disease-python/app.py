from __future__ import division, print_function
import sys
import os
import glob
import re
import numpy as np
import json

# Keras
from keras.models import load_model
from keras.preprocessing import image

# Flask utils
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
import base64

# Define a flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

MODEL_PATH = 'Model.hdf5'

# Load your trained model
print(" ** Model Loading **")
model = load_model(MODEL_PATH)
print(" ** Model Loaded **")
model._make_predict_function()

# Create uploads directory if it doesn't exist
if not os.path.exists('uploads'):
    os.makedirs('uploads')

# Disease classes
CLASSES = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy',
    'Grape___Black_rot', 'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy', 'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot',
    'Peach___healthy', 'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy',
    'Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy',
    'Raspberry___healthy', 'Soybean___healthy', 'Squash___Powdery_mildew',
    'Strawberry___Leaf_scorch', 'Strawberry___healthy',
    'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight',
    'Tomato___Leaf_Mold', 'Tomato___Septoria_leaf_spot',
    'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus',
    'Tomato___healthy'
]

def model_predict(img_path, model):
    """
    Make prediction on an image
    
    Args:
        img_path (str): Path to the image file
        model: Loaded Keras model
    
    Returns:
        tuple: (crop_name, disease_name, confidence)
    """
    try:
        img = image.load_img(img_path, target_size=(224, 224))

        # Preprocessing the image
        x = image.img_to_array(img)
        x = np.expand_dims(x, axis=0)
        x = x / 255.0  # Normalize

        # Make prediction
        preds = model.predict(x, verbose=0)
        preds_flat = preds.flatten()
        
        # Get the index of highest probability
        max_idx = np.argmax(preds_flat)
        confidence = float(preds_flat[max_idx])
        
        # Get class name
        class_name = CLASSES[max_idx]
        crop_name, disease_name = class_name.split('___')
        
        # Clean up disease name
        disease_name = disease_name.replace('_', ' ').title()
        
        # If it's healthy, format nicely
        if disease_name.lower() == 'healthy':
            disease_name = 'Healthy'
        
        return crop_name, disease_name, confidence
        
    except Exception as e:
        print(f"Error in prediction: {e}")
        return None, None, 0.0

@app.route('/predict', methods=['POST'])
def predict():
    """
    Endpoint for plant disease prediction
    Accepts image file in form data with key 'image'
    
    Returns:
        JSON response with prediction results
    """
    try:
        # Check if image is in the request
        if 'image' not in request.files:
            return jsonify({
                'error': 'No image provided',
                'success': False
            }), 400
        
        file = request.files['image']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({
                'error': 'No image selected',
                'success': False
            }), 400
        
        # Save the file
        filename = secure_filename(file.filename)
        filepath = os.path.join('uploads', filename)
        file.save(filepath)
        
        print(f"Processing image: {filename}")
        
        # Make prediction
        crop, disease, confidence = model_predict(filepath, model)
        
        if crop is None:
            return jsonify({
                'error': 'Failed to process image',
                'success': False
            }), 500
        
        # Clean up the uploaded file
        try:
            os.remove(filepath)
        except:
            pass
        
        # Prepare response
        response = {
            'success': True,
            'crop': crop,
            'disease': disease,
            'confidence': confidence,
            'message': f'Detected {disease} in {crop} with {confidence:.2%} confidence'
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error in /predict endpoint: {e}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    """
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'classes_available': len(CLASSES)
    })

@app.route('/', methods=['GET'])
def index():
    """
    Root endpoint - provides API info
    """
    return jsonify({
        'name': 'Plant Disease Detection API',
        'version': '1.0',
        'endpoints': {
            'POST /predict': 'Upload an image for disease detection',
            'GET /health': 'Health check endpoint'
        },
        'supported_classes': len(CLASSES)
    })

if __name__ == '__main__':
    # Run on port 6000 as specified in your Node.js server
    app.run(host='0.0.0.0', port=6000, debug=False)