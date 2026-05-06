const publicMenuService = require('../services/public-menu.service');

async function getPublicRestaurantMenu(req, res) {
  try {
    const { ownerUid, restaurantId } = req.params;
    const menu = await publicMenuService.getRestaurantMenu(ownerUid, restaurantId);

    if (!menu) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.json(menu);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    return res.status(500).json({ message: `No se pudo cargar el menu publico: ${message}` });
  }
}

module.exports = {
  getPublicRestaurantMenu,
};
