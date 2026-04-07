const { admin, db } = require('../config/firebase');
const { normalizeDishPayload } = require('../utils/normalize-dish-payload');

async function listDishes() {
  const snapshot = await db.collection('dishes').orderBy('name').get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

async function createDish(body) {
  const payload = {
    ...normalizeDishPayload(body),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const document = await db.collection('dishes').add(payload);
  const snapshot = await document.get();

  return {
    id: document.id,
    ...snapshot.data(),
  };
}

async function updateDish(id, body) {
  const documentRef = db.collection('dishes').doc(id);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return null;
  }

  await documentRef.update(normalizeDishPayload(body));
  const updatedSnapshot = await documentRef.get();

  return {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };
}

async function deleteDish(id) {
  const documentRef = db.collection('dishes').doc(id);
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    return false;
  }

  await documentRef.delete();
  return true;
}

module.exports = {
  listDishes,
  createDish,
  updateDish,
  deleteDish,
};
