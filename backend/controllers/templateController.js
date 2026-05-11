const templateService = require('../services/templateService');

async function list(req, res) {
  try {
    const { category } = req.query;
    const rows = await templateService.listTemplates({ category });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Templates] 获取失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const row = await templateService.getTemplateById(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Templates] 获取详情失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  get,
};
