function normalizeTextField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRestaurantPayload(body = {}) {
  const name = normalizeTextField(body.name);
  const address = normalizeTextField(body.address);
  const city = normalizeTextField(body.city);
  const phone = normalizeTextField(body.phone);
  const schedule = normalizeTextField(body.schedule);
  const rut = normalizeTextField(body.rut);

  if (name.length < 2) {
    throw new Error('El nombre del restaurante debe tener al menos 2 caracteres.');
  }

  if (address.length < 5) {
    throw new Error('La direccion del restaurante debe tener al menos 5 caracteres.');
  }

  if (city.length < 2) {
    throw new Error('La ciudad del restaurante debe tener al menos 2 caracteres.');
  }

  if (phone.length < 7) {
    throw new Error('El telefono del restaurante debe tener al menos 7 caracteres.');
  }

  if (schedule.length < 3) {
    throw new Error('El horario del restaurante debe tener al menos 3 caracteres.');
  }

  if (rut.length < 6) {
    throw new Error('El RUT del restaurante debe tener al menos 6 caracteres.');
  }

  return {
    name,
    address,
    city,
    phone,
    schedule,
    rut,
  };
}

module.exports = {
  normalizeRestaurantPayload,
};
