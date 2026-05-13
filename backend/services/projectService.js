const { pool } = require('../config/database');
const { generateShotsForScene } = require('./storyboard-split');

async function getTeamRole(teamId, userId) {
  if (!teamId) return null;
  const res = await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  return res.rows[0]?.role || null;
}

async function listProjects(userId) {
  const result = await pool.query(
    `SELECT p.*, t.name AS team_name
     FROM projects p
     LEFT JOIN teams t ON t.id = p.team_id
     WHERE p.user_id = $1
        OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function createProject({ userId, name, coverImage, teamId, description, status }) {
  const result = await pool.query(
    `INSERT INTO projects (user_id, name, cover_image, team_id, description, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, name, coverImage || null, teamId || null, description || null, status || 'active']
  );
  return result.rows[0];
}

async function getProjectById(projectId) {
  const res = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
  return res.rows[0] || null;
}

async function updateProject({ id, name, coverImage, currentVersion, description, status }) {
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
    [name ?? null, coverImage ?? null, currentVersion ?? null, description ?? null, status ?? null, id]
  );
  return result.rows[0] || null;
}

async function deleteProject(id) {
  const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] || null;
}

async function setProjectTeam({ projectId, teamId }) {
  const result = await pool.query('UPDATE projects SET team_id = $1 WHERE id = $2 RETURNING *', [teamId, projectId]);
  return result.rows[0] || null;
}

async function getLatestScriptIdForProject({ projectId, userId }) {
  const scriptRes = await pool.query(
    'SELECT id FROM scripts WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
    [projectId, userId]
  );
  return scriptRes.rows[0]?.id || null;
}

async function createFromTemplate({ templateId, projectName, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tplRes = await client.query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (tplRes.rows.length === 0) throw new Error('模板不存在');
    const tpl = tplRes.rows[0];

    const projRes = await client.query(
      `INSERT INTO projects (user_id, name, description, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [userId, projectName || `${tpl.name}_副本`, tpl.description]
    );
    const projectId = projRes.rows[0].id;

    const scriptRes = await client.query(
      `INSERT INTO scripts (project_id, user_id, title, content, status)
       VALUES ($1, $2, $3, $4, 'completed') RETURNING id`,
      [projectId, userId, `${tpl.name}_剧本`, tpl.script_template]
    );
    const scriptId = scriptRes.rows[0].id;

    const scenePrompts = typeof tpl.scene_prompts === 'string' ? JSON.parse(tpl.scene_prompts) : tpl.scene_prompts;
    for (let i = 0; i < scenePrompts.length; i++) {
      const sp = scenePrompts[i];
      const sceneRes = await client.query(
        `INSERT INTO scenes (script_id, user_id, scene_number, title, content, status)
         VALUES ($1, $2, $3, $4, $5, 'completed') RETURNING id`,
        [scriptId, userId, String(i + 1), sp.title, sp.content]
      );
      const sceneId = sceneRes.rows[0].id;

      const { shots } = generateShotsForScene({ id: sceneId, title: sp.title || `场景${i + 1}` }, sp.content);
      
      // 获取该剧本下的所有角色，用于匹配speaker
      const charsRes = await client.query('SELECT id, name FROM characters WHERE script_id = $1', [scriptId]);
      const charNameMap = {};
      for (const c of charsRes.rows) {
        charNameMap[c.name] = c.id;
      }
      
      for (const sh of shots) {
        // 通过speaker名匹配character_id
        let characterId = null;
        if (sh.speaker) {
          characterId = charNameMap[sh.speaker] || null;
        }
        
        await client.query(
          `INSERT INTO shots (
             scene_id, script_id, user_id, shot_number, shot_type, camera_movement,
             visual_description, visual_prompt, original_text, dialogue, action_description, duration, character_id, video_status, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'none', 'pending')`,
          [
            sceneId,
            scriptId,
            userId,
            sh.shot_number,
            sh.shot_type,
            sh.camera_movement,
            sh.visual_description || '',
            sh.visual_prompt || sh.visual_description || '',
            sh.original_text || '',
            sh.dialogue || '',
            sh.action_description || '',
            sh.duration ?? 4,
            characterId,
          ]
        );
      }
    }

    await client.query('UPDATE templates SET use_count = use_count + 1 WHERE id = $1', [templateId]);
    await client.query('COMMIT');
    return { project_id: projectId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  getTeamRole,
  listProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  setProjectTeam,
  getLatestScriptIdForProject,
  createFromTemplate,
};

