const { db, firebaseInitError } = require('../config/firebase');

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

module.exports = {
  requireFirestore,
};
