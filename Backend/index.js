const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const port = Number(process.env.PORT || 3000);
const serviceAccountPath = path.join(__dirname, 'firebase-key.json');

let db = null;
let firebaseInitError = null;

try {
  const hasServiceAccount = fs.existsSync(serviceAccountPath);
  const hasApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!hasServiceAccount && !hasApplicationDefault) {
    throw new Error(
      'No se encontro Backend/firebase-key.json ni GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  const credential = hasServiceAccount
    ? admin.credential.cert(require(serviceAccountPath))
    : admin.credential.applicationDefault();

  admin.initializeApp({ credential });
  db = admin.firestore();
} catch (error) {
  firebaseInitError = error;
  console.error(
    'No se pudo inicializar Firebase Admin. Agrega Backend/firebase-key.json o define GOOGLE_APPLICATION_CREDENTIALS.',
    error,
  );
}

app.use(cors());
app.use(express.json());

function requireFirestore(req, res, next) {
  if (db) {
    return next();
  }

  return res.status(500).json({
    message:
      'Firebase Admin no esta configurado. Agrega Backend/firebase-key.json o define GOOGLE_APPLICATION_CREDENTIALS.',
    detail: firebaseInitError instanceof Error ? firebaseInitError.message : 'unknown',
  });
}

function normalizeDishPayload(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const restaurant = typeof body.restaurant === 'string' ? body.restaurant.trim() : '';
  const price = Number(body.price);
  const rating = Number(body.rating);
  const categoryId =
    typeof body.categoryId === 'string' && body.categoryId.trim().length > 0
      ? body.categoryId.trim()
      : '';
  const imageKey =
    typeof body.imageKey === 'string' && body.imageKey.trim().length > 0
      ? body.imageKey.trim()
      : '';
  const imageUrl =
    typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0
      ? body.imageUrl.trim()
      : '';

  if (name.length < 2) {
    throw new Error('El nombre del plato no es valido.');
  }

  if (restaurant.length < 2) {
    throw new Error('El restaurante no es valido.');
  }

  if (!Number.isFinite(price) || price < 1000) {
    throw new Error('El precio no es valido.');
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('La calificacion debe estar entre 1 y 5.');
  }

  if (!categoryId) {
    throw new Error('La categoria es obligatoria.');
  }

  if (!imageKey || !imageUrl) {
    throw new Error('La imagen del plato es obligatoria.');
  }

  return {
    name,
    restaurant,
    price,
    rating,
    categoryId,
    imageKey,
    imageUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

app.get('/', (req, res) => {
  res.send('El servidor de CruChef esta vivo');
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: Boolean(db),
    firebaseConfigured: Boolean(db),
    message: db
      ? 'Firebase Admin inicializado.'
      : 'Falta configurar firebase-key.json o GOOGLE_APPLICATION_CREDENTIALS.',
  });
});

app.get('/api/dishes', requireFirestore, async (req, res) => {
  try {
    const snapshot = await db.collection('dishes').orderBy('name').get();
    const dishes = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));

    res.json(dishes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    res.status(500).json({ message: `No se pudieron cargar los platos: ${message}` });
  }
});

app.post('/api/dishes', requireFirestore, async (req, res) => {
  try {
    const payload = {
      ...normalizeDishPayload(req.body),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const document = await db.collection('dishes').add(payload);
    const snapshot = await document.get();

    res.status(201).json({
      id: document.id,
      ...snapshot.data(),
    });
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo crear el plato.';
    res.status(status).json({ message });
  }
});

app.put('/api/dishes/:id', requireFirestore, async (req, res) => {
  try {
    const documentRef = db.collection('dishes').doc(req.params.id);
    const snapshot = await documentRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ message: 'El plato no existe.' });
    }

    await documentRef.update(normalizeDishPayload(req.body));
    const updatedSnapshot = await documentRef.get();

    return res.json({
      id: updatedSnapshot.id,
      ...updatedSnapshot.data(),
    });
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el plato.';
    return res.status(status).json({ message });
  }
});

app.delete('/api/dishes/:id', requireFirestore, async (req, res) => {
  try {
    const documentRef = db.collection('dishes').doc(req.params.id);
    const snapshot = await documentRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ message: 'El plato no existe.' });
    }

    await documentRef.delete();
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el plato.';
    return res.status(500).json({ message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
