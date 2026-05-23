const express = require('express');
const router = express.Router();
const versionController = require('../controllers/versionController');

// 映射到 project_versions 表
router.get('/project/:project_id', versionController.listProjectVersions);

router.post('/', versionController.create);

router.get('/:version_id', versionController.get);

router.post('/:version_id/restore', versionController.restore);

router.delete('/:version_id', versionController.remove);

module.exports = router;
