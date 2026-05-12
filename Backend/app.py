import logging
from datetime import datetime

import firebase_admin
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from firebase_admin import credentials, firestore

from ai_service import AIServiceError, extract_dish_info, get_provider_name, is_ai_available


load_dotenv()

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [VoiceService] %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

try:
    firebase_cred = credentials.Certificate('firebase-key.json')
    firebase_admin.initialize_app(firebase_cred)
    db = firestore.client()
    logger.info("Firebase inicializado")
except Exception as exc:
    logger.error("Firebase error: %s", exc)
    db = None


def error_response(message, status_code, code=None):
    payload = {"success": False, "message": message}
    if code:
        payload["code"] = code
    return jsonify(payload), status_code


def get_request_value(field_name):
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        return payload.get(field_name, "")
    return request.form.get(field_name, "")


@app.route('/health', methods=['GET'])
def health():
    return jsonify(
        {
            'status': 'healthy',
            'ai_available': is_ai_available(),
            'ai_provider': get_provider_name(),
            'openai_available': False,
            'deepseek_available': is_ai_available(),
            'firebase_available': db is not None,
            'timestamp': datetime.now().isoformat(),
        }
    )


@app.route('/transcribe-and-create', methods=['POST'])
def transcribe_and_create():
    try:
        transcript = str(get_request_value('transcript') or '').strip()
        restaurant_id = str(get_request_value('restaurant_id') or '').strip()

        logger.info(
            "Solicitud recibida. transcript=%s chars, restaurant_id=%s",
            len(transcript),
            restaurant_id or 'not-provided',
        )

        if not transcript:
            if 'file' in request.files:
                return error_response(
                    'No se recibio transcript. La transcripcion ahora se realiza en el navegador antes de llamar al backend.',
                    400,
                    'browser_transcript_required',
                )
            return error_response(
                'Debes enviar un transcript para procesar el plato.',
                400,
                'missing_transcript',
            )

        dish_data = extract_dish_info(transcript)
        provider_used = str(dish_data.pop('provider', get_provider_name()))

        return jsonify(
            {
                'success': True,
                'message': 'Comando de voz procesado correctamente',
                'dish': dish_data,
                'transcript': transcript,
                'provider': provider_used,
            }
        )
    except AIServiceError as exc:
        logger.error("AI service error: %s", exc)
        return error_response(exc.message, exc.status_code, exc.code)
    except Exception as exc:
        logger.exception("Error inesperado procesando transcript")
        return error_response(str(exc), 500, 'voice_processing_error')


@app.route('/transcribe-only', methods=['POST'])
def transcribe_only():
    transcript = str(get_request_value('transcript') or '').strip()
    if transcript:
        return jsonify(
            {
                'success': True,
                'transcript': transcript,
                'confidence': 1,
            }
        )

    return error_response(
        'Este backend ya no transcribe audio directamente. Envia el transcript desde el navegador.',
        400,
        'browser_transcript_required',
    )


@app.route('/extract-dish-info', methods=['POST'])
def extract_dish_only():
    try:
        transcript = str(get_request_value('transcript') or '').strip()
        if not transcript:
            return error_response(
                'Debes enviar un transcript para extraer datos del plato.',
                400,
                'missing_transcript',
            )

        dish_data = extract_dish_info(transcript)
        provider_used = str(dish_data.pop('provider', get_provider_name()))

        return jsonify(
            {
                'success': True,
                'dish': dish_data,
                'transcript': transcript,
                'provider': provider_used,
            }
        )
    except AIServiceError as exc:
        logger.error("AI service error: %s", exc)
        return error_response(exc.message, exc.status_code, exc.code)
    except Exception as exc:
        logger.exception("Error inesperado extrayendo datos del plato")
        return error_response(str(exc), 500, 'voice_processing_error')


if __name__ == '__main__':
    logger.info("Iniciando servidor en http://0.0.0.0:8000")
    app.run(host='0.0.0.0', port=8000, debug=False)
