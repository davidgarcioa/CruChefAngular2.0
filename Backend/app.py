import logging
import os
import tempfile
from datetime import datetime

import firebase_admin
import openai
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from firebase_admin import credentials, firestore
from werkzeug.utils import secure_filename

from ai_service import AIServiceError, extract_dish_info, get_provider_name, is_ai_available


load_dotenv(encoding='utf-8-sig')

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [VoiceService] %(message)s')
logger = logging.getLogger(__name__)
local_whisper_model = None

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


def has_openai_transcription() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def has_local_whisper_dependency() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def is_local_whisper_enabled() -> bool:
    return os.getenv("LOCAL_WHISPER_ENABLED", "true").strip().lower() != "false"


def is_audio_transcription_available() -> bool:
    return has_openai_transcription() or (
        is_local_whisper_enabled() and has_local_whisper_dependency()
    )


def save_uploaded_audio(file_storage):
    filename = secure_filename(file_storage.filename or "voice.webm")
    _, extension = os.path.splitext(filename)
    suffix = extension if extension else ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        file_storage.save(temp_file.name)
        return temp_file.name


def transcribe_with_openai(audio_path):
    openai.api_key = os.getenv("OPENAI_API_KEY", "").strip()
    with open(audio_path, "rb") as audio_file:
        response = openai.Audio.transcribe("whisper-1", audio_file, language="es")
    return str(response.get("text") or "").strip()


def get_local_whisper_model():
    global local_whisper_model
    if local_whisper_model is not None:
        return local_whisper_model

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise AIServiceError(
            "faster-whisper no esta instalado. Ejecuta pip install -r requirements.txt.",
            500,
            "local_whisper_missing",
        ) from exc

    model_name = os.getenv("LOCAL_WHISPER_MODEL", "base").strip() or "base"
    device = os.getenv("LOCAL_WHISPER_DEVICE", "cpu").strip() or "cpu"
    compute_type = os.getenv("LOCAL_WHISPER_COMPUTE_TYPE", "int8").strip() or "int8"

    logger.info(
        "Cargando Whisper local model=%s device=%s compute_type=%s",
        model_name,
        device,
        compute_type,
    )
    local_whisper_model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
    )
    return local_whisper_model


def transcribe_with_local_whisper(audio_path):
    model = get_local_whisper_model()
    segments, _info = model.transcribe(
        audio_path,
        language="es",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
        initial_prompt=(
            "CruChef, restaurante, plato, insumo, inventario, hamburguesa, burger, "
            "pizza, tacos, sushi, pastas, pollo, combos, postres, bebidas, desayunos, "
            "ensaladas, parrilla, mariscos, pescados, sopas, arroces, vegano, cafe, "
            "helados, panaderia, perros, arepas, saludable, pesos, mil."
        ),
    )
    return " ".join(segment.text.strip() for segment in segments).strip()


def transcribe_audio_file(file_storage):
    temp_path = ""
    try:
        temp_path = save_uploaded_audio(file_storage)
        if has_openai_transcription():
            transcript = transcribe_with_openai(temp_path)
        else:
            transcript = transcribe_with_local_whisper(temp_path)

        if not transcript:
            raise AIServiceError(
                "No se detecto voz clara en el audio.",
                400,
                "empty_transcript",
            )

        return transcript
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.route('/health', methods=['GET'])
def health():
    return jsonify(
        {
            'status': 'healthy',
            'ai_available': is_ai_available(),
            'ai_provider': get_provider_name(),
            'openai_available': bool(os.getenv("OPENAI_API_KEY", "").strip()),
            'deepseek_available': is_ai_available(),
            'local_whisper_available': is_local_whisper_enabled()
            and has_local_whisper_dependency(),
            'audio_transcription_available': is_audio_transcription_available(),
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
                transcript = transcribe_audio_file(request.files['file'])
                logger.info("Audio transcrito: %s chars", len(transcript))
            else:
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

    if 'file' in request.files:
        try:
            transcript = transcribe_audio_file(request.files['file'])
            return jsonify(
                {
                    'success': True,
                    'transcript': transcript,
                    'confidence': 1,
                }
            )
        except AIServiceError as exc:
            logger.error("Transcription error: %s", exc)
            return error_response(exc.message, exc.status_code, exc.code)
        except Exception as exc:
            logger.exception("Error inesperado transcribiendo audio")
            return error_response(str(exc), 500, 'transcription_error')

    return error_response('Debes enviar audio o transcript.', 400, 'missing_audio')


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
