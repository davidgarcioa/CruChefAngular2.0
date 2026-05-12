const { db } = require('../config/firebase');
const { normalizeRestaurantPayload } = require('../utils/normalize-restaurant-payload');
const { normalizeOwnerDishPayload } = require('../utils/normalize-owner-dish-payload');

function ownerRestaurantsCollection(ownerUid) {
  return db.collection('users').doc(ownerUid).collection('restaurants');
}

function ownerRestaurantDocument(ownerUid, restaurantId) {
  return ownerRestaurantsCollection(ownerUid).doc(restaurantId);
}

function ownerDishesCollection(ownerUid, restaurantId) {
  return ownerRestaurantDocument(ownerUid, restaurantId).collection('dishes');
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
    verificationStatus:
      data.verificationStatus === 'verified' ? 'verified' : 'pending',
  };
}

function mapDish(document, restaurantId) {
  const data = document.data();

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
  };
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

  const documentRef = await ownerDishesCollection(authUser.uid, restaurantId).add({
    ...normalizeOwnerDishPayload(body, restaurant),
    rating: 0,
    ratingCount: 0,
    ratingTotal: 0,
  });

  const snapshot = await documentRef.get();
  return mapDish(snapshot, restaurantId);
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

  await documentRef.update(normalizeOwnerDishPayload(body, restaurant));
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
  listOwnerDishes,
  createOwnerDish,
  updateOwnerDish,
  deleteOwnerDish,
  listPublicRestaurants,
  listPublicDishes,
};
