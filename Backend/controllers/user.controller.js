const userService = require('../services/user.service');

function resolveUserControllerError(error, fallbackMessage) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      message: fallbackMessage,
    };
  }

  if (error.message === 'El rol seleccionado no es valido.') {
    return {
      status: 400,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: error.message || fallbackMessage,
  };
}

async function postRegisterProfile(req, res) {
  try {
    const profile = await userService.syncRegisterProfile(req.authUser, req.body);
    return res.status(201).json(profile);
  } catch (error) {
    const resolved = resolveUserControllerError(
      error,
      'No se pudo guardar el perfil del usuario.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function postLoginProfile(req, res) {
  try {
    const profile = await userService.syncLoginProfile(req.authUser, req.body);
    return res.json(profile);
  } catch (error) {
    const resolved = resolveUserControllerError(
      error,
      'No se pudo actualizar el perfil del usuario.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function postSelectedRole(req, res) {
  try {
    const profile = await userService.setSelectedRole(req.authUser, req.body);
    return res.json(profile);
  } catch (error) {
    const resolved = resolveUserControllerError(
      error,
      'No se pudo guardar el rol del usuario.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

module.exports = {
  postRegisterProfile,
  postLoginProfile,
  postSelectedRole,
};
