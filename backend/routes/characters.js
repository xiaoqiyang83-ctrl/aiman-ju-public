const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../shared');

const userId = 1;

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

// 获取角色列表
router.get('/', async (req, res) => {
  try {
    const { script_id, project_id } = req.query;
    let q = 'SELECT * FROM characters WHERE user_id = $1';
    const p = [userId];
    if (script_id) {
      p.push(script_id);
      q += ` AND script_id = $${p.length}`;
    } else if (project_id) {
      p.push(project_id);
      q += ` AND script_id IN (SELECT id FROM scripts WHERE project_id = $${p.length} AND user_id = $1)`;
    }
    q += ' ORDER BY created_at DESC';
    const result = await pool.query(q, p);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM characters WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { script_id, name, description, image_url, front_image_url, side_image_url, back_image_url, expressions, costumes } = req.body;
    if (!script_id) {
      return res.status(400).json({ success: false, message: '缺少 script_id' });
    }
    const result = await pool.query(
      `INSERT INTO characters (script_id, user_id, name, description, image_url, front_image_url, side_image_url, back_image_url, expressions, costumes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        script_id, 
        userId, 
        name || '新角色', 
        description || '', 
        image_url || null,
        front_image_url || null,
        side_image_url || null,
        back_image_url || null,
        expressions ? JSON.stringify(expressions) : '[]',
        costumes ? JSON.stringify(costumes) : '[]'
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, image_url, front_image_url, side_image_url, back_image_url, expressions, costumes } = req.body;
    const result = await pool.query(
      `UPDATE characters
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           image_url = COALESCE($3, image_url),
           front_image_url = COALESCE($4, front_image_url),
           side_image_url = COALESCE($5, side_image_url),
           back_image_url = COALESCE($6, back_image_url),
           expressions = COALESCE($7, expressions),
           costumes = COALESCE($8, costumes)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        image_url ?? null,
        front_image_url ?? null,
        side_image_url ?? null,
        back_image_url ?? null,
        expressions ? JSON.stringify(expressions) : null,
        costumes ? JSON.stringify(costumes) : null,
        req.params.id,
        userId,
      ]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. 先检查角色是否存在以及权限
    const checkRes = await pool.query(
      'SELECT * FROM characters WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: '角色不存在或无权删除' });
    }

    const char = checkRes.rows[0];

    // 2. 执行物理删除
    await pool.query(
      'DELETE FROM characters WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    // 3. 尝试清理相关的本地图片文件
    try {
      if (char.image_url && char.image_url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', char.image_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      if (char.reference_image && char.reference_image.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', char.reference_image);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.error('[Characters] 清理文件失败:', e);
    }

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择图片文件' });
    }
    
    const { image_type } = req.body; // 'avatar', 'reference', 'front', 'side', 'back', 'expression', 'costume'
    const imageUrl = `/uploads/characters/${req.file.filename}`;
    
    let column = '';
    let isJson = false;
    
    switch (image_type) {
      case 'reference': column = 'reference_image'; break;
      case 'front': column = 'front_image_url'; break;
      case 'side': column = 'side_image_url'; break;
      case 'back': column = 'back_image_url'; break;
      case 'expression': 
      case 'costume': 
        isJson = true;
        break;
      default: column = 'image_url';
    }
    
    let result;
    if (isJson) {
      const { name } = req.body;
      const field = image_type === 'expression' ? 'expressions' : 'costumes';
      
      // 先获取旧数据
      const oldRes = await pool.query(`SELECT ${field} FROM characters WHERE id = $1`, [req.params.id]);
      let list = oldRes.rows[0]?.[field] || [];
      if (typeof list === 'string') list = JSON.parse(list);
      
      list.push({ name: name || `未命名${image_type}`, url: imageUrl });
      
      result = await pool.query(
        `UPDATE characters SET ${field} = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
        [JSON.stringify(list), req.params.id, userId]
      );
    } else {
      result = await pool.query(
        `UPDATE characters SET ${column} = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
        [imageUrl, req.params.id, userId]
      );
    }
    
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }
    
    res.json({ success: true, data: result.rows[0], image_url: imageUrl });
  } catch (err) {
    console.error('[Characters] 图片上传失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/ai-generate', async (req, res) => {
  try {
    res.json({
      success: true,
      message: '生成中',
      data: { character_id: req.params.id, image_url: '' },
    });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
