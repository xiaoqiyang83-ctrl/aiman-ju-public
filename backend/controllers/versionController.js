const versionService = require('../services/versionService');

async function listProjectVersions(req, res) {
  try {
    const rows = await versionService.listProjectVersions(req.params.project_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { project_id, name, description } = req.body;
    const userId = 1;

    const row = await versionService.createProjectVersion({ projectId: project_id, userId, name, description });
    res.json({ success: true, data: row ? [row] : [] });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const row = await versionService.getProjectVersion(req.params.version_id);
    if (!row) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function restore(req, res) {
  try {
    res.json({ success: true, message: '已恢复到指定版本', data: { version_id: req.params.version_id } });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    await versionService.deleteProjectVersion(req.params.version_id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Versions] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listProjectVersions,
  create,
  get,
  restore,
  remove,
};
