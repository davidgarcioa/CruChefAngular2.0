const { admin, db } = require('../config/firebase');
const {
  normalizeOrderPayload,
  normalizeStatusPayload,
  normalizeRatingPayload,
} = require('../utils/normalize-order-payload');
const notificationService = require('./notification.service');

const statusNotificationMap = {
  pending: {
    title: 'Pedido recibido',
    message: 'Tu pedido fue enviado al restaurante.',
  },
  accepted: {
    title: 'Pedido aceptado',
    message: 'El restaurante acepto tu pedido.',
  },
  preparing: {
    title: 'Pedido en preparacion',
    message: 'Tu pedido ya esta en preparacion.',
  },
  ready: {
    title: 'Pedido listo',
    message: 'Tu pedido esta listo.',
  },
  delivered: {
    title: 'Pedido entregado',
    message: 'Tu pedido fue marcado como entregado. Ya puedes calificarlo.',
  },
  cancelled: {
    title: 'Pedido cancelado',
    message: 'El restaurante cancelo tu pedido.',
  },
};

async function createNotificationSafely(payload) {
  try {
    await notificationService.createNotification(payload);
  } catch (error) {
    console.error('No se pudo crear la notificacion del pedido.', error);
  }
}

async function upsertOrderNotificationSafely(payload) {
  try {
    await notificationService.upsertOrderNotification(payload);
  } catch (error) {
    console.error('No se pudo actualizar la notificacion del pedido.', error);
  }
}

async function listOrders(filters = {}) {
  let query = db.collection('orders');

  if (filters.ownerUid) {
    query = query.where('ownerUid', '==', filters.ownerUid);
  }

  if (filters.customerUid) {
    query = query.where('customerUid', '==', filters.customerUid);
  }

  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }

  const snapshot = await query.get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((left, right) => {
      const leftMs = left.createdAt?.toMillis ? left.createdAt.toMillis() : 0;
      const rightMs = right.createdAt?.toMillis ? right.createdAt.toMillis() : 0;
      return rightMs - leftMs;
    });
}

async function createOrder(body) {
  const payload = normalizeOrderPayload(body);
  const document = await db.collection('orders').add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    deliveredAt: null,
  });

  const snapshot = await document.get();
  const createdOrder = {
    id: document.id,
    ...snapshot.data(),
  };

  await createNotificationSafely({
    recipientUid: payload.ownerUid,
    audience: 'owner',
    type: 'order-created',
    title: 'Nuevo pedido recibido',
    message: `${payload.customerName} pidio ${payload.quantity} x ${payload.dishName}. Pago: ${payload.paymentMethod === 'cash' ? 'pendiente' : 'aprobado'}.`,
    orderId: document.id,
    restaurantId: payload.restaurantId,
    restaurantName: payload.restaurantName,
    dishName: payload.dishName,
  });

  return createdOrder;
}

async function updateOrderStatus(id, body) {
  const documentRef = db.collection('orders').doc(id);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const { status } = normalizeStatusPayload(body);
  const order = snapshot.data();
  await documentRef.update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    deliveredAt:
      status === 'delivered' ? admin.firestore.FieldValue.serverTimestamp() : null,
  });

  const updatedSnapshot = await documentRef.get();
  const updatedOrder = {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };

  const notification = statusNotificationMap[status];
  if (notification) {
    await upsertOrderNotificationSafely({
      recipientUid: order.customerUid,
      audience: 'user',
      type: `order-${status}`,
      title: notification.title,
      message: `${notification.message} Plato: ${order.dishName}.`,
      orderId: id,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName,
      dishName: order.dishName,
    });
  }

  return updatedOrder;
}

async function rateOrder(id, body) {
  const documentRef = db.collection('orders').doc(id);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const order = snapshot.data();
  if (order.status !== 'delivered') {
    throw new Error('Solo se pueden calificar ordenes entregadas.');
  }

  if (order.rating != null) {
    throw new Error('La orden ya fue calificada.');
  }

  const { rating, reviewText } = normalizeRatingPayload(body);

  await documentRef.update({
    rating,
    reviewText,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await documentRef.get();
  const updatedOrder = {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };

  await createNotificationSafely({
    recipientUid: order.ownerUid,
    audience: 'owner',
    type: 'order-rated',
    title: 'Nueva calificacion recibida',
    message: `${order.customerName} califico ${order.dishName} con ${rating}/5.`,
    orderId: id,
    restaurantId: order.restaurantId,
    restaurantName: order.restaurantName,
    dishName: order.dishName,
  });

  return updatedOrder;
}

module.exports = {
  listOrders,
  createOrder,
  updateOrderStatus,
  rateOrder,
};
