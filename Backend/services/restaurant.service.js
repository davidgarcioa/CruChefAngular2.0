const { admin, db } = require('../config/firebase');
const { normalizeRestaurantPayload } = require('../utils/normalize-restaurant-payload');
const { normalizeOwnerDishPayload } = require('../utils/normalize-owner-dish-payload');
const { normalizeInventoryPayload } = require('../utils/normalize-inventory-payload');
const notificationService = require('./notification.service');

function ownerRestaurantsCollection(ownerUid) {
  return db.collection('users').doc(ownerUid).collection('restaurants');
}

function ownerRestaurantDocument(ownerUid, restaurantId) {
  return ownerRestaurantsCollection(ownerUid).doc(restaurantId);
}

function ownerDishesCollection(ownerUid, restaurantId) {
  return ownerRestaurantDocument(ownerUid, restaurantId).collection('dishes');
}

function ownerInventoryCollection(ownerUid, restaurantId) {
  return ownerRestaurantDocument(ownerUid, restaurantId).collection('inventory');
}

async function deleteCollectionDocuments(collectionRef) {
  let snapshot = await collectionRef.limit(500).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });
    await batch.commit();
    snapshot = await collectionRef.limit(500).get();
  }
}

function mapRestaurant(document, ownerUid, ownerEmailFallback = '') {
  const data = document.data();

  return {
    id: document.id,
    ownerUid,
    ownerEmail:
      typeof data.ownerEmail === 'string' ? data.ownerEmail : ownerEmailFallback,
    name: typeof data.name === 'string' ? data.name : '',
    address: typeof data.address === 'string' ? data.address : '',
    city: typeof data.city === 'string' ? data.city : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    schedule: typeof data.schedule === 'string' ? data.schedule : '',
    rut: typeof data.rut === 'string' ? data.rut : '',
    rutFileName: typeof data.rutFileName === 'string' ? data.rutFileName : '',
    rutFileType: typeof data.rutFileType === 'string' ? data.rutFileType : '',
    rutFileSize: Number(data.rutFileSize || 0),
    verificationStatus:
      data.verificationStatus === 'verified' ? 'verified' : 'pending',
  };
}

function mapDish(document, restaurantId) {
  const data = document.data();
  const rawStockRequirements = Array.isArray(data.stockRequirements)
    ? data.stockRequirements
    : [];

  return {
    id: document.id,
    name: typeof data.name === 'string' ? data.name : '',
    price: Number(data.price || 0),
    rating: Number(data.rating || 0),
    ratingCount: Number(data.ratingCount || 0),
    ratingTotal: Number(data.ratingTotal || 0),
    restaurant:
      typeof data.restaurant === 'string'
        ? data.restaurant
        : typeof data.restaurantName === 'string'
          ? data.restaurantName
          : '',
    restaurantId:
      typeof data.restaurantId === 'string' ? data.restaurantId : restaurantId,
    restaurantName:
      typeof data.restaurantName === 'string'
        ? data.restaurantName
        : typeof data.restaurant === 'string'
          ? data.restaurant
          : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    imageKey: typeof data.imageKey === 'string' ? data.imageKey : 'plate',
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : 'burgers',
    stockRequirements: rawStockRequirements
      .map((requirement) => ({
        itemId: typeof requirement.itemId === 'string' ? requirement.itemId : '',
        name: typeof requirement.name === 'string' ? requirement.name : '',
        unit: typeof requirement.unit === 'string' ? requirement.unit : '',
        quantity: Number(requirement.quantity || 0),
      }))
      .filter((requirement) => requirement.itemId && requirement.quantity > 0),
  };
}

function mapInventoryItem(document) {
  const data = document.data();

  return {
    id: document.id,
    name: typeof data.name === 'string' ? data.name : '',
    unit: typeof data.unit === 'string' ? data.unit : '',
    quantity: Number(data.quantity || 0),
    minimum: Number(data.minimum || 0),
    updatedAt: data.updatedAt || null,
  };
}

async function notifyInventoryIfNeeded(authUser, restaurant, item) {
  if (item.quantity > item.minimum) {
    return;
  }

  await createNotificationSafely({
    recipientUid: authUser.uid,
    audience: 'owner',
    type: item.quantity === 0 ? 'inventory-empty' : 'inventory-low',
    title: item.quantity === 0 ? 'Insumo agotado' : 'Inventario bajo',
    message: `${item.name} esta en ${item.quantity} ${item.unit}. Minimo: ${item.minimum} ${item.unit}.`,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
  });
}

async function createNotificationSafely(payload) {
  try {
    await notificationService.createNotification(payload);
  } catch (error) {
    console.error('No se pudo crear la notificacion.', error);
  }
}

async function resolveDishStockRequirements(authUser, restaurantId, requirements) {
  if (!requirements.length) {
    return [];
  }

  const resolvedRequirements = [];

  for (const requirement of requirements) {
    const itemRef = ownerInventoryCollection(authUser.uid, restaurantId).doc(requirement.itemId);
    const itemSnapshot = await itemRef.get();

    if (!itemSnapshot.exists) {
      throw new Error('Selecciona insumos validos para la receta del plato.');
    }

    const item = mapInventoryItem(itemSnapshot);
    resolvedRequirements.push({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      quantity: requirement.quantity,
    });
  }

  return resolvedRequirements;
}

async function loadRestaurant(ownerUid, restaurantId) {
  const snapshot = await ownerRestaurantDocument(ownerUid, restaurantId).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function listOwnerRestaurants(authUser) {
  const snapshot = await ownerRestaurantsCollection(authUser.uid).orderBy('name').get();

  return snapshot.docs.map((document) =>
    mapRestaurant(document, authUser.uid, authUser.email || ''),
  );
}

async function createOwnerRestaurant(authUser, body = {}) {
  const payload = normalizeRestaurantPayload(body);
  const documentRef = await ownerRestaurantsCollection(authUser.uid).add({
    ...payload,
    ownerUid: authUser.uid,
    ownerEmail: authUser.email || '',
    verificationStatus: 'pending',
  });

  const snapshot = await documentRef.get();
  return mapRestaurant(snapshot, authUser.uid, authUser.email || '');
}

async function updateOwnerRestaurant(authUser, restaurantId, body = {}) {
  const documentRef = ownerRestaurantDocument(authUser.uid, restaurantId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  await documentRef.update({
    ...normalizeRestaurantPayload(body),
    ownerUid: authUser.uid,
    ownerEmail: authUser.email || '',
  });

  const updatedSnapshot = await documentRef.get();
  return mapRestaurant(updatedSnapshot, authUser.uid, authUser.email || '');
}

async function deleteOwnerRestaurant(authUser, restaurantId) {
  const documentRef = ownerRestaurantDocument(authUser.uid, restaurantId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  await deleteCollectionDocuments(ownerDishesCollection(authUser.uid, restaurantId));
  await deleteCollectionDocuments(ownerInventoryCollection(authUser.uid, restaurantId));
  await deleteCollectionDocuments(documentRef.collection('orders'));
  await documentRef.delete();
  return true;
}

async function listAdminRestaurants() {
  const snapshot = await db.collectionGroup('restaurants').get();

  return snapshot.docs
    .map((document) =>
      mapRestaurant(
        document,
        document.ref.parent.parent ? document.ref.parent.parent.id : '',
      ),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function verifyAdminRestaurant(ownerUid, restaurantId) {
  const documentRef = ownerRestaurantDocument(ownerUid, restaurantId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  await documentRef.update({
    verificationStatus: 'verified',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await documentRef.get();
  return mapRestaurant(updatedSnapshot, ownerUid);
}

async function listAdminRestaurantDishes(ownerUid, restaurantId) {
  const restaurant = await loadRestaurant(ownerUid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const snapshot = await ownerDishesCollection(ownerUid, restaurantId).orderBy('name').get();
  return snapshot.docs.map((document) => mapDish(document, restaurantId));
}

async function deleteAdminRestaurant(ownerUid, restaurantId) {
  const documentRef = ownerRestaurantDocument(ownerUid, restaurantId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  await deleteCollectionDocuments(ownerDishesCollection(ownerUid, restaurantId));
  await deleteCollectionDocuments(ownerInventoryCollection(ownerUid, restaurantId));
  await deleteCollectionDocuments(documentRef.collection('orders'));
  await documentRef.delete();
  return true;
}

async function listOwnerDishes(authUser, restaurantId) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const snapshot = await ownerDishesCollection(authUser.uid, restaurantId).orderBy('name').get();
  return snapshot.docs.map((document) => mapDish(document, restaurantId));
}

async function createOwnerDish(authUser, restaurantId, body = {}) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const payload = normalizeOwnerDishPayload(body, restaurant);
  const stockRequirements = await resolveDishStockRequirements(
    authUser,
    restaurantId,
    payload.stockRequirements,
  );

  const documentRef = await ownerDishesCollection(authUser.uid, restaurantId).add({
    ...payload,
    stockRequirements,
    rating: 0,
    ratingCount: 0,
    ratingTotal: 0,
  });

  const snapshot = await documentRef.get();
  const dish = mapDish(snapshot, restaurantId);

  await createNotificationSafely({
    recipientUid: authUser.uid,
    audience: 'owner',
    type: 'dish-created',
    title: 'Plato creado',
    message: `${dish.name} fue creado en ${restaurant.name}. El inventario se descontara cuando entren pedidos.`,
    restaurantId,
    restaurantName: restaurant.name,
    dishName: dish.name,
  });

  return dish;
}

async function updateOwnerDish(authUser, restaurantId, dishId, body = {}) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const documentRef = ownerDishesCollection(authUser.uid, restaurantId).doc(dishId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  const payload = normalizeOwnerDishPayload(body, restaurant);
  const stockRequirements = await resolveDishStockRequirements(
    authUser,
    restaurantId,
    payload.stockRequirements,
  );

  await documentRef.update({
    ...payload,
    stockRequirements,
  });
  const updatedSnapshot = await documentRef.get();
  return mapDish(updatedSnapshot, restaurantId);
}

async function deleteOwnerDish(authUser, restaurantId, dishId) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const documentRef = ownerDishesCollection(authUser.uid, restaurantId).doc(dishId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  await documentRef.delete();
  return true;
}

async function listOwnerInventory(authUser, restaurantId) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const snapshot = await ownerInventoryCollection(authUser.uid, restaurantId).orderBy('name').get();
  return snapshot.docs.map((document) => mapInventoryItem(document));
}

async function createOwnerInventoryItem(authUser, restaurantId, body = {}) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const payload = normalizeInventoryPayload(body);
  const documentRef = await ownerInventoryCollection(authUser.uid, restaurantId).add({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const snapshot = await documentRef.get();
  const item = mapInventoryItem(snapshot);
  await createNotificationSafely({
    recipientUid: authUser.uid,
    audience: 'owner',
    type: 'inventory-created',
    title: 'Insumo registrado',
    message: `${item.name} fue registrado con ${item.quantity} ${item.unit} en ${restaurant.name}.`,
    restaurantId,
    restaurantName: restaurant.name,
  });
  await notifyInventoryIfNeeded(authUser, { id: restaurantId, ...restaurant }, item);
  return item;
}

async function updateOwnerInventoryItem(authUser, restaurantId, itemId, body = {}) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const documentRef = ownerInventoryCollection(authUser.uid, restaurantId).doc(itemId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  await documentRef.update({
    ...normalizeInventoryPayload(body),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await documentRef.get();
  const item = mapInventoryItem(updatedSnapshot);
  await notifyInventoryIfNeeded(authUser, { id: restaurantId, ...restaurant }, item);
  return item;
}

async function deleteOwnerInventoryItem(authUser, restaurantId, itemId) {
  const restaurant = await loadRestaurant(authUser.uid, restaurantId);

  if (!restaurant) {
    return null;
  }

  const documentRef = ownerInventoryCollection(authUser.uid, restaurantId).doc(itemId);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  await documentRef.delete();
  return true;
}

async function listPublicRestaurants() {
  const snapshot = await db.collectionGroup('restaurants').get();

  return snapshot.docs
    .map((document) =>
      mapRestaurant(
        document,
        document.ref.parent.parent ? document.ref.parent.parent.id : '',
      ),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function listPublicDishes(ownerUid, restaurantId) {
  const snapshot = await ownerDishesCollection(ownerUid, restaurantId).orderBy('name').get();
  return snapshot.docs.map((document) => mapDish(document, restaurantId));
}

module.exports = {
  listOwnerRestaurants,
  createOwnerRestaurant,
  updateOwnerRestaurant,
  deleteOwnerRestaurant,
  listAdminRestaurants,
  verifyAdminRestaurant,
  listAdminRestaurantDishes,
  deleteAdminRestaurant,
  listOwnerDishes,
  createOwnerDish,
  updateOwnerDish,
  deleteOwnerDish,
  listOwnerInventory,
  createOwnerInventoryItem,
  updateOwnerInventoryItem,
  deleteOwnerInventoryItem,
  listPublicRestaurants,
  listPublicDishes,
};
