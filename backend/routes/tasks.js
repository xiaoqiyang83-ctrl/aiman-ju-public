const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { pool } = require('../shared');

const userId = 1;

// 与 v3.8 一致：任务数据存于 task_jobs 表（旧 tasks 表不存在）
router.get('/', async (req, res) => {
  try {
    const { project_id, type } = req.query;
    let q = 'SELECT * FROM task_jobs WHERE 1=1';
    const p = [];
    let c = 1;
    if (project_id) {
      q += ` AND project_id = $${c++}`;
      p.push(project_id);
    }
    if (type) {
      q += ` AND task_type = $${c++}`;
      p.push(type);
    }
    q += ' ORDER BY created_at DESC';

    const result = await pool.query(q, p);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:task_id', async (req, res) => {
  try {
    const key = String(req.params.task_id);
    const result = await pool.query(
      `SELECT * FROM task_jobs WHERE job_id = $1 OR id::text = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, type, description } = req.body;

    const job_id = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const paramsObj =
      description !== undefined && description !== null && description !== ''
        ? { description }
        : {};

    const result = await pool.query(
      `INSERT INTO task_jobs (job_id, queue_name, task_type, project_id, status, progress, params)
       VALUES ($1, 'default', $2, $3, 'pending', 0, $4::jsonb) RETURNING *`,
      [
        job_id,
        type || 'general',
        project_id || null,
        JSON.stringify(paramsObj),
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:task_id/cancel', async (req, res) => {
  try {
    const key = String(req.params.task_id);
    await pool.query(
      `UPDATE task_jobs SET status = $1 WHERE job_id = $2 OR id::text = $2`,
      ['cancelled', key]
    );

    res.json({ success: true, message: '任务已取消' });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:task_id/retry', async (req, res) => {
  try {
    const key = String(req.params.task_id);
    await pool.query(
      `UPDATE task_jobs SET status = $1, progress = 0, error_message = NULL WHERE job_id = $2 OR id::text = $2`,
      ['pending', key]
    );

    res.json({ success: true, message: '任务已重新提交' });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
