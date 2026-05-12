const restaurantService = require('../services/restaurant.service');

async function getPublicRestaurants(req, res) {
  try {
    const restaurants = await restaurantService.listPublicRestaurants();
    return res.json(restaurants);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'No se pudieron cargar los restaurantes.';
    return res.status(500).json({ message });
  }
}

async function getPublicDishes(req, res) {
  try {
    const dishes = await restaurantService.listPublicDishes(
      req.params.ownerUid,
      req.params.restaurantId,
    );
    return res.json(dishes);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'No se pudieron cargar los platos.';
    return res.status(500).json({ message });
  }
}

module.exports = {
  getPublicRestaurants,
  getPublicDishes,
};
