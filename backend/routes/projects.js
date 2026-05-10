const express = require('express');
const router = express.Router();
const { pool } = require('../shared');
const { submitAutoGenerateJob } = require('../queues/submit');
const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');

const userId = 1;

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

async function getTeamRole(teamId, userId) {
  if (!teamId) return null;
  const res = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return res.rows[0]?.role || null;
}

function canEdit(role) {
  return role === 'owner' || role === 'admin';
}

// 从模板创建项目
router.post('/from-template', async (req, res) => {
  const client = await pool.connect();
  try {
    const { template_id, project_name } = req.body;
    
    await client.query('BEGIN');

    // 1. 获取模板数据
    const tplRes = await client.query('SELECT * FROM templates WHERE id = $1', [template_id]);
    if (tplRes.rows.length === 0) throw new Error('模板不存在');
    const tpl = tplRes.rows[0];

    // 2. 创建项目
    const projRes = await client.query(
      `INSERT INTO projects (user_id, name, description, status) 
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [userId, project_name || `${tpl.name}_副本`, tpl.description]
    );
    const projectId = projRes.rows[0].id;

    // 3. 创建剧本
    const scriptRes = await client.query(
      `INSERT INTO scripts (project_id, user_id, title, content, status) 
       VALUES ($1, $2, $3, $4, 'completed') RETURNING id`,
      [projectId, userId, `${tpl.name}_剧本`, tpl.script_template]
    );
    const scriptId = scriptRes.rows[0].id;

    // 4. 创建场景和分镜 (基于模板预设)
    const scenePrompts = typeof tpl.scene_prompts === 'string' ? JSON.parse(tpl.scene_prompts) : tpl.scene_prompts;
    
    for (let i = 0; i < scenePrompts.length; i++) {
      const sp = scenePrompts[i];
      // 创建场景
      const sceneRes = await client.query(
        `INSERT INTO scenes (script_id, user_id, scene_number, title, content, status) 
         VALUES ($1, $2, $3, $4, $5, 'completed') RETURNING id`,
        [scriptId, userId, String(i + 1), sp.title, sp.content]
      );
      const sceneId = sceneRes.rows[0].id;

      const shots = splitToShots(sp.content);
      for (const sh of shots) {
        await client.query(
          `INSERT INTO shots (
             scene_id, script_id, user_id, shot_number, shot_type, camera_movement,
             visual_description, duration, video_status, status
           ) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, 5, 'none', 'pending')`,
          [sceneId, scriptId, userId, sh.shot_number, sh.shot_type, sh.camera_movement, sh.visual_description]
        );
      }
    }

    // 5. 更新模板使用计数
    await client.query('UPDATE templates SET use_count = use_count + 1 WHERE id = $1', [template_id]);

    await client.query('COMMIT');
    res.json({ success: true, data: { project_id: projectId } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Projects] 从模板创建失败:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// 获取项目列表
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const result = await pool.query(
      `SELECT p.*, t.name AS team_name
       FROM projects p
       LEFT JOIN teams t ON t.id = p.team_id
       WHERE p.user_id = $1
          OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
       ORDER BY p.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 创建项目
router.post('/', async (req, res) => {
  try {
    const { name, cover_image, description, status, team_id } = req.body;
    const userId = req.user?.id || 1;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '请输入项目名称' });
    }

    let teamId = team_id ? Number(team_id) : null;
    if (teamId && Number.isNaN(teamId)) teamId = null;
    if (teamId) {
      const role = await getTeamRole(teamId, userId);
      if (!role) {
        return res.status(403).json({ success: false, message: '你不是该团队成员，无法关联到团队' });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, cover_image, team_id, description, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [userId, name, cover_image || null, teamId, description || null, status || 'active']
    );
    
    console.log('[Projects] 创建成功:', name);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新项目
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cover_image, current_version, description, status } = req.body;
    const userId = req.user?.id || 1;

    const pRes = await pool.query('SELECT id, user_id, team_id FROM projects WHERE id = $1', [id]);
    if (!pRes.rows.length) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    const project = pRes.rows[0];
    if (project.user_id !== userId) {
      const role = await getTeamRole(project.team_id, userId);
      if (!canEdit(role)) {
        return res.status(403).json({ success: false, message: '没有权限编辑该项目' });
      }
    }

    const result = await pool.query(
      `UPDATE projects 
       SET 
         name = COALESCE($1, name),
         cover_image = COALESCE($2, cover_image),
         current_version = COALESCE($3, current_version),
         description = COALESCE($4, description),
         status = COALESCE($5, status)
       WHERE id = $6 
       RETURNING *`,
      [name ?? null, cover_image ?? null, current_version ?? null, description ?? null, status ?? null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除项目
// 注意：数据库已设置ON DELETE CASCADE，删除项目会自动删除所有关联数据
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;

    const pRes = await pool.query('SELECT id, name, user_id, team_id FROM projects WHERE id = $1', [id]);
    if (!pRes.rows.length) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    const project = pRes.rows[0];
    if (project.user_id !== userId) {
      const role = await getTeamRole(project.team_id, userId);
      if (role !== 'owner') {
        return res.status(403).json({ success: false, message: '只有 owner 可以删除团队项目' });
      }
    }

    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    console.log('[Projects] 删除成功:', result.rows[0].name);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/team', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const projectId = Number(req.params.id);
    const teamId = req.body?.team_id ? Number(req.body.team_id) : null;
    if (!projectId || Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, message: '无效的项目ID' });
    }
    if (req.body?.team_id && Number.isNaN(teamId)) {
      return res.status(400).json({ success: false, message: '无效的 team_id' });
    }

    const pRes = await pool.query('SELECT id, user_id FROM projects WHERE id = $1', [projectId]);
    if (!pRes.rows.length) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    if (pRes.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: '只有项目创建者可以设置团队' });
    }

    if (teamId) {
      const role = await getTeamRole(teamId, userId);
      if (!canEdit(role) && role !== 'member') {
        return res.status(403).json({ success: false, message: '你不是该团队成员' });
      }
    }

    const result = await pool.query(
      `UPDATE projects SET team_id = $1 WHERE id = $2 RETURNING *`,
      [teamId, projectId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Projects] 设置团队失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 一键成片
router.post('/:id/auto-generate', checkCredits('auto_generate'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. 检查剧本是否存在
    const scriptRes = await pool.query(
      'SELECT id FROM scripts WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      [id, userId]
    );
    
    if (scriptRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: '该项目尚未上传剧本，无法一键成片' });
    }
    
    const scriptId = scriptRes.rows[0].id;
    
    // 2. 扣减积分
    await deductCredits(userId, 'auto_generate', `一键成片: 项目 #${id}`);

    // 3. 提交一键成片任务
    const jobId = await submitAutoGenerateJob(id, { scriptId }, userId);
    
    res.json({ 
      success: true, 
      message: '一键成片任务已启动', 
      data: { job_id: jobId } 
    });
  } catch (err) {
    console.error('[Projects] 一键成片失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
