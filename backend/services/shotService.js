const { pool } = require('../config/database');

async function listShots({ sceneId }) {
  let q = 'SELECT * FROM shots';
  const p = [];
  if (sceneId) {
    q += ' WHERE scene_id = $1';
    p.push(sceneId);
  }
  q += ' ORDER BY shot_number ASC';
  const result = await pool.query(q, p);
  return result.rows;
}

async function getShotById(id) {
  const result = await pool.query('SELECT * FROM shots WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getShotVideoAudio(id) {
  const result = await pool.query('SELECT video_url, audio_url FROM shots WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createShot({
  sceneId,
  shotNumber,
  shotType,
  cameraMovement,
  visualDescription,
  visualPrompt,
  originalText,
  duration,
  characterId,
  sceneImageUrl,
  characterAngle,
}) {
  const sceneRes = await pool.query('SELECT script_id, user_id FROM scenes WHERE id = $1', [sceneId]);
  if (!sceneRes.rows.length) return null;

  const { script_id, user_id } = sceneRes.rows[0];
  const result = await pool.query(
    `INSERT INTO shots (
       scene_id, script_id, user_id, shot_number, shot_type, camera_movement,
       visual_description, visual_prompt, original_text, duration, character_id, scene_image_url, character_angle
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      sceneId,
      script_id,
      user_id,
      shotNumber || 1,
      shotType || '中景',
      cameraMovement || '固定',
      visualDescription || '',
      visualPrompt || visualDescription || '',
      originalText || '',
      duration !== undefined && duration !== null ? duration : 3,
      characterId || null,
      sceneImageUrl || null,
      characterAngle || 'front',
    ]
  );
  return result.rows[0];
}

async function updateShot({
  id,
  shotNumber,
  shotType,
  cameraMovement,
  visualDescription,
  visualPrompt,
  originalText,
  dialogue,
  actionDescription,
  duration,
  characterId,
  sceneImageUrl,
  characterAngle,
  referenceImageUrl,
  trimStart,
  trimEnd,
  imagePrompt,  // v6.3 新增
  videoPrompt,  // v7.1.7 新增
}) {
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (shotNumber !== undefined && shotNumber !== null) {
    updates.push('shot_number = $' + paramIndex++);
    values.push(shotNumber);
  }
  if (shotType !== undefined && shotType !== null) {
    updates.push('shot_type = $' + paramIndex++);
    values.push(shotType);
  }
  if (cameraMovement !== undefined && cameraMovement !== null) {
    updates.push('camera_movement = $' + paramIndex++);
    values.push(cameraMovement);
  }
  if (visualDescription !== undefined && visualDescription !== null) {
    updates.push('visual_description = $' + paramIndex++);
    values.push(visualDescription);
  }
  if (visualPrompt !== undefined && visualPrompt !== null) {
    updates.push('visual_prompt = $' + paramIndex++);
    values.push(visualPrompt);
  }
  if (originalText !== undefined && originalText !== null) {
    updates.push('original_text = $' + paramIndex++);
    values.push(originalText);
  }
  if (dialogue !== undefined && dialogue !== null) {
    updates.push('dialogue = $' + paramIndex++);
    values.push(dialogue);
  }
  if (actionDescription !== undefined && actionDescription !== null) {
    updates.push('action_description = $' + paramIndex++);
    values.push(actionDescription);
  }
  if (duration !== undefined && duration !== null) {
    updates.push('duration = $' + paramIndex++);
    values.push(duration);
  }
  if (characterId !== undefined && characterId !== null) {
    updates.push('character_id = $' + paramIndex++);
    values.push(characterId);
  }
  // v7.0.6 修复：空字符串不覆盖已有的图片URL（防止前端保存时把已生成的图片URL清空）
  if (sceneImageUrl !== undefined && sceneImageUrl !== null && sceneImageUrl !== '') {
    updates.push('scene_image_url = $' + paramIndex++);
    values.push(sceneImageUrl);
  }
  if (characterAngle !== undefined && characterAngle !== null) {
    updates.push('character_angle = $' + paramIndex++);
    values.push(characterAngle);
  }
  // v7.0.6 修复：同上，空字符串不覆盖已有的参考图URL
  if (referenceImageUrl !== undefined && referenceImageUrl !== null && referenceImageUrl !== '') {
    updates.push('reference_image_url = $' + paramIndex++);
    values.push(referenceImageUrl);
  }
  if (trimStart !== undefined && trimStart !== null) {
    updates.push('trim_start = $' + paramIndex++);
    values.push(trimStart);
  }
  if (trimEnd !== undefined && trimEnd !== null) {
    updates.push('trim_end = $' + paramIndex++);
    values.push(trimEnd);
  }
  // v6.3 新增: image_prompt 字段
  if (imagePrompt !== undefined && imagePrompt !== null) {
    updates.push('image_prompt = $' + paramIndex++);
    values.push(imagePrompt);
  }
  // v7.1.7 新增: video_prompt 字段
  if (videoPrompt !== undefined && videoPrompt !== null) {
    updates.push('video_prompt = $' + paramIndex++);
    values.push(videoPrompt);
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(id);
  const result = await pool.query(
    'UPDATE shots SET ' + updates.join(', ') + ' WHERE id = $' + paramIndex + ' RETURNING *',
    values
  );
  return result.rows[0] || null;
}

async function deleteShot(id) {
  await pool.query('DELETE FROM shots WHERE id = $1', [id]);
}

module.exports = {
  listShots,
  getShotById,
  getShotVideoAudio,
  createShot,
  updateShot,
  deleteShot,
};
