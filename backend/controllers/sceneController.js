const sceneService = require('../services/sceneService');

async function list(req, res) {
  try {
    const { script_id, project_id } = req.query;
    const userId = 1;

    const rows = await sceneService.listScenes({ userId, scriptId: script_id, projectId: project_id });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function generate(req, res) {
  try {
    const scriptId = req.body.script_id || req.query.script_id;
    const userId = 1;

    if (!scriptId) {
      return res.status(400).json({ success: false, message: '请选择剧本' });
    }

    const result = await sceneService.regenerateStoryboard({ userId, scriptId });
    res.json({
      success: true,
      data: result.scenes,
      storyboard: {
        provider: result.provider,
        model: result.model,
        scene_count: result.sceneCount,
        shot_count: result.shotCount,
      },
    });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { title, location, time_of_day, content, characters } = req.body;
    const userId = 1;

    const row = await sceneService.updateScene({
      userId,
      id,
      title,
      location,
      timeOfDay: time_of_day,
      content,
      characters,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const userId = 1;

    await sceneService.deleteScene({ userId, id });
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Scenes] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  generate,
  update,
  remove,
};
