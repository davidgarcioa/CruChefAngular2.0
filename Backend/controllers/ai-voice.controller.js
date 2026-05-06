const aiVoiceService = require('../services/ai-voice.service');

async function textToDish(req, res) {
  try {
    const result = await aiVoiceService.textToDish({
      transcript: req.body.transcript,
      restaurantId: req.body.restaurant_id,
      ownerUid: req.body.owner_uid,
      restaurantName: req.body.restaurant_name,
    });

    return res.json({
      success: true,
      message: 'Datos extraidos correctamente',
      dish: result.dish,
      transcript: result.transcript,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar el texto.';
    return res.status(400).json({ success: false, message });
  }
}

async function createDishFromVoice(req, res) {
  try {
    const dish = await aiVoiceService.createDishFromVoice({
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      restaurantId: req.body.restaurant_id,
      ownerUid: req.body.owner_uid,
      restaurantName: req.body.restaurant_name,
    });

    return res.status(201).json({
      success: true,
      message: `Plato "${dish.name}" creado exitosamente`,
      dish: {
        name: dish.name,
        price: dish.price,
        category: dish.categoryId,
        confidence: 1,
      },
      firebase_id: dish.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el plato.';
    return res.status(400).json({ success: false, message });
  }
}

module.exports = {
  createDishFromVoice,
  textToDish,
};
