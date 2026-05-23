const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const shotController = require('../controllers/shotController');

// 配置multer用于分镜参考图上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'ref-shot-' + Date.now() + '-' + Math.round(Math.random() * 1000) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', shotController.list);

// 上传分镜参考图
router.post('/:id/upload-ref-image', upload.single('image'), shotController.uploadRefImage);

// 口型同步
router.post('/:id/lip-sync', shotController.lipSync);

router.get('/:id', shotController.get);

router.post('/', shotController.create);

router.put('/:id', shotController.update);

router.delete('/:id', shotController.remove);

module.exports = router;
