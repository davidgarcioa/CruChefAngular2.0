const { admin } = require('../config/firebase');

function normalizeDishPayload(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const restaurant = typeof body.restaurant === 'string' ? body.restaurant.trim() : '';
  const price = Number(body.price);
  const rating = Number(body.rating);
  const categoryId =
    typeof body.categoryId === 'string' && body.categoryId.trim().length > 0
      ? body.categoryId.trim()
      : '';
  const imageKey =
    typeof body.imageKey === 'string' && body.imageKey.trim().length > 0
      ? body.imageKey.trim()
      : '';
  const imageUrl =
    typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0
      ? body.imageUrl.trim()
      : '';

  if (name.length < 2) {
    throw new Error('El nombre del plato no es valido.');
  }

  if (restaurant.length < 2) {
    throw new Error('El restaurante no es valido.');
  }

  if (!Number.isFinite(price) || price < 1000) {
    throw new Error('El precio no es valido.');
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('La calificacion debe estar entre 1 y 5.');
  }

  if (!categoryId) {
    throw new Error('La categoria es obligatoria.');
  }

  if (!imageKey || !imageUrl) {
    throw new Error('La imagen del plato es obligatoria.');
  }

  return {
    name,
    restaurant,
    price,
    rating,
    categoryId,
    imageKey,
    imageUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

module.exports = {
  normalizeDishPayload,
};
