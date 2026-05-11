const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

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

module.exports = router;
