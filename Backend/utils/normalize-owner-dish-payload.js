const { getCategoryImageKey, getDishImageUrl } = require('./category-assets');

function normalizeTextField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStockRequirements(value) {
  const requirements = Array.isArray(value) ? value : [];
  const requirementMap = new Map();

  requirements.forEach((requirement) => {
    const itemId =
      requirement && typeof requirement.itemId === 'string'
        ? requirement.itemId.trim()
        : '';
    const quantity = Number(requirement?.quantity);

    if (!itemId) {
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('La cantidad requerida del insumo no es valida.');
    }

    requirementMap.set(itemId, (requirementMap.get(itemId) || 0) + quantity);
  });

  return Array.from(requirementMap.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));
}

function normalizeOwnerDishPayload(body = {}, restaurant) {
  if (!restaurant || !restaurant.id || !restaurant.name) {
    throw new Error('restaurant-required');
  }

  const name = normalizeTextField(body.name);
  const categoryId = normalizeTextField(body.categoryId) || 'burgers';
  const price = Number(body.price);
  const stockRequirements = normalizeStockRequirements(body.stockRequirements);

  if (name.length < 2) {
    throw new Error('El nombre del plato debe tener al menos 2 caracteres.');
  }

  if (!Number.isFinite(price) || price < 1000) {
    throw new Error('El precio del plato debe ser mayor o igual a 1000.');
  }

  if (stockRequirements.length === 0) {
    throw new Error('Agrega al menos un insumo requerido para calcular el inventario por pedido.');
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
    stockRequirements,
  };
}

module.exports = {
  normalizeOwnerDishPayload,
  normalizeStockRequirements,
};
