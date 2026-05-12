const restaurantService = require('../services/restaurant.service');

const validationMessages = new Set([
  'El nombre del restaurante debe tener al menos 2 caracteres.',
  'La direccion del restaurante debe tener al menos 5 caracteres.',
  'La ciudad del restaurante debe tener al menos 2 caracteres.',
  'El telefono del restaurante debe tener al menos 7 caracteres.',
  'El horario del restaurante debe tener al menos 3 caracteres.',
  'El RUT del restaurante debe tener al menos 6 caracteres.',
  'El nombre del plato debe tener al menos 2 caracteres.',
  'El precio del plato debe ser mayor o igual a 1000.',
  'restaurant-required',
]);

function resolveRestaurantControllerError(error, fallbackMessage) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      message: fallbackMessage,
    };
  }

  if (validationMessages.has(error.message)) {
    return {
      status: 400,
      message:
        error.message === 'restaurant-required'
          ? 'Debes crear o seleccionar un restaurante primero.'
          : error.message,
    };
  }

  return {
    status: 500,
    message: error.message || fallbackMessage,
  };
}

async function getOwnerRestaurants(req, res) {
  try {
    const restaurants = await restaurantService.listOwnerRestaurants(req.authUser);
    return res.json(restaurants);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudieron cargar los restaurantes.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function postOwnerRestaurant(req, res) {
  try {
    const restaurant = await restaurantService.createOwnerRestaurant(req.authUser, req.body);
    return res.status(201).json(restaurant);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo crear el restaurante.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function putOwnerRestaurant(req, res) {
  try {
    const restaurant = await restaurantService.updateOwnerRestaurant(
      req.authUser,
      req.params.restaurantId,
      req.body,
    );

    if (!restaurant) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.json(restaurant);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo actualizar el restaurante.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function deleteOwnerRestaurant(req, res) {
  try {
    const wasDeleted = await restaurantService.deleteOwnerRestaurant(
      req.authUser,
      req.params.restaurantId,
    );

    if (!wasDeleted) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.status(204).send();
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo eliminar el restaurante.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function getOwnerDishes(req, res) {
  try {
    const dishes = await restaurantService.listOwnerDishes(
      req.authUser,
      req.params.restaurantId,
    );

    if (dishes === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.json(dishes);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudieron cargar los platos.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function postOwnerDish(req, res) {
  try {
    const dish = await restaurantService.createOwnerDish(
      req.authUser,
      req.params.restaurantId,
      req.body,
    );

    if (dish === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.status(201).json(dish);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo crear el plato.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function putOwnerDish(req, res) {
  try {
    const dish = await restaurantService.updateOwnerDish(
      req.authUser,
      req.params.restaurantId,
      req.params.dishId,
      req.body,
    );

    if (dish === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    if (dish === false) {
      return res.status(404).json({ message: 'El plato no existe.' });
    }

    return res.json(dish);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo actualizar el plato.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function deleteOwnerDish(req, res) {
  try {
    const result = await restaurantService.deleteOwnerDish(
      req.authUser,
      req.params.restaurantId,
      req.params.dishId,
    );

    if (result === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    if (result === false) {
      return res.status(404).json({ message: 'El plato no existe.' });
    }

    return res.status(204).send();
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo eliminar el plato.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

module.exports = {
  getOwnerRestaurants,
  postOwnerRestaurant,
  putOwnerRestaurant,
  deleteOwnerRestaurant,
  getOwnerDishes,
  postOwnerDish,
  putOwnerDish,
  deleteOwnerDish,
};
