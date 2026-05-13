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
}) {
  const result = await pool.query(
    `UPDATE shots SET
      shot_number = COALESCE($1, shot_number),
      shot_type = COALESCE($2, shot_type),
      camera_movement = COALESCE($3, camera_movement),
      visual_description = COALESCE($4, visual_description),
      visual_prompt = COALESCE($5, visual_prompt),
      original_text = COALESCE($6, original_text),
      dialogue = COALESCE($7, dialogue),
      action_description = COALESCE($8, action_description),
      duration = COALESCE($9, duration),
      character_id = COALESCE($10, character_id),
      scene_image_url = COALESCE($11, scene_image_url),
      character_angle = COALESCE($12, character_angle),
      reference_image_url = COALESCE($14, reference_image_url)
    WHERE id = $13
    RETURNING *`,
    [
      shotNumber ?? null,
      shotType ?? null,
      cameraMovement ?? null,
      visualDescription ?? null,
      visualPrompt ?? null,
      originalText ?? null,
      dialogue ?? null,
      actionDescription ?? null,
      duration ?? null,
      characterId ?? null,
      sceneImageUrl ?? null,
      characterAngle ?? null,
      id,
      referenceImageUrl ?? null,
    ]
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
