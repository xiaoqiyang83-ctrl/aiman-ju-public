const express = require('express');
const router = express.Router();
const { pool } = require('../shared');

function splitToShots(content) {
  const text = String(content || '').trim();
  const parts = text
    .split(/[\n。！？!?]/)
    .map(s => s.trim())
    .filter(Boolean);

  const length = text.length;
  let count = length < 20 ? 2 : 3;
  if (length >= 180) count = 4;
  if (parts.length >= 3 && count < 3) count = 3;
  if (parts.length >= 4 && count < 4) count = 4;
  if (count < 2) count = 2;

  const buckets = Array.from({ length: count }, () => []);
  for (let i = 0; i < parts.length; i++) {
    buckets[i % count].push(parts[i]);
  }

  const shotTypes = ['全景', '中景', '近景', '特写'];
  return buckets.map((bucket, idx) => ({
    shot_number: idx + 1,
    shot_type: shotTypes[idx] || '中景',
    camera_movement: '固定',
    visual_description: bucket.join('，') || text
  }));
}

// 获取场景列表
router.get('/', async (req, res) => {
  try {
    const { script_id, project_id } = req.query;
    const userId = 1;
    
    let query = 'SELECT * FROM scenes WHERE user_id = $1';
    let params = [userId];
    
    if (script_id) {
      query += ' AND script_id = $2';
      params.push(script_id);
    }
    
    if (project_id) {
      query += ' AND project_id = $' + (params.length + 1);
      params.push(project_id);
    }
    
    query += ' ORDER BY scene_number ASC';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 生成分镜
router.post('/generate', async (req, res) => {
  try {
    //const { script_id, project_id } = req.body;
     //  同时从 query 和 body 取参数，支持两种传参方式
    const script_id = req.body.script_id || req.query.script_id;
    const project_id = req.body.project_id || req.query.project_id;
    const userId = 1;
    
    if (!script_id) {
      return res.status(400).json({ success: false, message: '请选择剧本' });
    }
    
    // 获取剧本内容
    const scriptResult = await pool.query(
      'SELECT * FROM scripts WHERE id = $1 AND user_id = $2',
      [script_id, userId]
    );
    
    if (scriptResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '剧本不存在' });
    }
    
    const script = scriptResult.rows[0];
    
    // 简单的分镜生成逻辑（这里只是示例，实际需要AI解析）
    // 按换行分割，每几行生成一个场景
    const lines = script.content.split('\n').filter(line => line.trim());
    const scenes = [];
    
    for (let i = 0; i < lines.length; i += 3) {
      const sceneNumber = Math.floor(i / 3) + 1;
      const content = lines.slice(i, i + 3).join('\n');
      
      // 表结构以 init.sql 为准：scenes 无 project_id；镜头需单独写入 shots，视频页才有数据
      const result = await pool.query(
        `INSERT INTO scenes (script_id, user_id, scene_number, title, content, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          script_id,
          userId,
          String(sceneNumber),
          `场景${sceneNumber}`,
          content,
          'pending',
        ]
      );

      const sceneRow = result.rows[0];

      const shots = splitToShots(content);
      for (const sh of shots) {
        await pool.query(
          `INSERT INTO shots (
             scene_id, script_id, user_id, shot_number, shot_type, camera_movement,
             visual_description, duration, video_status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, 5, 'none')`,
          [
            sceneRow.id,
            script_id,
            userId,
            sh.shot_number,
            sh.shot_type,
            sh.camera_movement,
            sh.visual_description || ''
          ]
        );
      }

      scenes.push(sceneRow);
    }
    
    console.log('[Scenes] 生成成功:', scenes.length, '个场景');
    res.json({ success: true, data: scenes });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新场景
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, location, time_of_day, content, characters } = req.body;
    const userId = 1;
    
    const result = await pool.query(
      `UPDATE scenes 
       SET title = $1, location = $2, time_of_day = $3, content = $4, characters = $5 
       WHERE id = $6 AND user_id = $7 
       RETURNING *`,
      [title, location, time_of_day, content, characters, id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除场景
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 1;
    
    await pool.query(
      'DELETE FROM scenes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
