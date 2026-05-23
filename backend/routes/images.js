/**
 * images.js - 图像生成路由
 * 统一处理生图相关API
 */

const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

// 通用生图
router.post('/generate', imageController.generate);

// 分镜生图
router.post('/generate-shot/:shotId', imageController.generateShot);

// 角色生图
router.post('/generate-character/:characterId', imageController.generateCharacter);

// 测试API
router.get('/test', imageController.test);

// 获取模型列表
router.get('/models', imageController.getModels);

module.exports = router;
