const { admin, db } = require('../config/firebase');

function normalizeRole(value) {
  if (value === 'owner' || value === 'user') {
    return value;
  }

  throw new Error('El rol seleccionado no es valido.');
}

function normalizeTextField(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

async function syncRegisterProfile(authUser, body = {}) {
  const uid = authUser.uid;
  const documentRef = db.collection('users').doc(uid);

  await documentRef.set(
    {
      uid,
      fullName: normalizeTextField(body.fullName, authUser.name || ''),
      email: normalizeTextField(body.email, authUser.email || ''),
      documentNumber: normalizeTextField(body.documentNumber),
      emailVerified: Boolean(body.emailVerified),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const snapshot = await documentRef.get();
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function syncLoginProfile(authUser, body = {}) {
  const uid = authUser.uid;
  const documentRef = db.collection('users').doc(uid);

  await documentRef.set(
    {
      uid,
      email: normalizeTextField(body.email, authUser.email || ''),
      fullName: normalizeTextField(body.fullName, authUser.name || ''),
      emailVerified: body.emailVerified !== false,
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const snapshot = await documentRef.get();
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function setSelectedRole(authUser, body = {}) {
  const uid = authUser.uid;
  const selectedRole = normalizeRole(body.selectedRole);
  const documentRef = db.collection('users').doc(uid);

  await documentRef.set(
    {
      uid,
      email: normalizeTextField(body.email, authUser.email || ''),
      fullName: normalizeTextField(body.fullName, authUser.name || ''),
      selectedRole,
      roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const snapshot = await documentRef.get();
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

module.exports = {
  syncRegisterProfile,
  syncLoginProfile,
  setSelectedRole,
};
