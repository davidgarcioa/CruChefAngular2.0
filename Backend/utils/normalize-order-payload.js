const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isCardExpiryValid(value) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  return year > currentYear || (year === currentYear && month >= currentMonth);
}

function normalizePaymentDetails(body, paymentMethod) {
  const details =
    body && typeof body.paymentDetails === 'object' && body.paymentDetails !== null
      ? body.paymentDetails
      : {};

  if (paymentMethod === 'card') {
    const cardholderName = normalizeText(details.cardholderName);
    const cardLast4 = normalizeText(details.cardLast4).replace(/\D/g, '').slice(-4);
    const cardExpiry = normalizeText(details.cardExpiry);

    if (cardholderName.length < 3 || cardLast4.length !== 4 || !isCardExpiryValid(cardExpiry)) {
      throw new Error('Los datos de tarjeta demo no son validos.');
    }

    return {
      type: 'card',
      cardholderName,
      cardLast4,
      cardExpiry,
    };
  }

  if (paymentMethod === 'transfer') {
    const transferBank = normalizeText(details.transferBank);
    const transferReference = normalizeText(details.transferReference);

    if (transferBank.length < 2 || transferReference.length < 4) {
      throw new Error('Los datos de transferencia demo no son validos.');
    }

    return {
      type: 'transfer',
      transferBank,
      transferReference,
    };
  }

  return null;
}

function normalizeOrderPayload(body) {
  const ownerUid = typeof body.ownerUid === 'string' ? body.ownerUid.trim() : '';
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const restaurantName = typeof body.restaurantName === 'string' ? body.restaurantName.trim() : '';
  const customerUid = typeof body.customerUid === 'string' ? body.customerUid.trim() : '';
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const dishId = typeof body.dishId === 'string' ? body.dishId.trim() : '';
  const dishName = typeof body.dishName === 'string' ? body.dishName.trim() : '';
  const dishImageUrl = typeof body.dishImageUrl === 'string' ? body.dishImageUrl.trim() : '';
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : '';
  const quantity = Number(body.quantity);
  const unitPrice = Number(body.unitPrice);
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const paymentMethod =
    typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : 'cash';
  const allowedPaymentMethods = ['cash', 'card', 'transfer'];

  if (!ownerUid || !restaurantId || restaurantName.length < 2) {
    throw new Error('La orden requiere un restaurante valido.');
  }

  if (!customerUid || customerName.length < 2) {
    throw new Error('La orden requiere un cliente valido.');
  }

  if (!dishId || dishName.length < 2 || !dishImageUrl || !categoryId) {
    throw new Error('La orden requiere un plato valido.');
  }

  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    throw new Error('La cantidad debe estar entre 1 y 10.');
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 1000) {
    throw new Error('El precio unitario no es valido.');
  }

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    throw new Error('El metodo de pago no es valido.');
  }

  const paymentDetails = normalizePaymentDetails(body, paymentMethod);

  return {
    ownerUid,
    restaurantId,
    restaurantName,
    customerUid,
    customerEmail,
    customerName,
    dishId,
    dishName,
    dishImageUrl,
    categoryId,
    quantity,
    unitPrice,
    serviceFee: 0,
    totalPrice: quantity * unitPrice,
    notes,
    paymentMethod,
    paymentDetails,
    paymentStatus: paymentMethod === 'cash' ? 'pending' : 'approved',
    status: 'pending',
    rating: null,
    reviewText: '',
  };
}

function normalizeStatusPayload(body) {
  const status = typeof body.status === 'string' ? body.status.trim() : '';

  if (!ORDER_STATUSES.includes(status)) {
    throw new Error('El estado de la orden no es valido.');
  }

  return { status };
}

function normalizeRatingPayload(body) {
  const rating = Number(body.rating);
  const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim() : '';

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('La calificacion debe estar entre 1 y 5.');
  }

  return {
    rating,
    reviewText,
  };
}

module.exports = {
  ORDER_STATUSES,
  normalizeOrderPayload,
  normalizeStatusPayload,
  normalizeRatingPayload,
};
