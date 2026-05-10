const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../shared');
const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');

const userId = 1;

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
router.get('/library', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = 'SELECT * FROM audio_assets WHERE user_id = $1';
    const params = [userId];

    if (project_id) {
      query += ' AND (project_id = $2 OR project_id IS NULL)';
      params.push(project_id);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Audio] 获取音频库失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 上传音频
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择音频文件' });
    }

    const { project_id, audio_type } = req.body;
    const filePath = `/uploads/audio/${req.file.filename}`;
    
    // TODO: 接入 music-metadata 提取真实时长
    // 目前使用 Mock 时长 (3-30秒随机)
    const mockDuration = (Math.random() * 27 + 3).toFixed(2);

    const result = await pool.query(
      `INSERT INTO audio_assets (user_id, project_id, filename, file_path, audio_type, duration)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, project_id || null, req.file.originalname, filePath, audio_type || 'voice', mockDuration]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Audio] 上传音频失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除音频
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. 查询文件路径
    const assetRes = await pool.query(
      'SELECT file_path FROM audio_assets WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (assetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: '音频不存在' });
    }
    
    const filePath = path.join(__dirname, '..', assetRes.rows[0].file_path);
    
    // 2. 从数据库删除
    await pool.query('DELETE FROM audio_assets WHERE id = $1', [id]);
    
    // 3. 删除本地文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Audio] 删除音频失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 音色列表 - 直接从数据库 tts_voices 表读
router.get('/voices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tts_voices ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.json({
      success: true,
      data: [
        { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', language: '中文', gender: 'female' },
        { id: 'zh-CN-YunxiNeural', name: '云希', language: '中文', gender: 'male' },
      ],
    });
  }
});

router.get('/bgm-presets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bgm_presets ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.json({ success: true, data: [] });
  }
});

router.get('/sfx-presets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sfx_presets ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.json({ success: true, data: [] });
  }
});

// 应用 BGM 到场景（scene_audio 表结构：需 script_id / user_id）
router.post('/apply-bgm', async (req, res) => {
  try {
    const { scene_id, bgm_id, volume } = req.body;
    if (!scene_id) {
      return res.status(400).json({ success: false, message: '缺少 scene_id' });
    }
    const sceneRes = await pool.query(
      'SELECT script_id, user_id FROM scenes WHERE id = $1',
      [scene_id]
    );
    if (!sceneRes.rows.length) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }
    const { script_id, user_id } = sceneRes.rows[0];
    await pool.query(
      `INSERT INTO scene_audio (scene_id, user_id, script_id, audio_type, text_content, volume)
       VALUES ($1, $2, $3, 'bgm', $4, $5)`,
      [scene_id, user_id, script_id, String(bgm_id || ''), volume ?? 0.7]
    );
    res.json({ success: true, message: 'BGM应用成功' });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/apply-sfx', async (req, res) => {
  try {
    const { scene_id, sfx_id, volume } = req.body;
    if (!scene_id) {
      return res.status(400).json({ success: false, message: '缺少 scene_id' });
    }
    const sceneRes = await pool.query(
      'SELECT script_id, user_id FROM scenes WHERE id = $1',
      [scene_id]
    );
    if (!sceneRes.rows.length) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }
    const { script_id, user_id } = sceneRes.rows[0];
    await pool.query(
      `INSERT INTO scene_audio (scene_id, user_id, script_id, audio_type, text_content, volume)
       VALUES ($1, $2, $3, 'sfx', $4, $5)`,
      [scene_id, user_id, script_id, String(sfx_id || ''), volume ?? 0.8]
    );
    res.json({ success: true, message: '音效应用成功' });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/generate-voice', checkCredits('tts_generation'), async (req, res) => {
  try {
    const { shot_id, text, voice_id } = req.body;
    
    // 扣减积分
    await deductCredits(userId, 'tts_generation', `生成配音: ${text.substring(0, 10)}...`);

    res.json({
      success: true,
      message: '配音生成中',
      data: { shot_id }
    });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
