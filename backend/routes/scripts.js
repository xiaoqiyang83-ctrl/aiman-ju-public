const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { TextDecoder: UtilTextDecoder } = require('util');
const iconv = require('iconv-lite');

const Utf8FatalDecoder =
  typeof globalThis.TextDecoder !== 'undefined'
    ? new globalThis.TextDecoder('utf-8', { fatal: true })
    : new UtilTextDecoder('utf-8', { fatal: true });
const { pool } = require('../shared');
const mammoth = require('mammoth');
const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');
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

// 获取项目列表（用于自动选择）
async function getFirstProject(userId) {
  try {
    const result = await pool.query(
      'SELECT id FROM projects WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
      [userId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    // 没有项目就创建一个默认项目
    const createResult = await pool.query(
      'INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id',
      [userId, '默认项目']
    );
    return createResult.rows[0].id;
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    return null;
  }
}

/**
 * 读取 TXT 正文（自动识别 UTF-8 / GBK / UTF-16）
 * 说明：旧逻辑「先 GBK 再 UTF-8」会把 UTF-8 中文误判成 GBK，页面显示乱码。
 * 正确顺序：BOM → 严格 UTF-8 → GBK（Windows 记事本默认 ANSI）
 */
function readTxtFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (!buffer.length) return '';

    // UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.subarray(3).toString('utf8');
    }

    // UTF-16 LE BOM（Windows「Unicode」）
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      return buffer.subarray(2).toString('utf16le');
    }

    // UTF-16 BE BOM
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      const raw = buffer.subarray(2);
      const len = raw.length - (raw.length % 2);
      const swapped = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i += 2) {
        swapped[i] = raw[i + 1];
        swapped[i + 1] = raw[i];
      }
      return swapped.toString('utf16le');
    }

    const body = buffer;

    // 严格按 UTF-8 解码（非法序列会抛错，避免把 UTF-8 误判成 GBK）
    try {
      return Utf8FatalDecoder.decode(body);
    } catch {
      /* 非合法 UTF-8 字节流 */
    }

    // 简体中文 Windows 记事本「ANSI」一般为 GBK/CP936
    return iconv.decode(body, 'gbk');
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    return '文件读取失败';
  }
}

// 读取DOCX文件内容
async function readDocxFile(filePath) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value; // 返回提取的纯文本内容
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    return 'DOCX文件已导入';
  }
}

// 获取剧本列表
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const userId = 1; // 临时用户ID
    
    let projectId = parseInt(project_id);
    if (!projectId || isNaN(projectId)) {
      projectId = await getFirstProject(userId);
    }
    
    const result = await pool.query(
      'SELECT * FROM scripts WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [projectId, userId]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 上传剧本
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择文件' });
    }
    
    const rawProjectId = req.body.project_id ?? req.body.projectId;
    const userId = 1; // 临时用户ID

    // 获取或创建项目ID（与前端 FormData 字段 project_id 对齐，兼容 projectId）
    let projectId = parseInt(rawProjectId, 10);
    if (!projectId || isNaN(projectId)) {
      projectId = await getFirstProject(userId);
    }
    
    if (!projectId) {
      return res.status(400).json({ success: false, message: '请先选择一个项目' });
    }
    
    // 处理文件名
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    const title = path.basename(originalName, ext);
    
    // 读取文件内容
    let content = '';
    if (ext === '.txt') {
      content = readTxtFile(req.file.path);
    } else if (ext === '.docx' || ext === '.doc') {
      content = await readDocxFile(req.file.path);
    }
    
    // 保存到数据库
    const result = await pool.query(
      `INSERT INTO scripts (project_id, user_id, title, content, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [projectId, userId, title, content, 'pending']
    );
    
    // 删除临时文件
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      console.error('[Scripts] 临时文件删除失败:', e);
    }

    console.log('[Scripts] 上传成功:', title);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    // 清理临时文件
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('[Scripts] 操作失败后清理临时文件失败:', e);
      }
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除剧本
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 1;
    
    await pool.query(
      'DELETE FROM scripts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新剧本
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = 1;
    
    const result = await pool.query(
      `UPDATE scripts 
       SET title = $1, content = $2 
       WHERE id = $3 AND user_id = $4 
       RETURNING *`,
      [title, content, id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '剧本不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// AI 剧本生成
router.post('/ai-generate', checkCredits('script_generation'), async (req, res) => {
  try {
    const { project_id, prompt } = req.body;
    const userId = 1;

    // 扣减积分
    await deductCredits(userId, 'script_generation', `AI剧本生成: ${prompt.substring(0, 10)}...`);

    // Mock AI 生成内容
    const mockContent = `[AI生成的剧本]\n提示词: ${prompt}\n\n场景1: 这是一个模拟生成的剧本内容。\n场景2: 系统会自动根据您的提示词进行创作。\n场景3: 您可以继续修改或直接用于生成分镜。`;
    
    const result = await pool.query(
      `INSERT INTO scripts (project_id, user_id, title, content, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [project_id, userId, 'AI生成剧本_' + Date.now(), mockContent, 'completed']
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Scripts] AI生成失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
