const orderService = require('../services/order.service');

const validationMessages = new Set([
  'La orden requiere un restaurante valido.',
  'La orden requiere un cliente valido.',
  'La orden requiere un plato valido.',
  'La cantidad debe estar entre 1 y 10.',
  'El precio unitario no es valido.',
  'El metodo de pago no es valido.',
  'Los datos de tarjeta demo no son validos.',
  'Los datos de transferencia demo no son validos.',
  'El estado de la orden no es valido.',
  'Solo se puede confirmar pago en pedidos en efectivo.',
  'La calificacion debe estar entre 1 y 5.',
  'Solo se pueden calificar ordenes entregadas.',
  'La orden ya fue calificada.',
]);

function normalizeControllerError(error, fallbackMessage) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      message: fallbackMessage,
    };
  }

  const rawMessage = error.message || fallbackMessage;
  const lowerMessage = rawMessage.toLowerCase();
  const code = typeof error.code === 'number' || typeof error.code === 'string' ? String(error.code) : '';

  if (
    code === '16' ||
    lowerMessage.includes('unauthenticated') ||
    lowerMessage.includes('invalid authentication credentials')
  ) {
    return {
      status: 500,
      message:
        'Firebase Admin no pudo autenticarse con Firestore. Reemplaza Backend/firebase-key.json por una clave nueva y valida del proyecto cruchefangular.',
    };
  }

  if (
    code === '7' ||
    lowerMessage.includes('permission_denied') ||
    lowerMessage.includes('permission denied')
  ) {
    return {
      status: 500,
      message:
        'La cuenta de servicio de Firebase no tiene permisos suficientes sobre Firestore. Revisa IAM o genera una clave nueva del proyecto correcto.',
    };
  }

  if (validationMessages.has(rawMessage)) {
    return {
      status: 400,
      message: rawMessage,
    };
  }

  if (
    rawMessage.startsWith('Stock insuficiente para') ||
    rawMessage.startsWith('El insumo ')
  ) {
    return {
      status: 400,
      message: rawMessage,
    };
  }

  return {
    status: 500,
    message: rawMessage,
  };
}

async function getOrders(req, res) {
  try {
    const orders = await orderService.listOrders({
      ownerUid: typeof req.query.ownerUid === 'string' ? req.query.ownerUid : '',
      customerUid: typeof req.query.customerUid === 'string' ? req.query.customerUid : '',
      status: typeof req.query.status === 'string' ? req.query.status : '',
    });
    res.json(orders);
  } catch (error) {
    const resolved = normalizeControllerError(
      error,
      'No se pudieron cargar las ordenes.',
    );
    res.status(resolved.status).json({ message: `No se pudieron cargar las ordenes: ${resolved.message}` });
  }
}

async function postOrder(req, res) {
  try {
    const createdOrder = await orderService.createOrder(req.body);
    res.status(201).json(createdOrder);
  } catch (error) {
    const resolved = normalizeControllerError(error, 'No se pudo crear la orden.');
    res.status(resolved.status).json({ message: resolved.message });
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
    const resolved = normalizeControllerError(error, 'No se pudo actualizar la orden.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

async function patchOrderPayment(req, res) {
  try {
    const updatedOrder = await orderService.confirmCashPayment(req.params.id);

    if (!updatedOrder) {
      return res.status(404).json({ message: 'La orden no existe.' });
    }

    return res.json(updatedOrder);
  } catch (error) {
    const resolved = normalizeControllerError(error, 'No se pudo confirmar el pago.');
    return res.status(resolved.status).json({ message: resolved.message });
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
    const resolved = normalizeControllerError(error, 'No se pudo calificar la orden.');
    return res.status(resolved.status).json({ message: resolved.message });
  }
}

module.exports = {
  getOrders,
  postOrder,
  patchOrderStatus,
  patchOrderPayment,
  patchOrderRating,
};
