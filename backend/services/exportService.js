const { pool } = require('../config/database');

async function listExportsByProject(projectId) {
  const result = await pool.query('SELECT * FROM exports WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
  return result.rows;
}

async function getExportStatus(exportId) {
  const result = await pool.query(
    'SELECT id, project_id, format, status, progress, error_message, file_url, file_path, config, created_at, updated_at FROM exports WHERE id = $1',
    [exportId]
  );
  return result.rows[0] || null;
}

async function getExportDownloadInfo(exportId) {
  const result = await pool.query('SELECT id, status, file_path, file_url, format FROM exports WHERE id = $1', [exportId]);
  return result.rows[0] || null;
}

async function deleteExport(exportId) {
  await pool.query('DELETE FROM exports WHERE id = $1', [exportId]);
}

module.exports = {
  listExportsByProject,
  getExportStatus,
  getExportDownloadInfo,
  deleteExport,
};
