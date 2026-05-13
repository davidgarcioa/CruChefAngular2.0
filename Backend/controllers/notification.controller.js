const notificationService = require('../services/notification.service');

const validationMessages = new Set([
  'La notificacion requiere un destinatario valido.',
  'La notificacion requiere una audiencia valida.',
  'La notificacion requiere titulo y mensaje.',
]);

function resolveNotificationError(error, fallbackMessage) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      message: fallbackMessage,
    };
  }

  if (validationMessages.has(error.message)) {
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

async function getNotifications(req, res) {
  try {
    const notifications = await notificationService.listNotifications({
      recipientUid: typeof req.query.recipientUid === 'string' ? req.query.recipientUid : '',
      audience: typeof req.query.audience === 'string' ? req.query.audience : '',
    });
    return res.json(notifications);
  } catch (error) {
    const resolved = resolveNotificationError(error, 'No se pudieron cargar las notificaciones.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function patchNotificationRead(req, res) {
  try {
    const notification = await notificationService.markNotificationRead(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'La notificacion no existe.' });
    }

    return res.json(notification);
  } catch (error) {
    const resolved = resolveNotificationError(error, 'No se pudo actualizar la notificacion.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function patchAllNotificationsRead(req, res) {
  try {
    const result = await notificationService.markAllRead({
      recipientUid: typeof req.body.recipientUid === 'string' ? req.body.recipientUid : '',
      audience: typeof req.body.audience === 'string' ? req.body.audience : '',
    });
    return res.json(result);
  } catch (error) {
    const resolved = resolveNotificationError(error, 'No se pudieron actualizar las notificaciones.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

module.exports = {
  getNotifications,
  patchNotificationRead,
  patchAllNotificationsRead,
};
