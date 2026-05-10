const express = require('express');
const router = express.Router();
const { pool } = require('../shared');
const { submitLipSyncJob } = require('../queues/submit');

const userId = 1;
router.get('/', async (req, res) => {
  try {
    const { scene_id } = req.query;
    let q = 'SELECT * FROM shots';
    const p = [];
    if (scene_id) {
      q += ' WHERE scene_id = $1';
      p.push(scene_id);
    }
    q += ' ORDER BY shot_number ASC';
    const result = await pool.query(q, p);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 口型同步
router.post('/:id/lip-sync', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. 检查镜头数据
    const shotRes = await pool.query(
      'SELECT video_url, audio_url FROM shots WHERE id = $1',
      [id]
    );
    
    if (shotRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }
    
    const shot = shotRes.rows[0];
    if (!shot.video_url || !shot.audio_url) {
      return res.status(400).json({ 
        success: false, 
        message: '口型同步需要同时具备视频和配音音频，请先生成视频和配音' 
      });
    }
    
    // 2. 提交任务
    const jobId = await submitLipSyncJob(id, {
      video_url: shot.video_url,
      audio_url: shot.audio_url
    }, userId);
    
    res.json({ 
      success: true, 
      message: '口型同步任务已提交', 
      data: { job_id: jobId } 
    });
  } catch (err) {
    console.error('[Shots] 口型同步失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shots/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shots WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shots
router.post('/', async (req, res) => {
  try {
    const { scene_id, shot_number, visual_description, duration, character_id, scene_image_url, character_angle } = req.body;
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
    const result = await pool.query(
      `INSERT INTO shots (scene_id, script_id, user_id, shot_number, visual_description, duration, character_id, scene_image_url, character_angle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        scene_id,
        script_id,
        user_id,
        shot_number || 1,
        visual_description || '',
        duration !== undefined && duration !== null ? duration : 3,
        character_id || null,
        scene_image_url || null,
        character_angle || 'front'
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/shots/:id（与前端 Workspace 保存字段一致；表内无 updated_at 列）
router.put('/:id', async (req, res) => {
  try {
    const {
      shot_number,
      shot_type,
      camera_movement,
      visual_description,
      dialogue,
      action_description,
      duration,
      character_id,
      scene_image_url,
      character_angle
    } = req.body;
    const result = await pool.query(
      `UPDATE shots SET
        shot_number = COALESCE($1, shot_number),
        shot_type = COALESCE($2, shot_type),
        camera_movement = COALESCE($3, camera_movement),
        visual_description = COALESCE($4, visual_description),
        dialogue = COALESCE($5, dialogue),
        action_description = COALESCE($6, action_description),
        duration = COALESCE($7, duration),
        character_id = COALESCE($8, character_id),
        scene_image_url = COALESCE($9, scene_image_url),
        character_angle = COALESCE($10, character_angle)
      WHERE id = $11
      RETURNING *`,
      [
        shot_number ?? null,
        shot_type ?? null,
        camera_movement ?? null,
        visual_description ?? null,
        dialogue ?? null,
        action_description ?? null,
        duration ?? null,
        character_id ?? null,
        scene_image_url ?? null,
        character_angle ?? null,
        req.params.id,
      ]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/shots/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM shots WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
