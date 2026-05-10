const express = require('express');
const router = express.Router();
const { pool } = require('../shared');

const userId = 1;

router.get('/project/:project_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM project_versions WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.project_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, name, description, snapshot } = req.body;
    if (!project_id) {
      return res.status(400).json({ success: false, message: '缺少 project_id' });
    }
    const snap = snapshot !== undefined ? snapshot : {};
    const versionName = name || `v${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO project_versions (project_id, user_id, version_name, description, snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
      [project_id, userId, versionName, description || '', snap]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:version_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM project_versions WHERE id = $1', [
      req.params.version_id,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:version_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM project_versions WHERE id = $1', [req.params.version_id]);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
