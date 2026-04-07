import os
import json
import logging
from io import BytesIO
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import openai
import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables
load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [VoiceService] %(message)s')
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)
CORS(app)

# OpenAI - Lee desde .env
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    logger.error("❌ OPENAI_API_KEY no configurada. Crea un archivo .env con tu clave.")
else:
    logger.info("✅ OpenAI API key configurada")

# Firebase
try:
    firebase_cred = credentials.Certificate('firebase-key.json')
    firebase_admin.initialize_app(firebase_cred)
    db = firestore.client()
    logger.info("✅ Firebase inicializado")
except Exception as e:
    logger.error(f"❌ Firebase error: {e}")
    db = None

# Categorías
CATEGORIES = {
    'burgers': 'hamburguesas',
    'pizza': 'pizzas',
    'tacos': 'tacos',
    'sushi': 'sushi',
    'pasta': 'pastas',
    'chicken': 'pollo',
    'salads': 'ensaladas',
    'desserts': 'postres',
    'breakfast': 'desayuno',
    'drinks': 'bebidas',
}

def transcribe_audio(audio_bytes):
    """Transcribe audio using OpenAI Whisper"""
    try:
        logger.info("🎙️ Transcribiendo con Whisper...")
        audio_file = BytesIO(audio_bytes)
        audio_file.name = "audio.wav"
        
        transcript = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file,
            language="es"
        )
        
        text = transcript.get('text', '').strip()
        logger.info(f"✅ Transcripción: {text}")
        return text, 0.9
    except Exception as e:
        logger.error(f"❌ Error transcribiendo: {e}")
        raise

def extract_dish_info(transcript):
    """Extract dish data using GPT"""
    try:
        logger.info("🤖 Extrayendo datos con GPT...")
        
        categories_list = ", ".join(CATEGORIES.keys())
        
        prompt = f"""Analiza este comando de voz en español y extrae la información para crear un plato:

COMANDO: "{transcript}"

Por favor, retorna SOLO un JSON válido (sin markdown, sin explicación) con:
{{
    "name": "nombre del plato",
    "price": número entero en pesos,
    "category": categoría de {categories_list}
}}

Si no puedes extraer el precio, usa 24000. Si la categoría no existe, usa 'burgers'.
Asegúrate que el JSON sea válido y completo."""

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Eres un asistente que extrae información de comandos de voz en español. Retorna SOLO JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        response_text = response['choices'][0]['message']['content'].strip()
        logger.info(f"GPT response: {response_text}")
        
        # Parse JSON
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
        else:
            json_str = response_text
        
        dish_data = json.loads(json_str)
        
        # Validate
        if dish_data.get('category') not in CATEGORIES:
            dish_data['category'] = 'burgers'
        if dish_data.get('price', 0) < 1000:
            dish_data['price'] = 24000
        
        logger.info(f"✅ Datos extraídos: {dish_data}")
        return dish_data
        
    except Exception as e:
        logger.error(f"❌ Error extrayendo: {e}")
        return {
            "name": "Plato del Día",
            "price": 24000,
            "category": "burgers",
            "confidence": 0.5
        }

def save_to_firebase(restaurant_id, dish_data):
    """Save dish to Firebase"""
    try:
        if not db:
            raise Exception("Firebase not initialized")
        
        logger.info(f"💾 Guardando en Firebase para restaurante: {restaurant_id}")
        
        doc = {
            'name': dish_data.get('name', 'Plato del Día'),
            'price': int(dish_data.get('price', 24000)),
            'categoryId': dish_data.get('category', 'burgers'),
            'description': '',
            'image': '',
            'active': True,
            'createdAt': datetime.now().isoformat(),
        }
        
        # Get restaurant reference
        rest_ref = db.collection('restaurants').document(restaurant_id)
        dishes_ref = rest_ref.collection('dishes')
        
        # Add document
        new_doc = dishes_ref.add(doc)
        doc_id = new_doc[1].id
        
        logger.info(f"✅ Guardado en Firebase con ID: {doc_id}")
        return doc_id
        
    except Exception as e:
        logger.error(f"❌ Error guardando en Firebase: {e}")
        raise

# Routes
@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'openai_available': bool(openai.api_key),
        'firebase_available': db is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/transcribe-and-create', methods=['POST'])
def transcribe_and_create():
    """Transcribe audio and create dish"""
    try:
        # Get file and restaurant_id
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        restaurant_id = request.form.get('restaurant_id', '')
        
        if not restaurant_id:
            return jsonify({'success': False, 'message': 'restaurant_id required'}), 400
        
        logger.info(f"📨 Solicitud: {file.filename}, restaurant_id={restaurant_id}")
        
        # Read audio
        audio_bytes = file.read()
        if not audio_bytes:
            return jsonify({'success': False, 'message': 'Empty audio file'}), 400
        
        logger.info(f"📂 Audio recibido: {len(audio_bytes)} bytes")
        
        # 1. Transcribe
        transcript, confidence = transcribe_audio(audio_bytes)
        
        if not transcript:
            return jsonify({
                'success': False,
                'message': 'No se detectó voz',
                'transcript': ''
            }), 400
        
        # 2. Extract data
        dish_data = extract_dish_info(transcript)
        dish_data['confidence'] = confidence
        
        # 3. Save to Firebase
        firebase_id = save_to_firebase(restaurant_id, dish_data)
        
        return jsonify({
            'success': True,
            'message': 'Plato creado exitosamente',
            'dish': dish_data,
            'transcript': transcript,
            'firebase_id': firebase_id
        })
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/transcribe-only', methods=['POST'])
def transcribe_only():
    """Transcribe audio only"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        audio_bytes = file.read()
        
        transcript, confidence = transcribe_audio(audio_bytes)
        
        return jsonify({
            'success': True,
            'transcript': transcript,
            'confidence': confidence
        })
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    logger.info("🚀 Iniciando servidor en http://0.0.0.0:8000")
    app.run(host='0.0.0.0', port=8000, debug=False)
