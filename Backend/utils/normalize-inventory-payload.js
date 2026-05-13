function normalizeInventoryPayload(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  const quantity = Number(body.quantity);
  const minimum = Number(body.minimum);

  if (name.length < 2) {
    throw new Error('El nombre del insumo debe tener al menos 2 caracteres.');
  }

  if (unit.length < 1) {
    throw new Error('La unidad del insumo es obligatoria.');
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('La cantidad del insumo no es valida.');
  }

  if (!Number.isFinite(minimum) || minimum < 0) {
    throw new Error('El minimo del insumo no es valido.');
  }

  return {
    name,
    unit,
    quantity,
    minimum,
  };
}

module.exports = {
  normalizeInventoryPayload,
};
