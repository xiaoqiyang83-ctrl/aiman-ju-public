const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

router.post('/', teamController.create);

router.get('/', teamController.list);

router.post('/:id/members', teamController.addMember);

router.put('/:id/members/:uid', teamController.updateMemberRole);

module.exports = router;
