const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');

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

module.exports = {
  admin,
  db,
  firebaseInitError,
};
