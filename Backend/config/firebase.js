const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');

let db = null;
let firebaseInitError = null;

function parseServiceAccountJson(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  const serviceAccount = JSON.parse(rawValue);
  if (
    serviceAccount &&
    typeof serviceAccount.private_key === 'string' &&
    serviceAccount.private_key.includes('\\n')
  ) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  return serviceAccount;
}

function loadServiceAccountFromEnvironment() {
  const jsonValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonValue) {
    return parseServiceAccountJson(jsonValue);
  }

  const base64Value = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64Value) {
    const decodedValue = Buffer.from(base64Value, 'base64').toString('utf8');
    return parseServiceAccountJson(decodedValue);
  }

  return null;
}

try {
  const hasServiceAccount = fs.existsSync(serviceAccountPath);
  const environmentServiceAccount = loadServiceAccountFromEnvironment();
  const hasApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!environmentServiceAccount && !hasServiceAccount && !hasApplicationDefault) {
    throw new Error(
      'No se encontro FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, Backend/firebase-key.json ni GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  const credential = environmentServiceAccount
    ? admin.credential.cert(environmentServiceAccount)
    : hasServiceAccount
      ? admin.credential.cert(require(serviceAccountPath))
      : admin.credential.applicationDefault();

  admin.initializeApp({ credential });
  db = admin.firestore();
} catch (error) {
  firebaseInitError = error;
  console.error(
    'No se pudo inicializar Firebase Admin. Define FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, Backend/firebase-key.json o GOOGLE_APPLICATION_CREDENTIALS.',
    error,
  );
}

module.exports = {
  admin,
  db,
  firebaseInitError,
};
