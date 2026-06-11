const { admin, db } = require('../config/firebase');

function normalizeRole(value) {
  if (value === 'owner' || value === 'user') {
    return value;
  }

  throw new Error('El rol seleccionado no es valido.');
}

function normalizeAllowedRoles(value, fallback = ['user', 'owner']) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (!Array.isArray(value)) {
    throw new Error('Selecciona para que vas a usar la cuenta.');
  }

  const roles = [...new Set(value.filter((role) => role === 'user' || role === 'owner'))];

  if (roles.length === 0 || roles.length !== value.length) {
    throw new Error('Los tipos de cuenta seleccionados no son validos.');
  }

  return roles;
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
      allowedRoles: normalizeAllowedRoles(body.allowedRoles, []),
      emailVerified: Boolean(body.emailVerified),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const updatedSnapshot = await documentRef.get();
  return {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };
}

async function getProfile(authUser) {
  const snapshot = await db.collection('users').doc(authUser.uid).get();

  if (!snapshot.exists) {
    return {
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email || '',
      fullName: authUser.name || '',
      allowedRoles: ['user', 'owner'],
    };
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    allowedRoles: normalizeAllowedRoles(data.allowedRoles),
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
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    allowedRoles: normalizeAllowedRoles(data.allowedRoles),
  };
}

async function setSelectedRole(authUser, body = {}) {
  const uid = authUser.uid;
  const selectedRole = normalizeRole(body.selectedRole);
  const documentRef = db.collection('users').doc(uid);
  const snapshot = await documentRef.get();
  const allowedRoles = normalizeAllowedRoles(
    snapshot.exists ? snapshot.data().allowedRoles : undefined,
  );

  if (!allowedRoles.includes(selectedRole)) {
    throw new Error('Tu cuenta no tiene habilitado ese tipo de acceso.');
  }

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

  const updatedSnapshot = await documentRef.get();
  return {
    id: updatedSnapshot.id,
    ...updatedSnapshot.data(),
  };
}

module.exports = {
  syncRegisterProfile,
  getProfile,
  syncLoginProfile,
  setSelectedRole,
};
