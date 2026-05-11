const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const scriptController = require('../controllers/scriptController');
// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 处理中文文件名编码
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeName = originalName.replace(/[^\w\u4e00-\u9fa5.\-]/g, '_');
    cb(null, Date.now() + '_' + safeName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.txt' || ext === '.docx' || ext === '.doc') {
      cb(null, true);
    } else {
      cb(new Error('只支持txt和docx文件'));
    }
  }
});

// 获取剧本列表
router.get('/', scriptController.list);

// 上传剧本
router.post('/upload', upload.single('file'), scriptController.upload);

// 删除剧本
router.delete('/:id', scriptController.remove);

// 更新剧本
router.put('/:id', scriptController.update);

// AI 剧本生成
router.post('/ai-generate', ...scriptController.aiGenerate);

module.exports = router;
