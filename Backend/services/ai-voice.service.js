const { admin, db } = require('../config/firebase');

const categories = {
  burgers: 'hamburguesas',
  pizza: 'pizzas',
  tacos: 'tacos',
  sushi: 'sushi',
  pasta: 'pastas',
  chicken: 'pollo',
  salads: 'ensaladas',
  desserts: 'postres',
  breakfast: 'desayunos',
  drinks: 'bebidas',
  combo: 'combos',
};

const categoryImageKeys = {
  burgers: 'burger',
  pizza: 'pizza',
  tacos: 'tacos',
  sushi: 'sushi',
  pasta: 'pasta',
  chicken: 'chicken',
  salads: 'salad',
  desserts: 'dessert',
  breakfast: 'breakfast',
  drinks: 'drink',
  combo: 'combo',
};

function extractDishInfo(transcript) {
  const cleanText = String(transcript || '').trim().toLowerCase();

  if (cleanText.length < 3) {
    return {
      name: 'Plato del Dia',
      price: 24000,
      category: 'burgers',
      confidence: 0.5,
    };
  }

  let price = 24000;
  const milMatch = cleanText.match(/(\d+)\s*mil/);
  const directNumberMatch = cleanText.match(/(\d{4,7})/);

  if (milMatch) {
    price = Number(milMatch[1]) * 1000;
  } else if (directNumberMatch) {
    price = Number(directNumberMatch[1]);
  }

  let category = 'burgers';
  for (const [categoryId, categoryName] of Object.entries(categories)) {
    if (cleanText.includes(categoryId) || cleanText.includes(categoryName)) {
      category = categoryId;
      break;
    }
  }

  const firstNumber = cleanText.search(/\d/);
  const rawName = firstNumber >= 0 ? cleanText.slice(0, firstNumber) : cleanText;
  const words = rawName
    .replace(/nombre|precio|categoria|categoría|plato|vale|cuesta|por|cop|\$/g, ' ')
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !['de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'a', 'en'].includes(word));

  const name = words.length > 0 ? toTitleCase(words.join(' ')) : 'Plato del Dia';

  return {
    name,
    price: Math.max(1000, Number.isFinite(price) ? price : 24000),
    category,
    confidence: words.length > 0 ? 0.95 : 0.65,
  };
}

async function resolveRestaurant({ ownerUid, restaurantId, restaurantName }) {
  if (!restaurantId) {
    throw new Error('El restaurante es requerido.');
  }

  if (ownerUid) {
    const restaurantRef = db
      .collection('users')
      .doc(ownerUid)
      .collection('restaurants')
      .doc(restaurantId);
    const restaurantSnapshot = await restaurantRef.get();

    if (restaurantSnapshot.exists) {
      const data = restaurantSnapshot.data() || {};
      return {
        ownerUid,
        restaurantId,
        restaurantName: String(data.name || restaurantName || ''),
        restaurantRef,
      };
    }
  }

  const restaurantSnapshot = await db
    .collectionGroup('restaurants')
    .where(admin.firestore.FieldPath.documentId(), '==', restaurantId)
    .limit(1)
    .get();

  if (restaurantSnapshot.empty) {
    throw new Error('No se encontro el restaurante seleccionado.');
  }

  const document = restaurantSnapshot.docs[0];
  const data = document.data() || {};

  return {
    ownerUid: document.ref.parent.parent?.id || '',
    restaurantId: document.id,
    restaurantName: String(data.name || restaurantName || ''),
    restaurantRef: document.ref,
  };
}

async function createDishFromVoice({ name, price, category, restaurantId, ownerUid, restaurantName }) {
  const dishName = String(name || '').trim();
  const dishPrice = Number(price);
  const categoryId = categories[category] ? category : 'burgers';

  if (dishName.length < 2) {
    throw new Error('El nombre del plato es requerido.');
  }

  if (!Number.isFinite(dishPrice) || dishPrice < 1000) {
    throw new Error('El precio debe ser mayor a 1000.');
  }

  const restaurant = await resolveRestaurant({ ownerUid, restaurantId, restaurantName });
  const imageKey = categoryImageKeys[categoryId] || 'plate';

  const dishDocument = {
    name: dishName,
    price: dishPrice,
    categoryId,
    imageKey,
    restaurant: restaurant.restaurantName,
    restaurantId: restaurant.restaurantId,
    restaurantName: restaurant.restaurantName,
    rating: 0,
    ratingCount: 0,
    ratingTotal: 0,
    createdBy: 'ai-voice-assistant',
    source: 'voice_command',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const documentRef = await restaurant.restaurantRef.collection('dishes').add(dishDocument);

  return {
    id: documentRef.id,
    ...dishDocument,
  };
}

async function textToDish({ transcript, restaurantId, ownerUid, restaurantName }) {
  const cleanTranscript = String(transcript || '').trim();

  if (!cleanTranscript) {
    throw new Error('El texto reconocido es requerido.');
  }

  if (!restaurantId) {
    throw new Error('El restaurante es requerido.');
  }

  const dish = extractDishInfo(cleanTranscript);

  return {
    dish,
    transcript: cleanTranscript,
  };
}

function toTitleCase(value) {
  return value
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  createDishFromVoice,
  textToDish,
};
