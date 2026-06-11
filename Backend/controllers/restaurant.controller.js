const restaurantService = require('../services/restaurant.service');

const validationMessages = new Set([
  'El nombre del restaurante debe tener al menos 2 caracteres.',
  'La direccion del restaurante debe tener al menos 5 caracteres.',
  'La ciudad del restaurante debe tener al menos 2 caracteres.',
  'El telefono del restaurante debe tener al menos 7 caracteres.',
  'El horario del restaurante debe tener al menos 3 caracteres.',
  'Carga el archivo del RUT del restaurante.',
  'El archivo del RUT no es valido.',
  'El archivo del RUT supera el limite de 700 KB.',
  'El archivo del RUT debe ser PDF, JPG, PNG o WEBP.',
  'El contenido del archivo del RUT no coincide con su formato.',
  'El nombre del plato debe tener al menos 2 caracteres.',
  'El precio del plato debe ser mayor o igual a 1000.',
  'Agrega al menos un insumo requerido para calcular el inventario por pedido.',
  'La cantidad requerida del insumo no es valida.',
  'Selecciona insumos validos para la receta del plato.',
  'El nombre del insumo debe tener al menos 2 caracteres.',
  'La unidad del insumo es obligatoria.',
  'La cantidad del insumo no es valida.',
  'El minimo del insumo no es valido.',
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

  if (
    error.message.startsWith('Stock insuficiente para') ||
    error.message.startsWith('El insumo ')
  ) {
    return {
      status: 400,
      message: error.message,
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

async function getAdminRestaurants(req, res) {
  try {
    const restaurants = await restaurantService.listAdminRestaurants();
    return res.json(restaurants);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudieron cargar los restaurantes para administracion.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function getAdminRestaurantRut(req, res) {
  try {
    const document = await restaurantService.getAdminRestaurantRut(
      req.params.ownerUid,
      req.params.restaurantId,
    );

    if (!document) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    if (!document.fileData) {
      return res.status(404).json({
        message: 'Este restaurante no tiene un documento del RUT disponible.',
      });
    }

    return res.json(document);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo cargar el documento del RUT.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function verifyAdminRestaurant(req, res) {
  try {
    const restaurant = await restaurantService.verifyAdminRestaurant(
      req.params.ownerUid,
      req.params.restaurantId,
    );

    if (!restaurant) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.json(restaurant);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudo verificar el restaurante.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function getAdminRestaurantDishes(req, res) {
  try {
    const dishes = await restaurantService.listAdminRestaurantDishes(
      req.params.ownerUid,
      req.params.restaurantId,
    );

    if (dishes === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.json(dishes);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(
      error,
      'No se pudieron cargar los platos del restaurante.',
    );
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function deleteAdminRestaurant(req, res) {
  try {
    const wasDeleted = await restaurantService.deleteAdminRestaurant(
      req.params.ownerUid,
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

async function getOwnerInventory(req, res) {
  try {
    const items = await restaurantService.listOwnerInventory(req.authUser, req.params.restaurantId);

    if (items === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.json(items);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(error, 'No se pudo cargar el inventario.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function postOwnerInventoryItem(req, res) {
  try {
    const item = await restaurantService.createOwnerInventoryItem(
      req.authUser,
      req.params.restaurantId,
      req.body,
    );

    if (item === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    return res.status(201).json(item);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(error, 'No se pudo crear el insumo.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function putOwnerInventoryItem(req, res) {
  try {
    const item = await restaurantService.updateOwnerInventoryItem(
      req.authUser,
      req.params.restaurantId,
      req.params.itemId,
      req.body,
    );

    if (item === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    if (item === false) {
      return res.status(404).json({ message: 'El insumo no existe.' });
    }

    return res.json(item);
  } catch (error) {
    const resolved = resolveRestaurantControllerError(error, 'No se pudo actualizar el insumo.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function deleteOwnerInventoryItem(req, res) {
  try {
    const result = await restaurantService.deleteOwnerInventoryItem(
      req.authUser,
      req.params.restaurantId,
      req.params.itemId,
    );

    if (result === null) {
      return res.status(404).json({ message: 'El restaurante no existe.' });
    }

    if (result === false) {
      return res.status(404).json({ message: 'El insumo no existe.' });
    }

    return res.status(204).send();
  } catch (error) {
    const resolved = resolveRestaurantControllerError(error, 'No se pudo eliminar el insumo.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

module.exports = {
  getOwnerRestaurants,
  postOwnerRestaurant,
  putOwnerRestaurant,
  deleteOwnerRestaurant,
  getAdminRestaurants,
  getAdminRestaurantRut,
  verifyAdminRestaurant,
  getAdminRestaurantDishes,
  deleteAdminRestaurant,
  getOwnerDishes,
  postOwnerDish,
  putOwnerDish,
  deleteOwnerDish,
  getOwnerInventory,
  postOwnerInventoryItem,
  putOwnerInventoryItem,
  deleteOwnerInventoryItem,
};
