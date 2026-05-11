const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

router.get('/', taskController.list);

router.get('/:task_id', taskController.get);

router.post('/', taskController.create);

router.post('/:task_id/cancel', taskController.cancel);

router.post('/:task_id/retry', taskController.retry);

module.exports = router;
