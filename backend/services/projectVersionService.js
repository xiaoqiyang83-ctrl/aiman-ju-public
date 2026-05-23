const { pool } = require('../config/database');

async function listByProjectId(projectId) {
  const result = await pool.query('SELECT * FROM project_versions WHERE project_id = $1 ORDER BY created_at DESC', [
    projectId,
  ]);
  return result.rows;
}

async function createVersion({ projectId, userId, name, description, snapshot }) {
  const snap = snapshot !== undefined ? snapshot : {};
  const versionName = name || `v${Date.now()}`;
  const result = await pool.query(
    `INSERT INTO project_versions (project_id, user_id, version_name, description, snapshot)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
    [projectId, userId, versionName, description || '', snap]
  );
  return result.rows[0] || null;
}

async function getById(versionId) {
  const result = await pool.query('SELECT * FROM project_versions WHERE id = $1', [versionId]);
  return result.rows[0] || null;
}

async function removeById(versionId) {
  await pool.query('DELETE FROM project_versions WHERE id = $1', [versionId]);
}

module.exports = {
  listByProjectId,
  createVersion,
  getById,
  removeById,
};
