# 🎤 AI Voice Assistant - Backend Python + FastAPI

## 📋 Descripción

Servicio de IA que convierte voz a texto y crea platos automáticamente usando:
- **Deepseek Chat**: Modelo de IA para extracción inteligente de datos
- **Firebase**: Almacenamiento de platos creados
- **FastAPI**: Backend Python de alto rendimiento

⚠️ **Nota**: Para transcripción de audio, necesitarás una solución alternativa (como OpenAI Whisper o ASR localizada).

## 🚀 Instalación Rápida

### Paso 1: Instalar Python (si no lo tienes)
```bash
# Descargar desde https://www.python.org/downloads/
# Asegúrate de marcar "Add Python to PATH"
```

### Paso 2: Crear entorno virtual
```bash
cd c:\Users\pc\CruChefAngular2.0\Backend
python -m venv venv
```

### Paso 3: Activar entorno virtual

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

### Paso 4: Instalar dependencias
```bash
pip install -r requirements.txt
```

### Paso 5: Configurar variables de entorno
Crear archivo `.env` en `Backend/` con:
```env
DEEPSEEK_API_KEY=sk-b55730508d4f4f19b7c0ebeba0cc5679
```

### Paso 6: Ejecutar el servidor
```bash
python ai_service.py
```

Deberías ver:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## 📡 Endpoints Disponibles

### 1. Health Check
```bash
GET /health
```

Respuesta:
```json
{
  "status": "healthy",
  "deepseek_available": true,
  "firebase_available": true,
  "timestamp": "2026-04-06T22:30:00"
}
```

### 2. Crear Plato desde Audio
```bash
POST /transcribe-and-create

# Parámetros (multipart/form-data):
- file: archivo de audio (WAV, MP3, etc)
- restaurant_id: ID del restaurante en Firebase

# Ejemplo con curl:
curl -X POST "http://localhost:8000/transcribe-and-create" \
  -F "file=@audio.wav" \
  -F "restaurant_id=rest_12345"
```

Respuesta exitosa:
```json
{
  "success": true,
  "message": "✅ Plato 'Hamburguesa Clásica' creado exitosamente",
  "dish": {
    "name": "Hamburguesa Clásica",
    "price": 25000,
    "category": "burgers",
    "confidence": 0.95
  },
  "transcript": "una hamburguesa clásica de veinticinco mil pesos",
  "firebase_id": "doc_12345"
}
```

### 3. Solo Transcription
```bash
POST /transcribe-only

# Parámetros:
- file: archivo de audio

# Solo transcribe, no crea el plato
```

### 4. Solo Extracción de Datos
```bash
POST /extract-dish-info

# Parámetros:
- transcript: texto a procesar

# Solo extrae información, no transcribe
```

## 🔧 Troubleshooting

### Error: "Backend no disponible"
**Solución**: Asegúrate de que:
1. El servidor Python está ejecutándose en `http://localhost:8000`
2. No hay firewall bloqueando el puerto 8000
3. Angular el `ng serve` está en `http://localhost:4200`

### Error: "OpenAI API Key no válida"
**Solución**: Verifica que:
1. Tu API Key es correcta y activa (desde https://platform.openai.com/api-keys)
2. Tiene permisos para Whisper y GPT-4o
3. Tienes crédito disponible en tu cuenta OpenAI

### Error: "Firebase no inicializado"
**Solución**: Asegúrate de que:
1. El archivo `firebase-key.json` está en `Backend/`
2. Tiene las credenciales correctas de Firebase Admin
3. El usuario de Firebase tiene permiso para escribir en `restaurants.{id}.dishes`

### Micrófono no funciona en Angular
**Solución**:
1. Usar HTTPS o localhost (los navegadores lo requieren por seguridad)
2. Revisar permisos del navegador para acceder al micrófono
3. Verificar que no hay otra aplicación usando el micrófono

## 📊 Cómo Funciona

```
Angular (Frontend)                Backend Python
┌─────────────────┐              ┌──────────────────┐
│ getUserMedia()  │──Audio───→   │ Whisper API      │
│ Captura audio   │              │ Transcribe       │
└────────┬────────┘              └────────┬─────────┘
         │                                │
         │              ┌────────────────┘
         │              ▼
         │         ┌──────────────────┐
         │         │ GPT-4o Mini      │
         │         │ Extract (name,   │
         │         │ price, category) │
         │         └────────┬─────────┘
         │                  │
         │     ┌────────────┘
         │     ▼
         └────→ DishResponse
                ├ name
                ├ price
                ├ category
                ├ confidence
                ├ transcript
                └ firebase_id
```

## 🔐 Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| DEEPSEEK_API_KEY | Tu API Key de Deepseek | ✅ Sí |

## 📦 Dependencias

- **fastapi**: Framework web
- **uvicorn**: ASGI server
- **openai**: Cliente de OpenAI (compatible con Deepseek)
- **firebase-admin**: SDK de Firebase
- **python-multipart**: Para upload de archivos

## 🎯 Casos de Uso

1. **Creación rápida de menú**: Dices "Hamburguesa clásica de 25 mil pesos" y se crea automáticamente
2. **Importación de menú**: Dictarás todo tu menú y la IA lo procesará
3. **Edición por voz**: Actualizar precios diciendo números
4. **Descripción de platos**: La IA extrae ingredientes de descripción de voz

## 📝 Logs

El servidor genera logs detallados:
```
[VoiceService] Inicializado. Backend URL: http://localhost:8000
🎙️ Iniciando transcripción con Whisper...
✅ Transcripción exitosa: 'una hamburguesa clásica'
🤖 Extrayendo información con GPT-4o mini...
✅ Datos extraídos: {'name': 'Hamburguesa Clásica', ...}
💾 Guardando plato en Firebase...
✅ Plato guardado con ID: doc_12345
```

## 🆘 Soporte

Si algo no funciona:
1. Revisa los logs de la consola (Frontend y Backend)
2. Verifica que los servicios están en `http://localhost:8000` (backend) y `http://localhost:4200` (frontend)
3. Prueba los endpoints con `curl` o Postman
4. Revisa que Firebase tiene las colecciones correctas

## 📄 Licencia

Parte de CruChef - Gestor Gastronómico 2026
