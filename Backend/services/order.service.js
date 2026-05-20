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

function ownerRestaurantDocument(ownerUid, restaurantId) {
  return db.collection('users').doc(ownerUid).collection('restaurants').doc(restaurantId);
}

function mapOrderSnapshot(document) {
  return {
    id: document.id,
    ...document.data(),
  };
}

async function notifyInventoryIfNeededSafely(ownerUid, order, item) {
  if (item.quantity > item.minimum) {
    return;
  }

  await createNotificationSafely({
    recipientUid: ownerUid,
    audience: 'owner',
    type: item.quantity === 0 ? 'inventory-empty' : 'inventory-low',
    title: item.quantity === 0 ? 'Insumo agotado' : 'Inventario bajo',
    message: `${item.name} esta en ${item.quantity} ${item.unit}. Minimo: ${item.minimum} ${item.unit}.`,
    restaurantId: order.restaurantId,
    restaurantName: order.restaurantName,
  });
}

async function createOrder(body) {
  const payload = normalizeOrderPayload(body);
  const orderRef = db.collection('orders').doc();
  const dishRef = ownerRestaurantDocument(payload.ownerUid, payload.restaurantId)
    .collection('dishes')
    .doc(payload.dishId);

  const lowInventoryCandidates = await db.runTransaction(async (transaction) => {
    const dishSnapshot = await transaction.get(dishRef);

    if (!dishSnapshot.exists) {
      throw new Error('La orden requiere un plato valido.');
    }

    const dishData = dishSnapshot.data();
    const stockRequirements = Array.isArray(dishData.stockRequirements)
      ? dishData.stockRequirements
          .map((requirement) => ({
            itemId: typeof requirement.itemId === 'string' ? requirement.itemId : '',
            name: typeof requirement.name === 'string' ? requirement.name : '',
            unit: typeof requirement.unit === 'string' ? requirement.unit : '',
            quantity: Number(requirement.quantity || 0),
          }))
          .filter((requirement) => requirement.itemId && requirement.quantity > 0)
      : [];

    const inventoryRefs = stockRequirements.map((requirement) =>
      ownerRestaurantDocument(payload.ownerUid, payload.restaurantId)
        .collection('inventory')
        .doc(requirement.itemId),
    );
    const inventorySnapshots = await Promise.all(
      inventoryRefs.map((inventoryRef) => transaction.get(inventoryRef)),
    );

    const nextLowInventoryCandidates = [];

    const stockMovements = stockRequirements.map((requirement, index) => {
      const inventorySnapshot = inventorySnapshots[index];

      if (!inventorySnapshot.exists) {
        throw new Error(`El insumo ${requirement.name || requirement.itemId} ya no existe en inventario.`);
      }

      const inventoryData = inventorySnapshot.data();
      const currentQuantity = Number(inventoryData.quantity || 0);
      const minimum = Number(inventoryData.minimum || 0);
      const requiredQuantity = requirement.quantity * payload.quantity;
      const nextQuantity = Number((currentQuantity - requiredQuantity).toFixed(3));

      if (nextQuantity < 0) {
        throw new Error(
          `Stock insuficiente para ${inventoryData.name || requirement.name}. Disponible: ${currentQuantity} ${inventoryData.unit || requirement.unit}.`,
        );
      }

      const movement = {
        itemId: requirement.itemId,
        name: typeof inventoryData.name === 'string' ? inventoryData.name : requirement.name,
        unit: typeof inventoryData.unit === 'string' ? inventoryData.unit : requirement.unit,
        quantityPerDish: requirement.quantity,
        deductedQuantity: requiredQuantity,
        quantityBefore: currentQuantity,
        quantityAfter: nextQuantity,
        minimum,
      };

      nextLowInventoryCandidates.push({
        name: movement.name,
        unit: movement.unit,
        quantity: nextQuantity,
        minimum,
      });

      return movement;
    });

    stockMovements.forEach((movement, index) => {
      transaction.update(inventoryRefs[index], {
        quantity: movement.quantityAfter,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    transaction.create(orderRef, {
      ...payload,
      stockRequirements,
      stockMovements,
      stockDeducted: stockMovements.length > 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deliveredAt: null,
    });

    return nextLowInventoryCandidates;
  });

  const snapshot = await orderRef.get();
  const createdOrder = mapOrderSnapshot(snapshot);

  await createNotificationSafely({
    recipientUid: payload.ownerUid,
    audience: 'owner',
    type: 'order-created',
    title: 'Nuevo pedido recibido',
    message: `${payload.customerName} pidio ${payload.quantity} x ${payload.dishName}. Pago: ${payload.paymentMethod === 'cash' ? 'pendiente' : 'aprobado'}.`,
    orderId: orderRef.id,
    restaurantId: payload.restaurantId,
    restaurantName: payload.restaurantName,
    dishName: payload.dishName,
  });

  await Promise.all(
    lowInventoryCandidates.map((item) =>
      notifyInventoryIfNeededSafely(payload.ownerUid, payload, item),
    ),
  );

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
