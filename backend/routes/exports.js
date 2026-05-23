const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/project/:project_id/list', exportController.listByProject);

router.post('/', exportController.create);

router.post('/video', exportController.exportVideo);

router.post('/pdf', exportController.exportPdf);

router.get('/:export_id/status', exportController.status);

router.get('/:export_id/download', exportController.download);

router.delete('/:export_id', exportController.remove);

module.exports = router;
