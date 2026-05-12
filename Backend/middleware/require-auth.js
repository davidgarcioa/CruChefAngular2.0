const { admin } = require('../config/firebase');

async function requireAuth(req, res, next) {
  const authorizationHeader =
    typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      message: 'La sesion no es valida. Inicia sesion de nuevo.',
    });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(match[1]);
    req.authUser = decodedToken;
    return next();
  } catch (error) {
    console.error('No se pudo validar el token de Firebase.', error);
    return res.status(401).json({
      message: 'La sesion expiro o no es valida. Inicia sesion otra vez.',
    });
  }
}

module.exports = {
  requireAuth,
};
