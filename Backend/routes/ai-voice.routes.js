const express = require('express');
const {
  createDishFromVoice,
  textToDish,
} = require('../controllers/ai-voice.controller');
const { requireFirestore } = require('../middleware/require-firestore');

const router = express.Router();

router.post('/text-to-dish', requireFirestore, textToDish);
router.post('/create-dish-from-voice', requireFirestore, createDishFromVoice);

module.exports = router;
