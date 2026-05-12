const express = require('express');
const {
  postRegisterProfile,
  postLoginProfile,
  postSelectedRole,
} = require('../controllers/user.controller');
const { requireFirestore } = require('../middleware/require-firestore');
const { requireAuth } = require('../middleware/require-auth');

const router = express.Router();

router.post('/users/profile/register', requireFirestore, requireAuth, postRegisterProfile);
router.post('/users/profile/login', requireFirestore, requireAuth, postLoginProfile);
router.post('/users/role', requireFirestore, requireAuth, postSelectedRole);

module.exports = router;
