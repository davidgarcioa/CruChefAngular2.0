# Evidencia de pruebas de endpoints

Fecha de ejecucion: 2026-04-07 10:37 -05:00

Entorno probado:
- Node API: `http://localhost:3000/api`
- Python API: `http://localhost:8000`

Notas:
- Las rutas protegidas `/owner/*` se probaron con `Authorization: Bearer <idToken>`.
- Para la evidencia CRUD se creo un restaurante temporal y un plato temporal.
- Ambos recursos temporales fueron eliminados al final de la prueba.

## Node API

| Metodo | Endpoint | Resultado |
| --- | --- | --- |
| GET | `/health` | `200` - `ok=True, firebaseConfigured=True` |
| GET | `/public/restaurants` | `200` - `count=3, first=Angloburguer` |
| GET | `/public/restaurants/i2QDLqoWnfhpjrhT1LhGx5W0XbB3/aBeIdkoWt8JxmJxIA0QY/dishes` | `200` - `count=1, first=Hamburguesa Triple Carne` |
| GET | `/owner/restaurants` sin token | `401` - ruta protegida |
| GET | `/owner/restaurants` con token | `200` - `count=1, first=Angloburguer` |
| POST | `/owner/restaurants` | `201` - `id=5QPhErgn7NRQOTwOeo7p, name=ZZ Evidencia API 20260407103639` |
| PUT | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p` | `200` - `schedule=Lun - Sab 8:00 - 20:00` |
| GET | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p/dishes` | `200` - `count=0` |
| POST | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p/dishes` | `201` - `id=zPbosDAMW3KZhNLw1uUl, name=Plato Evidencia, category=pizza` |
| GET | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p/dishes` | `200` - `count=1, first=Plato Evidencia` |
| PUT | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p/dishes/zPbosDAMW3KZhNLw1uUl` | `200` - `name=Plato Evidencia Editado, price=26500, category=tacos` |
| GET | `/orders?ownerUid=i2QDLqoWnfhpjrhT1LhGx5W0XbB3` | `200` - `count=0` |
| DELETE | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p/dishes/zPbosDAMW3KZhNLw1uUl` | `204` - plato temporal eliminado |
| DELETE | `/owner/restaurants/5QPhErgn7NRQOTwOeo7p` | `204` - restaurante temporal eliminado |

## Python API

| Metodo | Endpoint | Resultado |
| --- | --- | --- |
| GET | `/health` | `200` - `status=healthy, openai_available=True, firebase_available=True` |
| POST | `/transcribe-only` sin archivo | `400` - `{\"message\":\"No file provided\",\"success\":false}` |

## Respuestas de referencia

### GET `http://localhost:3000/api/health`

```json
{
  "ok": true,
  "firebaseConfigured": true,
  "message": "Firebase Admin inicializado."
}
```

### GET `http://localhost:8000/health`

```json
{
  "firebase_available": true,
  "openai_available": true,
  "status": "healthy"
}
```

### POST `http://localhost:8000/transcribe-only`

Request sin `file`.

```json
{
  "message": "No file provided",
  "success": false
}
```
