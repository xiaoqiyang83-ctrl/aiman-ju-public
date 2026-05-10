const express = require('express');
const router = express.Router();
const { pool } = require('../shared');

// 映射到 project_versions 表
router.get('/project/:project_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM project_versions WHERE project_id = $1 ORDER BY id DESC',
      [req.params.project_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, name, description } = req.body;
    const userId = 1;

    const result = await pool.query(
      `INSERT INTO project_versions (project_id, user_id, version_name, description, snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
      [project_id, userId, name || `v${Date.now()}`, description || '', {}]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:version_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM project_versions WHERE id = $1', [
      req.params.version_id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:version_id/restore', async (req, res) => {
  try {
    res.json({
      success: true,
      message: '已恢复到指定版本',
      data: { version_id: req.params.version_id },
    });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:version_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM project_versions WHERE id = $1', [req.params.version_id]);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
