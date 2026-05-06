const express = require('express');
const { getPublicRestaurantMenu } = require('../controllers/public-menu.controller');
const { requireFirestore } = require('../middleware/require-firestore');

const router = express.Router();

router.get(
  '/public/restaurants/:ownerUid/:restaurantId/menu',
  requireFirestore,
  getPublicRestaurantMenu,
);

module.exports = router;
