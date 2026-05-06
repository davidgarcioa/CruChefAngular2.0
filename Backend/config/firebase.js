const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');

let db = null;
let firebaseInitError = null;

try {
  const hasServiceAccount = fs.existsSync(serviceAccountPath);

  if (hasServiceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
    });
  } else {
    admin.initializeApp();
  }

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
