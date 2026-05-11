const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const videoGenerateController = require('../controllers/videoGenerateController');

/** ==================== 原有路由（兼容旧版） ==================== */

/** 文生视频（与前端 /videos/text2video/:shotId 对齐） */
router.post('/text2video/:shotId', ...videoController.text2video);

router.post('/image2video/:shotId', ...videoController.image2video);

router.post('/reference2video/:shotId', ...videoController.reference2video);

router.post('/regenerate/:shotId', videoController.regenerate);

router.post('/merge', videoController.merge);

router.get('/', videoController.list);

router.get('/:video_id', videoController.getById);

router.post('/generate', videoController.generate);

router.get('/:video_id/status', videoController.status);

router.delete('/:video_id', videoController.remove);

/** ==================== CogVideoX视频生成API（新增） ==================== */

/**
 * POST /api/videos/generate
 * 通用视频生成接口
 */
router.post('/generate', videoGenerateController.generate);

/**
 * POST /api/videos/generate-shot/:shotId
 * 生成分镜视频（图生视频模式）
 */
router.post('/generate-shot/:shotId', videoGenerateController.generateShot);

/**
 * GET /api/videos/task/:taskId
 * 查询CogVideoX异步任务状态
 */
router.get('/task/:taskId', videoGenerateController.getTaskStatus);

/**
 * POST /api/videos/batch-generate
 * 批量生视频
 */
router.post('/batch-generate', videoGenerateController.batchGenerate);

/**
 * GET /api/videos/models
 * 获取支持的CogVideoX模型列表
 */
router.get('/models', videoGenerateController.getModels);

/**
 * GET /api/videos/test
 * 测试CogVideoX API连接
 */
router.get('/test', videoGenerateController.test);

module.exports = router;
