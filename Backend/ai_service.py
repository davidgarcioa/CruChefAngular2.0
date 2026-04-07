
import os
import json
import logging
from io import BytesIO
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify
from flask_cors import CORS

import openai
import firebase_admin
from firebase_admin import credentials, firestore

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [VoiceService] - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicializar Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:4200", "http://localhost:4300", "*"]}})

# Configuración de OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY", "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")

# Inicializar Firebase
try:
    firebase_cred = credentials.Certificate('firebase-key.json')
    firebase_admin.initialize_app(firebase_cred)
    db = firestore.client()
    logger.info("✅ Firebase inicializado correctamente")
except Exception as e:
    logger.error(f"❌ Error inicializando Firebase: {e}")
    db = None

# Categorías disponibles
CATEGORIES = {
    'burgers': {'es': 'hamburguesas', 'icon': '🍔'},
    'pizza': {'es': 'pizzas', 'icon': '🍕'},
    'tacos': {'es': 'tacos', 'icon': '🌮'},
    'sushi': {'es': 'sushi', 'icon': '🍣'},
    'pasta': {'es': 'pastas', 'icon': '🍝'},
    'chicken': {'es': 'pollo', 'icon': '🍗'},
    'salads': {'es': 'ensaladas', 'icon': '🥗'},
    'desserts': {'es': 'postres', 'icon': '🍰'},
    'breakfast': {'es': 'desayuno', 'icon': '🥐'},
    'drinks': {'es': 'bebidas', 'icon': '🥤'},
}

# Modelos de datos (usando dicts en Flask)
# No necesitamos Pydantic en Flask


# Funciones auxiliares
def transcribe_audio(audio_bytes: bytes) -> tuple[str, float]:
    """
    Transcribe audio usando OpenAI Whisper
    
    Args:
        audio_bytes: bytes del archivo de audio
        
    Returns:
        tuple: (texto transcrito, confianza estimada)
    """
    try:
        logger.info("🎙️ Iniciando transcripción con Whisper...")
        
        # Crear objeto file para Whisper
        audio_file = BytesIO(audio_bytes)
        audio_file.name = "audio.wav"
        
        # Llamar a Whisper
        transcript = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file,
            language="es",  # Español
            response_format="json"
        )
        
        text = transcript.get('text', '').strip()
        logger.info(f"✅ Transcripción exitosa: '{text}'")
        
        # Retornar texto y confianza estimada (Whisper no da score, asumimos 0.9)
        return text, 0.9
        
    except Exception as e:
        logger.error(f"❌ Error transcribiendo: {e}")
        raise HTTPException(status_code=500, detail=f"Error en transcripción: {str(e)}")


def extract_dish_info(transcript: str) -> dict:
    """
    Extrae información de un plato del texto transcrito usando GPT
    
    Args:
        transcript: texto transcrito
        
    Returns:
        dict con nombre, precio, categoría
    """
    try:
        logger.info("🤖 Extrayendo información con GPT-4o mini...")
        
        categories_list = ", ".join(CATEGORIES.keys())
        
        prompt = f"""Analiza este comando de voz en español y extrae la información para crear un plato:

COMANDO: "{transcript}"

Por favor, retorna un JSON con:
{{
    "name": "nombre del plato (string)",
    "price": número en COP (int, mínimo 1000),
    "category": una de estas: {categories_list},
    "confidence": 0.0 a 1.0 (qué tan seguro estás de los datos)
}}

IMPORTANTE:
- Si no encuentras el nombre, asume uno relacionado al contexto
- Si no encuentras precio, usa 24000
- Si no encuentras categoría, usa "burgers"
- Sé inteligente interpretando el texto
- Retorna SOLO el JSON, sin explicaciones

Ejemplo:
{{"name": "Hamburguesa Clásica", "price": 25000, "category": "burgers", "confidence": 0.95}}"""

        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente de restaurante que extrae información de platos de comandos de voz. Retorna solo JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        # Parsear respuesta
        response_text = response.choices[0].message.content.strip()
        logger.info(f"📝 Respuesta GPT: {response_text}")
        
        # Intentar extraer JSON
        try:
            # Si la respuesta contiene ```json, extraer
            if "```json" in response_text:
                json_str = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                json_str = response_text.split("```")[1].split("```")[0].strip()
            else:
                json_str = response_text
            
            dish_data = json.loads(json_str)
            
            # Validar que la categoría existe
            if dish_data.get('category') not in CATEGORIES:
                dish_data['category'] = 'burgers'
            
            # Asegurar que el precio es válido
            if dish_data.get('price', 0) < 1000:
                dish_data['price'] = 24000
            
            logger.info(f"✅ Datos extraídos: {dish_data}")
            return dish_data
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Error parseando JSON: {response_text} - {e}")
            return {
                "name": "Plato del Día",
                "price": 24000,
                "category": "burgers",
                "confidence": 0.5
            }
        
    except Exception as e:
        logger.error(f"❌ Error extrayendo información: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error extrayendo datos: {str(e)}")


def save_to_firebase(restaurant_id: str, dish_data: dict) -> str:
    """
    Guarda el plato en Firebase
    
    Args:
        restaurant_id: ID del restaurante
        dish_data: diccionario con datos del plato
        
    Returns:
        ID del documento creado en Firebase
    """
    try:
        if not db:
            raise Exception("Firebase no está inicializado")
        
        logger.info(f"💾 Guardando plato en Firebase para restaurante: {restaurant_id}")
        
        dish_document = {
            'name': dish_data.get('name', 'Plato del Día'),
            'price': int(dish_data.get('price', 24000)),
            'category': dish_data.get('category', 'burgers'),
            'createdAt': datetime.now(),
            'createdBy': 'ai-voice-assistant',
            'source': 'voice_command',
            'confidence': float(dish_data.get('confidence', 0.5)),
        }
        
        # Guardar en la colección de restaurante
        collection_ref = db.collection('restaurants').document(restaurant_id).collection('dishes')
        doc_ref = collection_ref.add(dish_document)
        
        doc_id = doc_ref[1].id
        logger.info(f"✅ Plato guardado en Firebase con ID: {doc_id}")
        
        return doc_id
        
    except Exception as e:
        logger.error(f"❌ Error guardando en Firebase: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error guardando plato: {str(e)}")


# Endpoints

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Verifica el estado del servicio"""
    return HealthResponse(
        status="healthy",
        openai_available=bool(openai.api_key),
        firebase_available=db is not None,
        timestamp=datetime.now().isoformat()
    )


@app.post("/transcribe-and-create", response_model=DishResponse)
async def transcribe_and_create_dish(
    file: UploadFile = File(...),
    restaurant_id: str = ""
):
    """
    Recibe audio, lo transcribe y crea un plato automáticamente
    
    Args:
        file: archivo de audio (WAV, MP3, etc)
        restaurant_id: ID del restaurante donde guardar
        
    Returns:
        DishResponse con datos del plato creado
    """
    try:
        logger.info(f"📨 Solicitud recibida: archivo={file.filename}, restaurant_id={restaurant_id}")
        
        # Validar restaurante
        if not restaurant_id:
            raise HTTPException(status_code=400, detail="restaurant_id es requerido")
        
        # Leer archivo de audio
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Archivo de audio vacío")
        
        logger.info(f"📂 Archivo recibido: {len(audio_bytes)} bytes")
        
        # 1. Transcribir
        transcript, confidence = transcribe_audio(audio_bytes)
        
        if not transcript:
            return DishResponse(
                success=False,
                message="No se detectó voz en el audio",
                transcript=""
            )
        
        # 2. Extraer información
        dish_data = extract_dish_info(transcript)
        dish_data['confidence'] = confidence
        
        # 3. Guardar en Firebase
        firebase_id = save_to_firebase(restaurant_id, dish_data)
        
        return DishResponse(
            success=True,
            message=f"✅ Plato '{dish_data['name']}' creado exitosamente",
            dish=DishData(**dish_data),
            transcript=transcript,
            firebase_id=firebase_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error procesando solicitud: {e}\n{traceback.format_exc()}")
        return DishResponse(
            success=False,
            message=f"Error: {str(e)}",
            transcript=""
        )


@app.post("/transcribe-only", response_model=dict)
async def transcribe_only(file: UploadFile = File(...)):
    """
    Solo transcribe audio sin crear plato (para testing)
    """
    try:
        audio_bytes = await file.read()
        transcript, confidence = transcribe_audio(audio_bytes)
        
        return {
            "success": True,
            "transcript": transcript,
            "confidence": confidence
        }
    except HTTPException as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/extract-dish-info", response_model=dict)
async def extract_dish_only(transcript: str):
    """
    Solo extrae información del texto (para testing)
    """
    try:
        dish_data = extract_dish_info(transcript)
        return {
            "success": True,
            "dish": dish_data
        }
    except HTTPException as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Iniciando servidor...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
