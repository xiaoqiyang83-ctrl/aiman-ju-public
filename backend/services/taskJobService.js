const { pool } = require('../config/database');

async function listTaskJobs({ projectId, taskType, status }) {
  let q = 'SELECT * FROM task_jobs WHERE 1=1';
  const p = [];
  let c = 1;

  if (projectId) {
    q += ` AND project_id = $${c++}`;
    p.push(projectId);
  }
  if (taskType) {
    q += ` AND task_type = $${c++}`;
    p.push(taskType);
  }
  if (status) {
    q += ` AND status = $${c++}`;
    p.push(status);
  }

  q += ' ORDER BY created_at DESC';
  const result = await pool.query(q, p);
  return result.rows;
}

async function getTaskJobByKey(key) {
  const k = String(key || '');
  const result = await pool.query('SELECT * FROM task_jobs WHERE job_id = $1 OR id::text = $1', [k]);
  return result.rows[0] || null;
}

async function createTaskJob({ jobId, queueName = 'default', taskType = 'general', projectId = null, paramsObj = {} }) {
  const result = await pool.query(
    `INSERT INTO task_jobs (job_id, queue_name, task_type, project_id, status, progress, params)
     VALUES ($1, $2, $3, $4, 'pending', 0, $5::jsonb) RETURNING *`,
    [jobId, queueName, taskType, projectId, JSON.stringify(paramsObj || {})]
  );
  return result.rows[0] || null;
}

async function cancelTaskJob(key) {
  const k = String(key || '');
  await pool.query('UPDATE task_jobs SET status = $1 WHERE job_id = $2 OR id::text = $2', ['cancelled', k]);
}

async function retryTaskJob(key) {
  const k = String(key || '');
  await pool.query(
    'UPDATE task_jobs SET status = $1, progress = 0, error_message = NULL WHERE job_id = $2 OR id::text = $2',
    ['pending', k]
  );
}

module.exports = {
  listTaskJobs,
  getTaskJobByKey,
  createTaskJob,
  cancelTaskJob,
  retryTaskJob,
};
