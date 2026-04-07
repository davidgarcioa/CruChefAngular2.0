const dishService = require('../services/dish.service');

async function getDishes(req, res) {
  try {
    const dishes = await dishService.listDishes();
    res.json(dishes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    res.status(500).json({ message: `No se pudieron cargar los platos: ${message}` });
  }
}

async function postDish(req, res) {
  try {
    const createdDish = await dishService.createDish(req.body);
    res.status(201).json(createdDish);
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo crear el plato.';
    res.status(status).json({ message });
  }
}

async function putDish(req, res) {
  try {
    const updatedDish = await dishService.updateDish(req.params.id, req.body);

    if (!updatedDish) {
      return res.status(404).json({ message: 'El plato no existe.' });
    }

    return res.json(updatedDish);
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el plato.';
    return res.status(status).json({ message });
  }
}

async function removeDish(req, res) {
  try {
    const wasDeleted = await dishService.deleteDish(req.params.id);

    if (!wasDeleted) {
      return res.status(404).json({ message: 'El plato no existe.' });
    }

    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el plato.';
    return res.status(500).json({ message });
  }
}

module.exports = {
  getDishes,
  postDish,
  putDish,
  removeDish,
};
