const express = require('express');
const {
  getOwnerRestaurants,
  postOwnerRestaurant,
  putOwnerRestaurant,
  deleteOwnerRestaurant,
  getOwnerDishes,
  postOwnerDish,
  putOwnerDish,
  deleteOwnerDish,
} = require('../controllers/restaurant.controller');
const { requireFirestore } = require('../middleware/require-firestore');
const { requireAuth } = require('../middleware/require-auth');

const router = express.Router();

router.get('/owner/restaurants', requireFirestore, requireAuth, getOwnerRestaurants);
router.post('/owner/restaurants', requireFirestore, requireAuth, postOwnerRestaurant);
router.put(
  '/owner/restaurants/:restaurantId',
  requireFirestore,
  requireAuth,
  putOwnerRestaurant,
);
router.delete(
  '/owner/restaurants/:restaurantId',
  requireFirestore,
  requireAuth,
  deleteOwnerRestaurant,
);
router.get(
  '/owner/restaurants/:restaurantId/dishes',
  requireFirestore,
  requireAuth,
  getOwnerDishes,
);
router.post(
  '/owner/restaurants/:restaurantId/dishes',
  requireFirestore,
  requireAuth,
  postOwnerDish,
);
router.put(
  '/owner/restaurants/:restaurantId/dishes/:dishId',
  requireFirestore,
  requireAuth,
  putOwnerDish,
);
router.delete(
  '/owner/restaurants/:restaurantId/dishes/:dishId',
  requireFirestore,
  requireAuth,
  deleteOwnerDish,
);

module.exports = router;
