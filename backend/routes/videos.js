const express = require('express');
const router = express.Router();
const { pool } = require('../shared');
const { submitVideoJob, submitExportJob } = require('../queues/submit');
const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');

const userId = 1;

/** 文生视频（与前端 /videos/text2video/:shotId 对齐） */
router.post('/text2video/:shotId', checkCredits('video_generation'), async (req, res) => {
  try {
    const shotId = parseInt(req.params.shotId, 10);
    if (!shotId || Number.isNaN(shotId)) {
      return res.status(400).json({ success: false, message: '无效的镜头ID' });
    }
    const shotRes = await pool.query(
      `SELECT sh.id, sh.script_id, sc.project_id
       FROM shots sh
       JOIN scripts sc ON sc.id = sh.script_id
       WHERE sh.id = $1`,
      [shotId]
    );
    if (!shotRes.rows.length) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }
    const row = shotRes.rows[0];
    const params = { ...req.body, projectId: row.project_id, scriptId: row.script_id };
    
    // 扣减积分
    await deductCredits(userId, 'video_generation', `生成镜头视频 #${shotId}`);

    const jobId = await submitVideoJob(shotId, 'text2video', params, userId);
    res.json({ success: true, message: '视频生成任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/image2video/:shotId', checkCredits('video_generation'), async (req, res) => {
  try {
    const shotId = parseInt(req.params.shotId, 10);
    if (!shotId || Number.isNaN(shotId)) {
      return res.status(400).json({ success: false, message: '无效的镜头ID' });
    }
    const shotRes = await pool.query(
      `SELECT sh.id, sh.script_id, sc.project_id
       FROM shots sh
       JOIN scripts sc ON sc.id = sh.script_id
       WHERE sh.id = $1`,
      [shotId]
    );
    if (!shotRes.rows.length) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }
    const row = shotRes.rows[0];
    const params = { ...req.body, projectId: row.project_id, scriptId: row.script_id };
    
    // 确保场景图地址正确传递给 Worker
    if (req.body.scene_image_url) {
      params.scene_image_url = req.body.scene_image_url;
    }

    // 扣减积分
    await deductCredits(userId, 'video_generation', `图生视频 #${shotId}`);

    const jobId = await submitVideoJob(shotId, 'image2video', params, userId);
    res.json({ success: true, message: '任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reference2video/:shotId', checkCredits('video_generation'), async (req, res) => {
  try {
    const shotId = parseInt(req.params.shotId, 10);
    if (!shotId || Number.isNaN(shotId)) {
      return res.status(400).json({ success: false, message: '无效的镜头ID' });
    }
    const shotRes = await pool.query(
      `SELECT sh.id, sh.script_id, sc.project_id
       FROM shots sh
       JOIN scripts sc ON sc.id = sh.script_id
       WHERE sh.id = $1`,
      [shotId]
    );
    if (!shotRes.rows.length) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }
    const row = shotRes.rows[0];
    const params = { ...req.body, projectId: row.project_id, scriptId: row.script_id };
    
    // 如果有 character_id，获取其参考图
    if (params.character_id) {
      const charRes = await pool.query(
        'SELECT reference_image, image_url FROM characters WHERE id = $1',
        [params.character_id]
      );
      if (charRes.rows.length > 0) {
        params.reference_image = charRes.rows[0].reference_image || charRes.rows[0].image_url;
      }
    }

    // 扣减积分
    await deductCredits(userId, 'video_generation', `参考生视频 #${shotId}`);

    const jobId = await submitVideoJob(shotId, 'reference2video', params, userId);
    res.json({ success: true, message: '任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/regenerate/:shotId', async (req, res) => {
  try {
    const shotId = parseInt(req.params.shotId, 10);
    if (!shotId || Number.isNaN(shotId)) {
      return res.status(400).json({ success: false, message: '无效的镜头ID' });
    }
    const shotRes = await pool.query(
      `SELECT sh.*, sc.project_id
       FROM shots sh
       JOIN scripts sc ON sc.id = sh.script_id
       WHERE sh.id = $1`,
      [shotId]
    );
    if (!shotRes.rows.length) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }
    const shot = shotRes.rows[0];
    const params = {
      ...req.body,
      projectId: shot.project_id,
      scriptId: shot.script_id,
      visual_description: shot.visual_description,
      shot_type: shot.shot_type,
      camera_movement: shot.camera_movement,
    };
    const jobId = await submitVideoJob(shotId, 'text2video', params, userId);
    res.json({ success: true, message: '重新生成任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/merge', async (req, res) => {
  try {
    const project_id = req.body.project_id;
    if (!project_id) {
      return res.status(400).json({ success: false, message: '缺少 project_id' });
    }
    const { jobId, exportId } = await submitExportJob(project_id, req.body, userId);
    res.json({ success: true, message: '拼接任务已提交', data: { job_id: jobId, export_id: exportId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let q = 'SELECT * FROM videos';
    const p = [];
    if (project_id) {
      q += ' WHERE project_id = $1';
      p.push(project_id);
    }
    q += ' ORDER BY created_at DESC';
    const result = await pool.query(q, p);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:video_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [req.params.video_id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { project_id, quality } = req.body;
    const result = await pool.query(
      `INSERT INTO videos (project_id, status, quality, progress)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [project_id, 'processing', quality || '720p', 0]
    );
    res.json({ success: true, message: '开始生成视频', data: result.rows[0] });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:video_id/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT status, progress FROM videos WHERE id = $1', [
      req.params.video_id,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:video_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id = $1', [req.params.video_id]);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
