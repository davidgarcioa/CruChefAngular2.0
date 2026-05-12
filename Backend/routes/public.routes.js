const express = require('express');
const {
  getPublicRestaurants,
  getPublicDishes,
} = require('../controllers/public.controller');
const { requireFirestore } = require('../middleware/require-firestore');

const router = express.Router();

router.get('/public/restaurants', requireFirestore, getPublicRestaurants);
router.get(
  '/public/restaurants/:ownerUid/:restaurantId/dishes',
  requireFirestore,
  getPublicDishes,
);

module.exports = router;
