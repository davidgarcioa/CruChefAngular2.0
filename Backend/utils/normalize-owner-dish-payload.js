const { getCategoryImageKey, getDishImageUrl } = require('./category-assets');

function normalizeTextField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOwnerDishPayload(body = {}, restaurant) {
  if (!restaurant || !restaurant.id || !restaurant.name) {
    throw new Error('restaurant-required');
  }

  const name = normalizeTextField(body.name);
  const categoryId = normalizeTextField(body.categoryId) || 'burgers';
  const price = Number(body.price);

  if (name.length < 2) {
    throw new Error('El nombre del plato debe tener al menos 2 caracteres.');
  }

  if (!Number.isFinite(price) || price < 1000) {
    throw new Error('El precio del plato debe ser mayor o igual a 1000.');
  }

  const imageKey = getCategoryImageKey(categoryId);

  return {
    name,
    price,
    categoryId,
    imageKey,
    imageUrl: getDishImageUrl(imageKey),
    restaurant: restaurant.name,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
  };
}

module.exports = {
  normalizeOwnerDishPayload,
};
