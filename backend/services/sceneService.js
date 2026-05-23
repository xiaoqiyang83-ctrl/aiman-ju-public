const { pool } = require('../shared');
const { generateStoryboardFromScript } = require('./ai-service');

/**
 * 格式化角色圣经
 * 从characters表读取identity_anchors，格式化为prompt注入文本
 */
async function formatCharacterBible(scriptId) {
    try {
        const charResult = await pool.query(
            'SELECT id, name, description, identity_anchors FROM characters WHERE script_id = $1',
            [scriptId]
        );
        
        if (charResult.rows.length === 0) {
            return '';
        }
        
        const bibleParts = ['【角色圣经】'];
        for (const char of charResult.rows) {
            const name = char.name || '未命名角色';
            let description = char.description || '';
            
            // 如果有identity_anchors JSONB，格式化输出
            if (char.identity_anchors && typeof char.identity_anchors === 'object') {
                const anchors = char.identity_anchors;
                const anchorDesc = [];
                if (anchors.gender) anchorDesc.push(anchors.gender);
                if (anchors.age) anchorDesc.push(anchors.age);
                if (anchors.physique) anchorDesc.push(anchors.physique);
                if (anchors.face) anchorDesc.push(anchors.face);
                if (anchors.hair) anchorDesc.push(anchors.hair);
                if (anchors.clothing) anchorDesc.push(anchors.clothing);
                
                if (anchorDesc.length > 0) {
                    description = anchorDesc.join('，');
                }
            }
            
            bibleParts.push(`@${name}：${description}`);
        }
        
        return bibleParts.join('\n');
    } catch (error) {
        console.error('[SceneService] 格式化角色圣经失败:', error.message);
        return '';
    }
}

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

    // v5.3: 获取角色圣经
    const characterBible = await formatCharacterBible(scriptId);
    console.log('[SceneService] 角色圣经:', characterBible.substring(0, 200) + '...');

    // v5.3: 传入角色圣经
    const storyboard = await generateStoryboardFromScript({ 
      title: script.title, 
      content: script.content,
      character_bible: characterBible
    });
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
        
        // v5.3: 处理visual_prompt（可能是对象或字符串）
        const visualPromptData = typeof sh.visual_prompt === 'object' && sh.visual_prompt !== null 
          ? sh.visual_prompt 
          : { 
              lighting: sh.visual_prompt || sh.visual_description || '',
              color_palette: '',
              character_placement: '',
              facial_detail: '',
              scene_description: sh.visual_prompt || sh.visual_description || '',
              composition: ''
            };
        
        // v5.3: 处理action_prompt
        const actionPromptData = typeof sh.action_prompt === 'object' && sh.action_prompt !== null
          ? sh.action_prompt
          : {
              physical_action: sh.action_prompt || sh.action_description || '',
              micro_movement: ''
            };
        
        // v5.3: 处理emotion_cue
        const emotionCueData = typeof sh.emotion_cue === 'object' && sh.emotion_cue !== null
          ? sh.emotion_cue
          : {
              primary_emotion: '',
              visual_mapping: ''
            };
        
        await client.query(
          `INSERT INTO shots (
             scene_id, script_id, user_id, shot_number, shot_type, camera_angle, camera_movement,
             visual_description, visual_prompt, original_text, dialogue, action_description,
             duration, video_status, status,
             -- v5.3 新增字段
             narration, scene_reference,
             visual_prompt_json, action_prompt_json, emotion_cue_json
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'none','pending',$14,$15,$16,$17,$18)`,
          [
            sceneRow.id,
            scriptId,
            userId,
            Number(sh.shot_number) || j + 1,
            sh.shot_type || '中景',
            sh.camera_angle || '平视',
            sh.camera_movement || '固定',
            // 兼容字段
            sh.description || sh.visual_prompt?.scene_description || '',
            sh.visual_prompt?.scene_description || sh.visual_prompt?.lighting || '',
            sh.original_text || '',
            sh.dialogue || '',
            sh.action_description || actionPromptData.physical_action || '',
            Number(sh.duration) || 3,
            // v5.3 新增字段
            sh.narration || '',
            sh.scene_reference || '',
            // JSONB字段（存储完整结构）
            JSON.stringify(visualPromptData),
            JSON.stringify(actionPromptData),
            JSON.stringify(emotionCueData),
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

async function getSceneById(id) {
  const result = await pool.query('SELECT * FROM scenes WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getCharactersByScriptId(scriptId) {
  const result = await pool.query(
    'SELECT * FROM characters WHERE script_id = $1',
    [scriptId]
  );
  return result.rows || [];
}

module.exports = {
  listScenes,
  regenerateStoryboard,
  updateScene,
  deleteScene,
};
