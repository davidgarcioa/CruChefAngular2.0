const orderService = require('../services/order.service');

async function getOrders(req, res) {
  try {
    const orders = await orderService.listOrders({
      ownerUid: typeof req.query.ownerUid === 'string' ? req.query.ownerUid : '',
      customerUid: typeof req.query.customerUid === 'string' ? req.query.customerUid : '',
      status: typeof req.query.status === 'string' ? req.query.status : '',
    });
    res.json(orders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    res.status(500).json({ message: `No se pudieron cargar las ordenes: ${message}` });
  }
}

async function postOrder(req, res) {
  try {
    const createdOrder = await orderService.createOrder(req.body);
    res.status(201).json(createdOrder);
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo crear la orden.';
    res.status(status).json({ message });
  }
}

async function patchOrderStatus(req, res) {
  try {
    const updatedOrder = await orderService.updateOrderStatus(req.params.id, req.body);

    if (!updatedOrder) {
      return res.status(404).json({ message: 'La orden no existe.' });
    }

    return res.json(updatedOrder);
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la orden.';
    return res.status(status).json({ message });
  }
}

async function patchOrderRating(req, res) {
  try {
    const updatedOrder = await orderService.rateOrder(req.params.id, req.body);

    if (!updatedOrder) {
      return res.status(404).json({ message: 'La orden no existe.' });
    }

    return res.json(updatedOrder);
  } catch (error) {
    const status = error instanceof Error ? 400 : 500;
    const message = error instanceof Error ? error.message : 'No se pudo calificar la orden.';
    return res.status(status).json({ message });
  }
}

module.exports = {
  getOrders,
  postOrder,
  patchOrderStatus,
  patchOrderRating,
};
