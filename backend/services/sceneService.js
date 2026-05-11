const { pool } = require('../config/database');
const { generateStoryboardFromScript } = require('./ai-service');

async function listScenes({ userId, scriptId, projectId }) {
  let query = 'SELECT * FROM scenes WHERE user_id = $1';
  const params = [userId];

  if (scriptId) {
    query += ` AND script_id = $${params.length + 1}`;
    params.push(scriptId);
  }

  if (projectId) {
    query += ` AND project_id = $${params.length + 1}`;
    params.push(projectId);
  }

  query += ' ORDER BY scene_number ASC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function regenerateStoryboard({ userId, scriptId }) {
  const client = await pool.connect();
  try {
    const scriptResult = await client.query('SELECT * FROM scripts WHERE id = $1 AND user_id = $2', [scriptId, userId]);
    if (scriptResult.rows.length === 0) {
      const err = new Error('剧本不存在');
      err.statusCode = 404;
      throw err;
    }

    const script = scriptResult.rows[0];

    await client.query('BEGIN');
    await client.query('DELETE FROM shots WHERE script_id = $1 AND user_id = $2', [scriptId, userId]);
    await client.query('DELETE FROM scenes WHERE script_id = $1 AND user_id = $2', [scriptId, userId]);

    const storyboard = await generateStoryboardFromScript({ title: script.title, content: script.content });
    const normalizedScenes = Array.isArray(storyboard?.data?.scenes) ? storyboard.data.scenes : [];
    if (!normalizedScenes.length) {
      throw new Error('分镜拆分失败：未返回任何场景');
    }

    const scenes = [];
    let shotCount = 0;

    for (let i = 0; i < normalizedScenes.length; i++) {
      const sc = normalizedScenes[i];
      const sceneInsert = await client.query(
        `INSERT INTO scenes (script_id, user_id, episode, scene_number, title, location, time_of_day, content, characters, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed')
         RETURNING *`,
        [
          scriptId,
          userId,
          sc.episode || '',
          String(sc.scene_number || i + 1),
          sc.title || '',
          sc.location || '',
          sc.time_of_day || '',
          sc.content || '',
          Array.isArray(sc.characters) ? sc.characters.join('、') : sc.characters || '',
        ]
      );
      const sceneRow = sceneInsert.rows[0];
      scenes.push(sceneRow);

      const shots = Array.isArray(sc.shots) ? sc.shots : [];
      for (let j = 0; j < shots.length; j++) {
        const sh = shots[j];
        shotCount += 1;
        await client.query(
          `INSERT INTO shots (
             scene_id, script_id, user_id, shot_number, shot_type, camera_movement,
             visual_description, visual_prompt, original_text, dialogue, action_description,
             duration, video_status, status
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'none','pending')`,
          [
            sceneRow.id,
            scriptId,
            userId,
            Number(sh.shot_number) || j + 1,
            sh.shot_type || '中景',
            sh.camera_movement || '固定',
            sh.visual_description || sh.visual_prompt || '',
            sh.visual_prompt || sh.visual_description || '',
            sh.original_text || '',
            sh.dialogue || '',
            sh.action_description || '',
            Number(sh.duration) || 4,
          ]
        );
      }
    }

    await client.query(`UPDATE scripts SET status = 'completed' WHERE id = $1 AND user_id = $2`, [scriptId, userId]);
    await client.query('COMMIT');

    return {
      scenes,
      provider: storyboard.provider,
      model: storyboard.model,
      sceneCount: scenes.length,
      shotCount,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

async function updateScene({ userId, id, title, location, timeOfDay, content, characters, sceneImageUrl }) {
  // 构建动态更新字段
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  if (title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(title);
  }
  if (location !== undefined) {
    updates.push(`location = $${paramIndex++}`);
    values.push(location);
  }
  if (timeOfDay !== undefined) {
    updates.push(`time_of_day = $${paramIndex++}`);
    values.push(timeOfDay);
  }
  if (content !== undefined) {
    updates.push(`content = $${paramIndex++}`);
    values.push(content);
  }
  if (characters !== undefined) {
    updates.push(`characters = $${paramIndex++}`);
    values.push(characters);
  }
  if (sceneImageUrl !== undefined) {
    updates.push(`scene_image_url = $${paramIndex++}`);
    values.push(sceneImageUrl);
  }
  
  if (updates.length === 0) {
    return null;
  }
  
  values.push(id, userId);
  
  const result = await pool.query(
    `UPDATE scenes SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function deleteScene({ userId, id }) {
  await pool.query('DELETE FROM scenes WHERE id = $1 AND user_id = $2', [id, userId]);
}

module.exports = {
  listScenes,
  regenerateStoryboard,
  updateScene,
  deleteScene,
};
