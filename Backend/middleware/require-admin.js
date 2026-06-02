const { isAdminEmail } = require('../config/admin');

function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.authUser?.email)) {
    return res.status(403).json({
      message: 'No tienes permisos para acceder a la administracion.',
    });
  }

  return next();
}

module.exports = {
  requireAdmin,
};
