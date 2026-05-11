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

router.get('/', characterController.list);

router.get('/:id', characterController.get);

router.post('/', characterController.create);

router.put('/:id', characterController.update);

router.delete('/:id', characterController.remove);

router.post('/:id/upload-image', upload.single('image'), characterController.uploadImage);

router.post('/:id/ai-generate', characterController.aiGenerate);

module.exports = router;
