import json
import logging
import os
import re
import socket
import unicodedata
from dataclasses import dataclass
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from dotenv import load_dotenv


load_dotenv()

logger = logging.getLogger(__name__)


CATEGORIES = {
    "burgers": "hamburguesas",
    "pizza": "pizzas",
    "tacos": "tacos",
    "sushi": "sushi",
    "pasta": "pastas",
    "chicken": "pollo",
    "salads": "ensaladas",
    "desserts": "postres",
    "breakfast": "desayuno",
    "drinks": "bebidas",
}

DEFAULT_DISH_NAME = "Plato del Dia"
DEFAULT_PRICE = 24000
DEFAULT_CATEGORY = "burgers"
DEFAULT_CONFIDENCE = 0.85
FALLBACK_CONFIDENCE = 0.45

CATEGORY_KEYWORDS = {
    "burgers": ["burger", "burgers", "hamburguesa", "hamburguesas"],
    "pizza": ["pizza", "pizzas"],
    "tacos": ["taco", "tacos"],
    "sushi": ["sushi"],
    "pasta": ["pasta", "pastas", "spaghetti", "lasana", "lasagna"],
    "chicken": ["pollo", "chicken", "alitas"],
    "salads": ["ensalada", "ensaladas", "salad"],
    "desserts": ["postre", "postres", "torta", "helado", "brownie"],
    "breakfast": ["desayuno", "arepa", "huevos", "waffle", "waffles"],
    "drinks": ["bebida", "bebidas", "jugo", "limonada", "gaseosa", "cafe"],
}

SPANISH_NUMBER_WORDS = {
    "cero": 0,
    "uno": 1,
    "una": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
    "diez": 10,
    "once": 11,
    "doce": 12,
    "trece": 13,
    "catorce": 14,
    "quince": 15,
    "dieciseis": 16,
    "diecisiete": 17,
    "dieciocho": 18,
    "diecinueve": 19,
    "veinte": 20,
    "veintiuno": 21,
    "veintidos": 22,
    "veintitres": 23,
    "veinticuatro": 24,
    "veinticinco": 25,
    "veintiseis": 26,
    "veintisiete": 27,
    "veintiocho": 28,
    "veintinueve": 29,
    "treinta": 30,
    "cuarenta": 40,
    "cincuenta": 50,
    "sesenta": 60,
    "setenta": 70,
    "ochenta": 80,
    "noventa": 90,
    "cien": 100,
    "ciento": 100,
    "doscientos": 200,
    "trescientos": 300,
    "cuatrocientos": 400,
    "quinientos": 500,
    "seiscientos": 600,
    "setecientos": 700,
    "ochocientos": 800,
    "novecientos": 900,
}

SPANISH_NUMBER_PATTERN = "|".join(
    sorted(SPANISH_NUMBER_WORDS.keys(), key=len, reverse=True)
)


@dataclass
class AIServiceError(Exception):
    message: str
    status_code: int = 502
    code: str = "ai_service_error"

    def __str__(self) -> str:
        return self.message


def get_provider_name() -> str:
    return "deepseek"


def is_ai_available() -> bool:
    return bool(os.getenv("DEEPSEEK_API_KEY", "").strip())


def extract_dish_info(transcript: str) -> dict[str, Any]:
    normalized_transcript = normalize_transcript(transcript)
    if not normalized_transcript:
        raise AIServiceError(
            "No se recibio texto para procesar.",
            400,
            "missing_transcript",
        )

    logger.info("Extrayendo datos del plato con DeepSeek...")
    try:
        response_text = request_deepseek_completion(normalized_transcript)
        logger.info("Respuesta DeepSeek recibida: %s", response_text)
        dish_data = parse_dish_response(response_text, normalized_transcript)
        dish_data["provider"] = "deepseek"
        return dish_data
    except AIServiceError as exc:
        logger.warning(
            "DeepSeek no estuvo disponible (%s). Se usara parser local.",
            exc.code,
        )
        fallback_data = extract_dish_info_locally(normalized_transcript)
        fallback_data["provider"] = "local-fallback"
        return fallback_data


def normalize_transcript(transcript: str) -> str:
    return " ".join((transcript or "").split())


def normalize_for_matching(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text.lower())
    without_accents = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )
    return " ".join(without_accents.split())


def request_deepseek_completion(transcript: str) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise AIServiceError(
            "DEEPSEEK_API_KEY no configurada en Backend/.env.",
            500,
            "deepseek_key_missing",
        )

    model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip() or "deepseek-chat"
    base_url = (
        os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip().rstrip("/")
    )
    timeout_seconds = int(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "30"))
    endpoint = f"{base_url}/chat/completions"

    categories_list = ", ".join(CATEGORIES.keys())
    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Eres un asistente de restaurantes. "
                    "Debes devolver solo JSON valido con name, price, category y confidence."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Analiza este comando de voz en espanol y extrae la informacion de un plato.\n"
                    f"Comando: \"{transcript}\"\n\n"
                    "Debes responder solo con JSON valido con esta forma exacta:\n"
                    "{\n"
                    '  "name": "nombre del plato",\n'
                    '  "price": 24000,\n'
                    f'  "category": "una de estas categorias: {categories_list}",\n'
                    '  "confidence": 0.95\n'
                    "}\n\n"
                    "Reglas:\n"
                    f"- Si falta el nombre, usa \"{DEFAULT_DISH_NAME}\".\n"
                    f"- Si falta el precio o es invalido, usa {DEFAULT_PRICE}.\n"
                    f"- Si la categoria no coincide, usa \"{DEFAULT_CATEGORY}\".\n"
                    "- Confidence debe ser un numero entre 0 y 1.\n"
                    "- No incluyas markdown ni explicaciones."
                ),
            },
        ],
    }

    body = json.dumps(payload).encode("utf-8")
    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    request_obj = urllib_request.Request(
        endpoint,
        data=body,
        headers=request_headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(request_obj, timeout=timeout_seconds) as response:
            return response.read().decode("utf-8")
    except urllib_error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        logger.error("DeepSeek HTTP error %s: %s", exc.code, response_body)
        raise map_http_error(exc.code, response_body) from exc
    except urllib_error.URLError as exc:
        logger.error("DeepSeek connection error: %s", exc.reason)
        raise AIServiceError(
            "No fue posible conectar con DeepSeek. Revisa la red o la configuracion del backend.",
            502,
            "deepseek_connection_error",
        ) from exc
    except socket.timeout as exc:
        logger.error("DeepSeek timeout: %s", exc)
        raise AIServiceError(
            "DeepSeek tardo demasiado en responder. Intenta nuevamente.",
            504,
            "deepseek_timeout",
        ) from exc


def map_http_error(status_code: int, response_body: str) -> AIServiceError:
    response_text = response_body.lower()

    if status_code == 400:
        return AIServiceError(
            "DeepSeek rechazo la solicitud enviada por el backend.",
            400,
            "deepseek_bad_request",
        )
    if status_code == 401:
        return AIServiceError(
            "La API key de DeepSeek no es valida o fue rechazada.",
            401,
            "deepseek_auth_error",
        )
    if status_code == 402 or "insufficient" in response_text or "balance" in response_text:
        return AIServiceError(
            "La cuenta de DeepSeek no tiene saldo disponible o no permite mas uso.",
            402,
            "deepseek_insufficient_balance",
        )
    if status_code == 429:
        return AIServiceError(
            "DeepSeek esta limitando las solicitudes. Intenta nuevamente en unos minutos.",
            429,
            "deepseek_rate_limited",
        )
    if status_code >= 500:
        return AIServiceError(
            "DeepSeek devolvio un error interno procesando la solicitud.",
            502,
            "deepseek_server_error",
        )

    return AIServiceError(
        f"DeepSeek devolvio un error HTTP {status_code}.",
        502,
        "deepseek_http_error",
    )


def parse_dish_response(raw_response: str, transcript: str) -> dict[str, Any]:
    try:
        response_payload = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        logger.error("DeepSeek devolvio JSON invalido: %s", raw_response)
        raise AIServiceError(
            "DeepSeek devolvio una respuesta invalida.",
            502,
            "deepseek_invalid_json",
        ) from exc

    choices = response_payload.get("choices") or []
    if not choices:
        raise AIServiceError(
            "DeepSeek no devolvio contenido util para procesar el plato.",
            502,
            "deepseek_empty_response",
        )

    message = choices[0].get("message") or {}
    content = str(message.get("content") or "").strip()
    if not content:
        raise AIServiceError(
            "DeepSeek no devolvio informacion del plato.",
            502,
            "deepseek_empty_message",
        )

    try:
        dish_payload = json.loads(extract_json_fragment(content))
    except json.JSONDecodeError:
        logger.warning("No se pudo parsear el JSON del modelo. Se aplicara fallback.")
        dish_payload = {
            "name": transcript,
            "price": DEFAULT_PRICE,
            "category": DEFAULT_CATEGORY,
            "confidence": 0.4,
        }

    return normalize_dish_payload(dish_payload, transcript)


def extract_json_fragment(content: str) -> str:
    if "```json" in content:
        return content.split("```json", 1)[1].split("```", 1)[0].strip()
    if "```" in content:
        return content.split("```", 1)[1].split("```", 1)[0].strip()
    return content


def normalize_dish_payload(
    dish_payload: dict[str, Any],
    transcript: str,
) -> dict[str, Any]:
    raw_name = str(dish_payload.get("name") or transcript or DEFAULT_DISH_NAME)
    name = " ".join(raw_name.split())[:80].strip()
    if len(name) < 2:
        name = DEFAULT_DISH_NAME

    try:
        price = int(float(dish_payload.get("price", DEFAULT_PRICE)))
    except (TypeError, ValueError):
        price = DEFAULT_PRICE
    if price < 1000:
        price = DEFAULT_PRICE

    category = str(dish_payload.get("category") or DEFAULT_CATEGORY).strip().lower()
    if category not in CATEGORIES:
        category = DEFAULT_CATEGORY

    try:
        confidence = float(dish_payload.get("confidence", DEFAULT_CONFIDENCE))
    except (TypeError, ValueError):
        confidence = DEFAULT_CONFIDENCE
    confidence = max(0.0, min(confidence, 1.0))

    return {
        "name": name,
        "price": price,
        "category": category,
        "confidence": confidence,
    }


def extract_dish_info_locally(transcript: str) -> dict[str, Any]:
    category = extract_category_from_text(transcript)
    price = extract_price_from_text(transcript)
    name = extract_name_from_text(transcript, category)

    return {
        "name": name,
        "price": price,
        "category": category,
        "confidence": FALLBACK_CONFIDENCE,
    }


def extract_category_from_text(transcript: str) -> str:
    normalized = normalize_for_matching(transcript)

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", normalized):
                return category

    return DEFAULT_CATEGORY


def extract_price_from_text(transcript: str) -> int:
    digit_candidates = []
    for match in re.findall(r"\d[\d\.\,]*", transcript):
        sanitized = match.replace(".", "").replace(",", "")
        try:
            value = int(sanitized)
        except ValueError:
            continue
        if 1000 <= value <= 1000000:
            digit_candidates.append(value)

    if digit_candidates:
        return max(digit_candidates)

    word_price = parse_spanish_number_sequence(transcript)
    if 1000 <= word_price <= 1000000:
        return word_price

    return DEFAULT_PRICE


def parse_spanish_number_sequence(transcript: str) -> int:
    normalized = normalize_for_matching(transcript)
    tokens = re.findall(r"[a-z]+", normalized)

    best_value = 0
    total = 0
    segment = 0
    found_number = False

    for token in tokens:
        if token == "y":
            continue

        if token in SPANISH_NUMBER_WORDS:
            segment += SPANISH_NUMBER_WORDS[token]
            found_number = True
            continue

        if token == "mil":
            multiplier = segment or 1
            total += multiplier * 1000
            segment = 0
            found_number = True
            continue

        if found_number:
            best_value = max(best_value, total + segment)
            total = 0
            segment = 0
            found_number = False

    if found_number:
        best_value = max(best_value, total + segment)

    return best_value


def extract_name_from_text(transcript: str, category: str) -> str:
    name = transcript.strip()

    name = re.sub(
        r"^(crear|crea|agrega|agregar|registra|registrar|quiero|necesito|poner)\s+",
        "",
        name,
        flags=re.IGNORECASE,
    )
    name = re.sub(r"^(un|una|el|la)\s+", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\b\d[\d\.\,]*\b(?:\s*pesos?)?", "", name, flags=re.IGNORECASE)
    name = re.sub(
        rf"\b(?:de|por)?\s*(?:(?:{SPANISH_NUMBER_PATTERN})\s+)+pesos?\b",
        "",
        name,
        flags=re.IGNORECASE,
    )
    name = re.sub(
        r"\b(?:por|de)?\s*(?:categoria|categor[ií]a)\s+[A-Za-zÁÉÍÓÚáéíóúÑñÜü-]+\b",
        "",
        name,
        flags=re.IGNORECASE,
    )
    name = re.sub(
        r"\b(?:en|categoria|categor[ií]a|pesos|peso|cop|precio|vale|cuesta)\b",
        "",
        name,
        flags=re.IGNORECASE,
    )

    for keyword in CATEGORY_KEYWORDS.get(category, []):
        if keyword not in {"burger", "burgers", "pizza", "pizzas", "sushi", "tacos"}:
            continue
        name = re.sub(rf"\b{re.escape(keyword)}\b", keyword, name, flags=re.IGNORECASE)

    trailing_tokens = name.split()
    while trailing_tokens:
        normalized_token = normalize_for_matching(trailing_tokens[-1])
        if normalized_token in SPANISH_NUMBER_WORDS or normalized_token in {"mil", "y"}:
            trailing_tokens.pop()
            continue
        break
    name = " ".join(trailing_tokens).strip(" -,:;")
    name = re.sub(r"\b(de|por|en)$", "", name, flags=re.IGNORECASE).strip()

    if len(name) < 2:
        category_labels = {
            "burgers": "Hamburguesa Especial",
            "pizza": "Pizza Especial",
            "tacos": "Tacos Especiales",
            "sushi": "Sushi Especial",
            "pasta": "Pasta Especial",
            "chicken": "Pollo Especial",
            "salads": "Ensalada Especial",
            "desserts": "Postre Especial",
            "breakfast": "Desayuno Especial",
            "drinks": "Bebida Especial",
        }
        return category_labels.get(category, DEFAULT_DISH_NAME)

    return name[:80].title()
