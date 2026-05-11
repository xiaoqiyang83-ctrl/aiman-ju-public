const { pool } = require('../config/database');

async function listProjectVersions(projectId) {
  const result = await pool.query('SELECT * FROM project_versions WHERE project_id = $1 ORDER BY id DESC', [projectId]);
  return result.rows;
}

async function createProjectVersion({ projectId, userId, name, description }) {
  const result = await pool.query(
    `INSERT INTO project_versions (project_id, user_id, version_name, description, snapshot)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
    [projectId, userId, name || `v${Date.now()}`, description || '', {}]
  );
  return result.rows[0] || null;
}

async function getProjectVersion(versionId) {
  const result = await pool.query('SELECT * FROM project_versions WHERE id = $1', [versionId]);
  return result.rows[0] || null;
}

async function deleteProjectVersion(versionId) {
  await pool.query('DELETE FROM project_versions WHERE id = $1', [versionId]);
}

module.exports = {
  listProjectVersions,
  createProjectVersion,
  getProjectVersion,
  deleteProjectVersion,
};
