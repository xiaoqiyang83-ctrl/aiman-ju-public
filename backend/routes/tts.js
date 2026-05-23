// ========================================
// AIManju v5.2+ TTS路由
// ========================================

const express = require('express');
const router = express.Router();
const ttsController = require('../controllers/ttsController');

// 获取可用音色列表
router.get('/voices', ttsController.getVoices);

// 获取音色详情
router.get('/voice/:voiceId', ttsController.getVoiceDetail);

// 获取支持的情感风格列表
router.get('/emotions', ttsController.getEmotions);

// 生成单个镜头配音
router.post('/generate', ttsController.generate);

// 批量生成配音
router.post('/generate-batch', ttsController.generateBatch);

// 预览配音（不保存）
router.post('/preview', ttsController.preview);

// 文本转音频
router.post('/text-to-audio', ttsController.textToAudio);

// 删除镜头配音
router.delete('/:shotId', ttsController.remove);

// 获取剧本下所有镜头的配音状态
router.get('/status/:scriptId', ttsController.getStatus);

// 更新角色默认音色
router.put('/character-voice', ttsController.updateCharacterVoice);

module.exports = router;
