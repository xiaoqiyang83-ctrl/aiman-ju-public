const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { pool } = require('../shared');

const userId = 1;

router.get('/', async (req, res) => {
  try {
    const { project_id, status } = req.query;
    let q = 'SELECT * FROM task_jobs WHERE 1=1';
    const p = [];
    let c = 1;
    if (project_id) {
      q += ` AND project_id = $${c++}`;
      p.push(project_id);
    }
    if (status) {
      q += ` AND status = $${c++}`;
      p.push(status);
    }
    q += ' ORDER BY created_at DESC';

    const result = await pool.query(q, p);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:job_id', async (req, res) => {
  try {
    const key = String(req.params.job_id);
    const result = await pool.query(
      `SELECT * FROM task_jobs WHERE job_id = $1 OR id::text = $1`,
      [key]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, type, description, task_type, queue_name } = req.body;
    const job_id = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tt = task_type || type || 'general';
    const paramsObj =
      description !== undefined && description !== null && description !== ''
        ? { description }
        : {};

    const result = await pool.query(
      `INSERT INTO task_jobs (job_id, queue_name, task_type, project_id, status, progress, params)
       VALUES ($1, $2, $3, $4, 'pending', 0, $5::jsonb) RETURNING *`,
      [
        job_id,
        queue_name || 'default',
        tt,
        project_id || null,
        JSON.stringify(paramsObj),
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:job_id/cancel', async (req, res) => {
  try {
    const key = String(req.params.job_id);
    await pool.query(
      `UPDATE task_jobs SET status = $1 WHERE job_id = $2 OR id::text = $2`,
      ['cancelled', key]
    );
    res.json({ success: true, message: '已取消' });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
