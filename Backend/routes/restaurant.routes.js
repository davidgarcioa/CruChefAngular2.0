const express = require('express');
const {
  getOwnerRestaurants,
  postOwnerRestaurant,
  putOwnerRestaurant,
  deleteOwnerRestaurant,
  getAdminRestaurants,
  verifyAdminRestaurant,
  getAdminRestaurantDishes,
  deleteAdminRestaurant,
  getOwnerDishes,
  postOwnerDish,
  putOwnerDish,
  deleteOwnerDish,
  getOwnerInventory,
  postOwnerInventoryItem,
  putOwnerInventoryItem,
  deleteOwnerInventoryItem,
} = require('../controllers/restaurant.controller');
const { requireFirestore } = require('../middleware/require-firestore');
const { requireAuth } = require('../middleware/require-auth');
const { requireAdmin } = require('../middleware/require-admin');

const router = express.Router();

router.get('/admin/restaurants', requireFirestore, requireAuth, requireAdmin, getAdminRestaurants);
router.put(
  '/admin/restaurants/:ownerUid/:restaurantId/verify',
  requireFirestore,
  requireAuth,
  requireAdmin,
  verifyAdminRestaurant,
);
router.get(
  '/admin/restaurants/:ownerUid/:restaurantId/dishes',
  requireFirestore,
  requireAuth,
  requireAdmin,
  getAdminRestaurantDishes,
);
router.delete(
  '/admin/restaurants/:ownerUid/:restaurantId',
  requireFirestore,
  requireAuth,
  requireAdmin,
  deleteAdminRestaurant,
);

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
router.get(
  '/owner/restaurants/:restaurantId/inventory',
  requireFirestore,
  requireAuth,
  getOwnerInventory,
);
router.post(
  '/owner/restaurants/:restaurantId/inventory',
  requireFirestore,
  requireAuth,
  postOwnerInventoryItem,
);
router.put(
  '/owner/restaurants/:restaurantId/inventory/:itemId',
  requireFirestore,
  requireAuth,
  putOwnerInventoryItem,
);
router.delete(
  '/owner/restaurants/:restaurantId/inventory/:itemId',
  requireFirestore,
  requireAuth,
  deleteOwnerInventoryItem,
);

module.exports = router;
