const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');

router.get('/', sceneController.list);

router.post('/generate', sceneController.generate);

router.put('/:id', sceneController.update);

router.delete('/:id', sceneController.remove);

module.exports = router;
