const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const audioController = require('../controllers/audioController');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/audio';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp3', '.wav', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 mp3/wav/ogg 格式'));
    }
  },
});

// 获取音频库
router.get('/library', audioController.library);

// 上传音频
router.post('/upload', upload.single('audio'), audioController.upload);

// 删除音频
router.delete('/:id', audioController.remove);

// 音色列表 - 直接从数据库 tts_voices 表读
router.get('/voices', audioController.voices);

router.get('/bgm-presets', audioController.bgmPresets);

router.get('/sfx-presets', audioController.sfxPresets);

// 应用 BGM 到场景（scene_audio 表结构：需 script_id / user_id）
router.post('/apply-bgm', audioController.applyBgm);

router.post('/apply-sfx', audioController.applySfx);

router.post('/generate-voice', ...audioController.generateVoice);

module.exports = router;
