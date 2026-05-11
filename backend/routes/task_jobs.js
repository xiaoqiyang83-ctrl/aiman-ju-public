const express = require('express');
const router = express.Router();
const taskJobController = require('../controllers/taskJobController');

router.get('/', taskJobController.list);

router.get('/:job_id', taskJobController.get);

router.post('/', taskJobController.create);

router.post('/:job_id/cancel', taskJobController.cancel);

module.exports = router;
