const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');

router.get('/', templateController.list);

router.get('/:id', templateController.get);

module.exports = router;
