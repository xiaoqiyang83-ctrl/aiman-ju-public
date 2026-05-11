const express = require('express');
const router = express.Router();
const shotController = require('../controllers/shotController');

router.get('/', shotController.list);

// 口型同步
router.post('/:id/lip-sync', shotController.lipSync);

router.get('/:id', shotController.get);

router.post('/', shotController.create);

router.put('/:id', shotController.update);

router.delete('/:id', shotController.remove);

module.exports = router;
