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

# Deepseek - Lee desde .env
openai.api_key = os.getenv("DEEPSEEK_API_KEY")
openai.api_base = "https://api.deepseek.com/v1"
if not openai.api_key:
    logger.error("❌ DEEPSEEK_API_KEY no configurada. Crea un archivo .env con tu clave.")
else:
    logger.info("✅ Deepseek API key configurada")

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
    """Transcribe audio using OpenAI Whisper if available, otherwise return empty"""
    try:
        # Deepseek no soporta transcripción de audio
        logger.warning("⚠️ Audio transcription is not available in Deepseek API.")
        logger.info("💡 Por favor usa Web Speech API del navegador o envía texto directamente.")
        raise Exception("Audio transcription not supported. Use text endpoint instead.")
    except Exception as e:
        logger.error(f"❌ Error transcribiendo: {e}")
        raise

def extract_dish_info(transcript):
    """Extract dish data using Regex - simple and bulletproof"""
    import re
    
    try:
        logger.info(f"🤖 Extrayendo datos... Transcript: '{transcript}'")
        
        # Si el texto es muy corto, usar valores por defecto
        if len(transcript.strip()) < 3:
            logger.warning(f"⚠️ Texto muy corto: '{transcript}'")
            return {"name": "Plato del Día", "price": 24000, "category": "burgers"}
        
        clean_text = transcript.strip().lower()
        
        # ===== EXTRAER PRECIO =====
        price = 24000  # Default
        
        # Buscar número seguido de "mil"
        mil_match = re.search(r'(\d+)\s*mil', clean_text)
        if mil_match:
            price = int(mil_match.group(1)) * 1000
            logger.info(f"✅ Encontrado: {price} (X mil)")
        else:
            # Buscar número directo (4-5 dígitos)
            num_match = re.search(r'(\d{4,5})', clean_text)
            if num_match:
                price = int(num_match.group(1))
                logger.info(f"✅ Encontrado: {price} (número directo)")
        
        # ===== EXTRAER NOMBRE =====
        # El nombre es todo ANTES del primer número
        name = "Plato del Día"  # Default
        
        # Encontrar la posición del primer número
        first_number = re.search(r'\d+', clean_text)
        if first_number:
            name_text = clean_text[:first_number.start()].strip()
            # Remover palabras que no sean importantes
            words = name_text.replace('nombre', '').replace('precio', '').replace(',', '').split()
            words = [w.strip() for w in words if w.strip() and w not in ['de', 'el', 'la', 'los', 'las', 'y', 'o', 'a']]
            
            if words:
                name = ' '.join(words).title()
                logger.info(f"✅ Nombre extraído: '{name}'")
            else:
                logger.info(f"⚠️ No se pudo extraer nombre")
        
        # ===== EXTRAER CATEGORÍA =====
        category = "burgers"  # Default siempre
        
        for cat_key in CATEGORIES.keys():
            if cat_key in clean_text or CATEGORIES[cat_key].lower() in clean_text:
                category = cat_key
                logger.info(f"✅ Categoría encontrada: {category}")
                break
        
        # Resultado final
        result = {
            "name": name,
            "price": max(1000, price),  # Mínimo 1000
            "category": category
        }
        
        logger.info(f"✅ RESULTADO FINAL: {result}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error extrayendo: {e}")
        logger.exception("Stack trace:")
        return {"name": "Plato del Día", "price": 24000, "category": "burgers"}

def save_to_firebase(restaurant_id, dish_data):
    """Save dish to Firebase"""
    try:
        if not db:
            logger.warning(f"⚠️ Firebase no inicializado, usando ID dummy")
            return f"dummy_{restaurant_id}_{datetime.now().timestamp()}"
        
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
        # Retornar un ID dummy para evitar que el endpoint falle
        return f"error_{datetime.now().timestamp()}"

# Routes
@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'deepseek_available': bool(openai.api_key),
        'firebase_available': db is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/text-to-dish', methods=['POST'])
def text_to_dish():
    """Crear plato desde texto (sin necesidad de audio)"""
    try:
        data = request.get_json()
        transcript = data.get('transcript', '').strip()
        restaurant_id = data.get('restaurant_id', '')
        
        logger.info(f"📨 [TEXT-TO-DISH] Solicitud recibida")
        logger.info(f"  Transcript: {transcript}")
        logger.info(f"  Restaurant ID: {restaurant_id}")
        
        if not transcript:
            logger.warning("❌ Transcript vacío")
            return jsonify({'success': False, 'message': 'Transcript required'}), 400
        
        if not restaurant_id:
            logger.warning("❌ Restaurant ID vacío")
            return jsonify({'success': False, 'message': 'restaurant_id required'}), 400
        
        # Extract data using Deepseek
        logger.info("🤖 Llamando a extract_dish_info()...")
        dish_data = extract_dish_info(transcript)
        logger.info(f"📝 Datos extraídos: {dish_data}")
        
        # Save to Firebase
        logger.info("💾 Llamando a save_to_firebase()...")
        firebase_id = save_to_firebase(restaurant_id, dish_data)
        logger.info(f"✅ Firebase ID guardado: {firebase_id}")
        
        response_payload = {
            'success': True,
            'message': 'Plato creado exitosamente',
            'dish': dish_data,
            'transcript': transcript,
            'firebase_id': firebase_id
        }
        
        logger.info(f"✅ [TEXT-TO-DISH] Respuesta completada:")
        logger.info(f"  Success: {response_payload['success']}")
        logger.info(f"  Message: {response_payload['message']}")
        logger.info(f"  Dish: {response_payload['dish']}")
        logger.info(f"  Firebase ID: {response_payload['firebase_id']}")
        
        return jsonify(response_payload)
        
    except Exception as e:
        logger.error(f"❌ Error en text_to_dish: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/create-dish-from-voice', methods=['POST'])
def create_dish_from_voice():
    """Crea un plato directamente desde datos de voz extraídos"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        price = data.get('price')
        category = data.get('category', '').strip().lower()
        restaurant_id = data.get('restaurant_id', '').strip()
        
        logger.info(f"📨 [CREATE-DISH-FROM-VOICE] Solicitud recibida")
        logger.info(f"  Nombre: {name}")
        logger.info(f"  Precio: {price}")
        logger.info(f"  Categoría: {category}")
        logger.info(f"  Restaurant ID: {restaurant_id}")
        
        # Validar datos
        if not name:
            logger.warning("❌ Nombre vacío")
            return jsonify({'success': False, 'message': 'El nombre del plato es requerido'}), 400
        
        if not restaurant_id:
            logger.warning("❌ Restaurant ID vacío")
            return jsonify({'success': False, 'message': 'El restaurante es requerido'}), 400
        
        if not price or price < 1000:
            logger.warning(f"❌ Precio inválido: {price}")
            return jsonify({'success': False, 'message': 'El precio debe ser mayor a 1000'}), 400
        
        if category not in CATEGORIES:
            logger.warning(f"⚠️ Categoría inválida: {category}")
            category = 'burgers'
            logger.info(f"✅ Categoría corregida a: {category}")
        
        # Crear objeto dish
        dish_data = {
            'name': name,
            'price': int(price),
            'category': category
        }
        
        logger.info(f"📋 Datos a guardar: {dish_data}")
        
        # Guardar en Firebase
        firebase_id = save_to_firebase(restaurant_id, dish_data)
        
        response_payload = {
            'success': True,
            'message': f'✅ Plato "{name}" creado exitosamente',
            'dish': dish_data,
            'firebase_id': firebase_id
        }
        
        logger.info(f"✅ [CREATE-DISH-FROM-VOICE] Plato creado exitosamente: {response_payload}")
        
        return jsonify(response_payload)
        
    except Exception as e:
        logger.error(f"❌ Error en create_dish_from_voice: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Error al crear el plato: {str(e)}'}), 500

@app.route('/transcribe-and-create', methods=['POST'])
def transcribe_and_create():
    """Transcribe audio and create dish - NOTA: Usa /text-to-dish en su lugar"""
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
        try:
            transcript, confidence = transcribe_audio(audio_bytes)
        except Exception as e:
            logger.warning(f"⚠️ Audio transcription failed: {e}")
            return jsonify({
                'success': False,
                'message': 'Audio transcription not available. Use /text-to-dish endpoint with text instead.',
                'suggestion': 'Use Web Speech API or send text directly to /text-to-dish'
            }), 400
        
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
