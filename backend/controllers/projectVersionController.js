const projectVersionService = require('../services/projectVersionService');

async function listByProject(req, res) {
  try {
    const rows = await projectVersionService.listByProjectId(req.params.project_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { project_id, name, description, snapshot } = req.body;
    const userId = 1;
    if (!project_id) {
      return res.status(400).json({ success: false, message: '缺少 project_id' });
    }

    const row = await projectVersionService.createVersion({
      projectId: project_id,
      userId,
      name,
      description,
      snapshot,
    });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const row = await projectVersionService.getById(req.params.version_id);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    await projectVersionService.removeById(req.params.version_id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[ProjectVersions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listByProject,
  create,
  get,
  remove,
};
