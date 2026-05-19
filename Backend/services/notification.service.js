const { admin, db } = require('../config/firebase');

const VALID_AUDIENCES = new Set(['owner', 'user']);

function normalizeNotificationPayload(body) {
  const recipientUid = typeof body.recipientUid === 'string' ? body.recipientUid.trim() : '';
  const audience = typeof body.audience === 'string' ? body.audience.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : 'system';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!recipientUid) {
    throw new Error('La notificacion requiere un destinatario valido.');
  }

  if (!VALID_AUDIENCES.has(audience)) {
    throw new Error('La notificacion requiere una audiencia valida.');
  }

  if (title.length < 2 || message.length < 2) {
    throw new Error('La notificacion requiere titulo y mensaje.');
  }

  return {
    recipientUid,
    audience,
    type,
    title,
    message,
    orderId: typeof body.orderId === 'string' ? body.orderId.trim() : '',
    restaurantId: typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '',
    restaurantName: typeof body.restaurantName === 'string' ? body.restaurantName.trim() : '',
    dishName: typeof body.dishName === 'string' ? body.dishName.trim() : '',
  };
}

function mapNotificationSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function getNotificationTime(notification) {
  const updatedMs = notification.updatedAt?.toMillis ? notification.updatedAt.toMillis() : 0;
  const createdMs = notification.createdAt?.toMillis ? notification.createdAt.toMillis() : 0;
  return updatedMs || createdMs;
}

function collapseRepeatedOrderNotifications(notifications, audience) {
  if (audience !== 'user') {
    return notifications;
  }

  const seenOrderIds = new Set();
  return notifications.filter((notification) => {
    const isOrderNotification =
      typeof notification.orderId === 'string' &&
      notification.orderId.length > 0 &&
      typeof notification.type === 'string' &&
      notification.type.startsWith('order-');

    if (!isOrderNotification) {
      return true;
    }

    if (seenOrderIds.has(notification.orderId)) {
      return false;
    }

    seenOrderIds.add(notification.orderId);
    return true;
  });
}

async function createNotification(body) {
  const payload = normalizeNotificationPayload(body);
  const document = await db.collection('notifications').add({
    ...payload,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const snapshot = await document.get();
  return mapNotificationSnapshot(snapshot);
}

async function upsertOrderNotification(body) {
  const payload = normalizeNotificationPayload(body);

  if (!payload.orderId) {
    throw new Error('La notificacion del pedido requiere una orden valida.');
  }

  const snapshot = await db
    .collection('notifications')
    .where('recipientUid', '==', payload.recipientUid)
    .where('audience', '==', payload.audience)
    .where('orderId', '==', payload.orderId)
    .get();

  if (snapshot.empty) {
    return createNotification(payload);
  }

  const existingDocument = snapshot.docs
    .map((document) => ({ document, notification: document.data() }))
    .sort((left, right) => getNotificationTime(right.notification) - getNotificationTime(left.notification))[0]
    .document;

  await existingDocument.ref.update({
    ...payload,
    read: false,
    readAt: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await existingDocument.ref.get();
  return mapNotificationSnapshot(updatedSnapshot);
}

async function listNotifications(filters = {}) {
  const recipientUid = typeof filters.recipientUid === 'string' ? filters.recipientUid.trim() : '';
  const audience = typeof filters.audience === 'string' ? filters.audience.trim() : '';

  if (!recipientUid) {
    throw new Error('La notificacion requiere un destinatario valido.');
  }

  const query = db.collection('notifications').where('recipientUid', '==', recipientUid);

  const snapshot = await query.get();
  const notifications = snapshot.docs
    .map(mapNotificationSnapshot)
    .filter((notification) => (VALID_AUDIENCES.has(audience) ? notification.audience === audience : true))
    .sort((left, right) => {
      return getNotificationTime(right) - getNotificationTime(left);
    });

  return collapseRepeatedOrderNotifications(notifications, audience);
}

async function markNotificationRead(id) {
  const documentRef = db.collection('notifications').doc(id);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  await documentRef.update({
    read: true,
    readAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await documentRef.get();
  return mapNotificationSnapshot(updatedSnapshot);
}

async function markAllRead(filters = {}) {
  const notifications = await listNotifications(filters);
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  if (unreadNotifications.length === 0) {
    return { updated: 0 };
  }

  const batch = db.batch();
  unreadNotifications.forEach((notification) => {
    batch.update(db.collection('notifications').doc(notification.id), {
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  return { updated: unreadNotifications.length };
}

module.exports = {
  createNotification,
  upsertOrderNotification,
  listNotifications,
  markNotificationRead,
  markAllRead,
};
