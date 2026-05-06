const { admin, db } = require('../config/firebase');
const {
  normalizeOrderPayload,
  normalizeStatusPayload,
  normalizeRatingPayload,
} = require('../utils/normalize-order-payload');

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
  return {
    id: document.id,
    ...snapshot.data(),
  };
}

async function updateOrderStatus(id, body) {
  const documentRef = db.collection('orders').doc(id);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const { status } = normalizeStatusPayload(body);
  await documentRef.update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    deliveredAt:
      status === 'delivered' ? admin.firestore.FieldValue.serverTimestamp() : null,
  });

  const updatedSnapshot = await documentRef.get();
  return {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };
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
  return {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };
}

module.exports = {
  listOrders,
  createOrder,
  updateOrderStatus,
  rateOrder,
};
