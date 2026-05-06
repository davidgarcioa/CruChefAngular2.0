const express = require('express');
const {
  getDishes,
  postDish,
  putDish,
  removeDish,
} = require('../controllers/dish.controller');
const { requireFirestore } = require('../middleware/require-firestore');

const router = express.Router();

router.get('/dishes', requireFirestore, getDishes);
router.post('/dishes', requireFirestore, postDish);
router.put('/dishes/:id', requireFirestore, putDish);
router.delete('/dishes/:id', requireFirestore, removeDish);

module.exports = router;
