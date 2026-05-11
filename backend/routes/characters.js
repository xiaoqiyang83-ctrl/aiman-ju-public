const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const characterController = require('../controllers/characterController');

// 配置 multer 用于角色图片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/characters');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'char-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 基础CRUD
router.get('/', characterController.list);
router.get('/:id', characterController.get);
router.post('/', characterController.create);
router.put('/:id', characterController.update);
router.delete('/:id', characterController.remove);

// 图片上传
router.post('/:id/upload-image', upload.single('image'), characterController.uploadImage);

// AI生成
router.post('/:id/ai-generate', characterController.aiGenerate);

// ==================== v5.0 AI角色校准接口 ====================

// 触发AI校准 - 生成6层身份锚点
router.post('/:id/calibrate', characterController.calibrate);

// 编译视觉提示词
router.post('/:id/compile-prompt', characterController.compilePrompt);

// ==================== v5.0 角色变体 CRUD ====================

// 变体列表
router.get('/:character_id/variations', characterController.listVariations);

// 单个变体操作
router.get('/:character_id/variations/:id', characterController.getVariation);
router.post('/:character_id/variations', characterController.createVariation);
router.put('/:character_id/variations/:id', characterController.updateVariation);
router.delete('/:character_id/variations/:id', characterController.deleteVariation);

module.exports = router;
