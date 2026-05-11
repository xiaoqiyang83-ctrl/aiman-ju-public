const { pool } = require('../config/database');

async function getShotProjectScript(shotId) {
  const res = await pool.query(
    `SELECT sh.id, sh.script_id, sc.project_id
     FROM shots sh
     JOIN scripts sc ON sc.id = sh.script_id
     WHERE sh.id = $1`,
    [shotId]
  );
  return res.rows[0] || null;
}

async function getShotDetailWithProject(shotId) {
  const res = await pool.query(
    `SELECT sh.*, sc.project_id
     FROM shots sh
     JOIN scripts sc ON sc.id = sh.script_id
     WHERE sh.id = $1`,
    [shotId]
  );
  return res.rows[0] || null;
}

async function getCharacterReference(characterId) {
  const res = await pool.query('SELECT reference_image, image_url FROM characters WHERE id = $1', [characterId]);
  return res.rows[0] || null;
}

async function listVideos({ projectId }) {
  let q = 'SELECT * FROM videos';
  const p = [];
  if (projectId) {
    q += ' WHERE project_id = $1';
    p.push(projectId);
  }
  q += ' ORDER BY created_at DESC';
  const res = await pool.query(q, p);
  return res.rows;
}

async function getVideoById(videoId) {
  const res = await pool.query('SELECT * FROM videos WHERE id = $1', [videoId]);
  return res.rows[0] || null;
}

async function createVideo({ projectId, quality }) {
  const res = await pool.query(
    `INSERT INTO videos (project_id, status, quality, progress)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [projectId, 'processing', quality || '720p', 0]
  );
  return res.rows[0];
}

async function getVideoStatus(videoId) {
  const res = await pool.query('SELECT status, progress FROM videos WHERE id = $1', [videoId]);
  return res.rows[0] || null;
}

async function deleteVideo(videoId) {
  await pool.query('DELETE FROM videos WHERE id = $1', [videoId]);
}

module.exports = {
  getShotProjectScript,
  getShotDetailWithProject,
  getCharacterReference,
  listVideos,
  getVideoById,
  createVideo,
  getVideoStatus,
  deleteVideo,
};

