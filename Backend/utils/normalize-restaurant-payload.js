function normalizeTextField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const MAX_RUT_FILE_SIZE = 700_000;
const ALLOWED_RUT_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function normalizeRestaurantPayload(body = {}) {
  const name = normalizeTextField(body.name);
  const address = normalizeTextField(body.address);
  const city = normalizeTextField(body.city);
  const phone = normalizeTextField(body.phone);
  const schedule = normalizeTextField(body.schedule);
  const rutFileName = normalizeTextField(body.rutFileName);
  const rutFileType = normalizeTextField(body.rutFileType);
  const rutFileData = normalizeTextField(body.rutFileData);
  const rutFileSize = Number(body.rutFileSize || 0);

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

  if (rutFileName.length < 3 || rutFileData.length < 20) {
    throw new Error('Carga el archivo del RUT del restaurante.');
  }

  if (!Number.isFinite(rutFileSize) || rutFileSize <= 0) {
    throw new Error('El archivo del RUT no es valido.');
  }

  if (rutFileSize > MAX_RUT_FILE_SIZE) {
    throw new Error('El archivo del RUT supera el limite de 700 KB.');
  }

  if (!ALLOWED_RUT_FILE_TYPES.has(rutFileType)) {
    throw new Error('El archivo del RUT debe ser PDF, JPG, PNG o WEBP.');
  }

  if (!rutFileData.startsWith(`data:${rutFileType};base64,`)) {
    throw new Error('El contenido del archivo del RUT no coincide con su formato.');
  }

  return {
    name,
    address,
    city,
    phone,
    schedule,
    rutFileName,
    rutFileType,
    rutFileSize,
    rutFileData,
  };
}

module.exports = {
  normalizeRestaurantPayload,
};
