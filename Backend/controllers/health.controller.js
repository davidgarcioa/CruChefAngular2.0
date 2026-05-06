const { db } = require('../config/firebase');

function getHealth(req, res) {
  res.json({
    ok: Boolean(db),
    firebaseConfigured: Boolean(db),
    message: db
      ? 'Firebase Admin inicializado.'
      : 'Falta configurar firebase-key.json o GOOGLE_APPLICATION_CREDENTIALS.',
  });
}

module.exports = {
  getHealth,
};
