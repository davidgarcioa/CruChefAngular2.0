const express = require('express');
const {
  getOrders,
  postOrder,
  patchOrderStatus,
  patchOrderRating,
} = require('../controllers/order.controller');
const { requireFirestore } = require('../middleware/require-firestore');

const router = express.Router();

router.get('/orders', requireFirestore, getOrders);
router.post('/orders', requireFirestore, postOrder);
router.patch('/orders/:id/status', requireFirestore, patchOrderStatus);
router.patch('/orders/:id/rating', requireFirestore, patchOrderRating);

module.exports = router;
