const { db } = require('../config/firebase');

function mapRestaurant(snapshot, ownerUid) {
  const data = snapshot.data() || {};

  return {
    id: snapshot.id,
    ownerUid,
    ownerEmail: String(data.ownerEmail || ''),
    name: String(data.name || ''),
    address: String(data.address || ''),
    city: String(data.city || ''),
    phone: String(data.phone || ''),
    schedule: String(data.schedule || ''),
    rut: String(data.rut || ''),
    verificationStatus: data.verificationStatus === 'verified' ? 'verified' : 'pending',
  };
}

function mapDish(snapshot, restaurantId, restaurantName) {
  const data = snapshot.data() || {};
  const rating = Number(data.rating || 0);
  const ratingCount = Number(data.ratingCount || (rating > 0 ? 1 : 0));

  return {
    id: snapshot.id,
    name: String(data.name || ''),
    price: Number(data.price || 0),
    rating,
    ratingCount,
    ratingTotal: Number(data.ratingTotal || rating * ratingCount),
    restaurant: String(data.restaurant || restaurantName),
    restaurantId: String(data.restaurantId || restaurantId),
    restaurantName: String(data.restaurantName || restaurantName),
    categoryId: String(data.categoryId || 'burgers'),
    imageKey: String(data.imageKey || 'plate'),
    imageUrl: String(data.imageUrl || ''),
  };
}

async function getRestaurantMenu(ownerUid, restaurantId) {
  const restaurantRef = db
    .collection('users')
    .doc(ownerUid)
    .collection('restaurants')
    .doc(restaurantId);
  const restaurantSnapshot = await restaurantRef.get();

  if (!restaurantSnapshot.exists) {
    return null;
  }

  const restaurant = mapRestaurant(restaurantSnapshot, ownerUid);
  const dishesSnapshot = await restaurantRef.collection('dishes').orderBy('name').get();
  const dishes = dishesSnapshot.docs.map((snapshot) =>
    mapDish(snapshot, restaurantId, restaurant.name),
  );

  return {
    restaurant,
    dishes,
  };
}

module.exports = {
  getRestaurantMenu,
};
