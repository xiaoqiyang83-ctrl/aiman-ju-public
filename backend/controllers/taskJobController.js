const crypto = require('crypto');

const taskJobService = require('../services/taskJobService');

async function list(req, res) {
  try {
    const { project_id, status } = req.query;
    const rows = await taskJobService.listTaskJobs({ projectId: project_id, status });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const key = String(req.params.job_id);
    const row = await taskJobService.getTaskJobByKey(key);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { project_id, type, description, task_type, queue_name } = req.body;
    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tt = task_type || type || 'general';
    const paramsObj = description !== undefined && description !== null && description !== '' ? { description } : {};

    const row = await taskJobService.createTaskJob({
      jobId,
      queueName: queue_name || 'default',
      taskType: tt,
      projectId: project_id || null,
      paramsObj,
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function cancel(req, res) {
  try {
    const key = String(req.params.job_id);
    await taskJobService.cancelTaskJob(key);
    res.json({ success: true, message: '已取消' });
  } catch (err) {
    console.error('[TaskJobs] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  get,
  create,
  cancel,
};
