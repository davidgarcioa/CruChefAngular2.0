# Despliegue de CruChef

## 1. Seguridad antes de desplegar

La clave `firebase-key.json` y las API keys no deben subirse a GitHub. Si alguna clave fue compartida o expuesta, genera una nueva y elimina la anterior desde Google Cloud o el proveedor correspondiente.

## 2. Backend Node en Render

Puedes crear el servicio desde el `render.yaml` del repositorio o manualmente:

- Root Directory: `Backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Variables de entorno:

```env
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT_JSON={...json_nuevo_de_firebase...}
```

Cuando el servicio quede activo, prueba:

```text
https://TU_BACKEND_NODE/api/health
```

Debe responder `firebaseConfigured: true`.

## 3. Backend Python de voz en Render

Puedes crear otro servicio desde el mismo `render.yaml` o manualmente:

- Root Directory: `Backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 180`
- Health Check Path: `/health`

Variables de entorno:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={...json_nuevo_de_firebase...}
DEEPSEEK_API_KEY=tu_deepseek_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT_SECONDS=30
LOCAL_WHISPER_MODEL=base
LOCAL_WHISPER_DEVICE=cpu
LOCAL_WHISPER_COMPUTE_TYPE=int8
```

Prueba:

```text
https://TU_BACKEND_VOZ/health
```

Debe responder `audio_transcription_available: true`.

## 4. Frontend Angular en Vercel

Importa el proyecto desde GitHub y usa:

- Root Directory: `CruChef`
- Build Command: `npm run build`
- Output Directory: `dist/CruChef/browser`

Variables de entorno en Vercel:

```env
CRUCHEF_API_BASE_URL=https://TU_BACKEND_NODE/api
CRUCHEF_VOICE_BACKEND_URL=https://TU_BACKEND_VOZ
CRUCHEF_ADMIN_EMAILS=davidgarciaparada2020@gmail.com
```

Opcionalmente puedes definir las variables públicas de Firebase si cambias de proyecto:

```env
CRUCHEF_FIREBASE_API_KEY=
CRUCHEF_FIREBASE_AUTH_DOMAIN=
CRUCHEF_FIREBASE_PROJECT_ID=
CRUCHEF_FIREBASE_STORAGE_BUCKET=
CRUCHEF_FIREBASE_MESSAGING_SENDER_ID=
CRUCHEF_FIREBASE_APP_ID=
```

El script `CruChef/scripts/write-env.mjs` genera `src/app/environment.ts` durante el build usando esas variables. En local, si no existen, mantiene `localhost`.

## 5. Orden recomendado

1. Rotar claves expuestas.
2. Desplegar `cruchef-api`.
3. Desplegar `cruchef-voice`.
4. Copiar ambas URLs públicas.
5. Configurar las variables de Vercel.
6. Desplegar Angular.
7. Probar login, inventario, creación de platos, notificaciones e IA Voz.
