const express = require('express');
const router = express.Router();
const projectVersionController = require('../controllers/projectVersionController');

router.get('/project/:project_id', projectVersionController.listByProject);

router.post('/', projectVersionController.create);

router.get('/:version_id', projectVersionController.get);

router.delete('/:version_id', projectVersionController.remove);

module.exports = router;
