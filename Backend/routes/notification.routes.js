const express = require('express');
const {
  getNotifications,
  patchNotificationRead,
  patchAllNotificationsRead,
} = require('../controllers/notification.controller');
const { requireFirestore } = require('../middleware/require-firestore');

const router = express.Router();

router.get('/notifications', requireFirestore, getNotifications);
router.patch('/notifications/read-all', requireFirestore, patchAllNotificationsRead);
router.patch('/notifications/:id/read', requireFirestore, patchNotificationRead);

module.exports = router;
