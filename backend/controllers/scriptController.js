const fs = require('fs');

const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');
const scriptService = require('../services/scriptService');

async function list(req, res) {
  try {
    const { project_id } = req.query;
    const userId = 1;

    let projectId = parseInt(project_id, 10);
    if (!projectId || Number.isNaN(projectId)) {
      projectId = await scriptService.getFirstProject(userId);
    }

    const rows = await scriptService.listScripts({ projectId, userId });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function upload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择文件' });
    }

    const rawProjectId = req.body.project_id ?? req.body.projectId;
    const userId = 1;

    let projectId = parseInt(rawProjectId, 10);
    if (!projectId || Number.isNaN(projectId)) {
      projectId = await scriptService.getFirstProject(userId);
    }

    if (!projectId) {
      return res.status(400).json({ success: false, message: '请先选择一个项目' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const row = await scriptService.createScriptFromUpload({
      projectId,
      userId,
      originalName,
      filePath: req.file.path,
    });

    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      console.error('[Scripts] 临时文件删除失败:', e);
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('[Scripts] 操作失败后清理临时文件失败:', e);
      }
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const userId = 1;

    await scriptService.deleteScript({ id, userId });
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = 1;

    const row = await scriptService.updateScript({ id, userId, title, content });
    if (!row) {
      return res.status(404).json({ success: false, message: '剧本不存在' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Scripts] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function aiGenerate(req, res) {
  try {
    const { project_id, prompt } = req.body;
    const userId = 1;

    await deductCredits(userId, 'script_generation', `AI剧本生成: ${String(prompt || '').substring(0, 10)}...`);

    const mockContent = `[AI生成的剧本]\n提示词: ${prompt}\n\n场景1: 这是一个模拟生成的剧本内容。\n场景2: 系统会自动根据您的提示词进行创作。\n场景3: 您可以继续修改或直接用于生成分镜。`;
    const row = await scriptService.createScript({
      projectId: project_id,
      userId,
      title: 'AI生成剧本_' + Date.now(),
      content: mockContent,
      status: 'completed',
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Scripts] AI生成失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  upload,
  remove,
  update,
  aiGenerate: [checkCredits('script_generation'), aiGenerate],
};

