const crypto = require('crypto');

const taskJobService = require('../services/taskJobService');

async function list(req, res) {
  try {
    const { project_id, type } = req.query;
    const rows = await taskJobService.listTaskJobs({ projectId: project_id, taskType: type });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const key = String(req.params.task_id);
    const row = await taskJobService.getTaskJobByKey(key);
    if (!row) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { project_id, type, description } = req.body;
    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const paramsObj = description !== undefined && description !== null && description !== '' ? { description } : {};

    const row = await taskJobService.createTaskJob({
      jobId,
      queueName: 'default',
      taskType: type || 'general',
      projectId: project_id || null,
      paramsObj,
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function cancel(req, res) {
  try {
    const key = String(req.params.task_id);
    await taskJobService.cancelTaskJob(key);
    res.json({ success: true, message: '任务已取消' });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function retry(req, res) {
  try {
    const key = String(req.params.task_id);
    await taskJobService.retryTaskJob(key);
    res.json({ success: true, message: '任务已重新提交' });
  } catch (err) {
    console.error('[Tasks] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  get,
  create,
  cancel,
  retry,
};
