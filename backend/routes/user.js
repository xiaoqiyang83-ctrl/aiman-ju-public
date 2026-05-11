const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// 获取会员状态
router.get('/membership', userController.membership);

// 获取积分信息和流水
router.get('/credits', userController.credits);

// 扣减积分接口 (供内部或前端显式调用)
router.post('/credits/deduct', userController.creditsDeduct);

// Mock 充值接口
router.post('/credits/recharge', userController.creditsRecharge);

module.exports = router;
