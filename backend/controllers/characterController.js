const characterService = require('../services/characterService');

const userId = 1;

async function list(req, res) {
  try {
    const { script_id, project_id } = req.query;
    const rows = await characterService.listCharacters({ userId, scriptId: script_id, projectId: project_id });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const row = await characterService.getCharacter({ userId, id: req.params.id });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const {
      script_id,
      name,
      description,
      image_url,
      front_image_url,
      side_image_url,
      back_image_url,
      expressions,
      costumes,
    } = req.body;

    if (!script_id) {
      return res.status(400).json({ success: false, message: '缺少 script_id' });
    }

    const row = await characterService.createCharacter({
      userId,
      scriptId: script_id,
      name,
      description,
      imageUrl: image_url,
      frontImageUrl: front_image_url,
      sideImageUrl: side_image_url,
      backImageUrl: back_image_url,
      expressions,
      costumes,
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const { name, description, image_url, front_image_url, side_image_url, back_image_url, expressions, costumes } =
      req.body;
    const row = await characterService.updateCharacter({
      userId,
      id: req.params.id,
      name,
      description,
      imageUrl: image_url,
      frontImageUrl: front_image_url,
      sideImageUrl: side_image_url,
      backImageUrl: back_image_url,
      expressions,
      costumes,
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const row = await characterService.deleteCharacter({ userId, id: req.params.id });
    if (!row) {
      return res.status(404).json({ success: false, message: '角色不存在或无权删除' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择图片文件' });
    }

    const { image_type, name } = req.body;
    const imageUrl = `/uploads/characters/${req.file.filename}`;

    let result = null;
    if (image_type === 'expression' || image_type === 'costume') {
      const field = image_type === 'expression' ? 'expressions' : 'costumes';
      result = await characterService.addJsonImage({ userId, id: req.params.id, field, name, url: imageUrl });
    } else {
      let column = '';
      switch (image_type) {
        case 'reference':
          column = 'reference_image';
          break;
        case 'front':
          column = 'front_image_url';
          break;
        case 'side':
          column = 'side_image_url';
          break;
        case 'back':
          column = 'back_image_url';
          break;
        default:
          column = 'image_url';
      }
      result = await characterService.setImageField({ userId, id: req.params.id, column, url: imageUrl });
    }

    if (!result) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }

    res.json({ success: true, data: result, image_url: imageUrl });
  } catch (err) {
    console.error('[Characters] 图片上传失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function aiGenerate(req, res) {
  try {
    res.json({ success: true, message: '生成中', data: { character_id: req.params.id, image_url: '' } });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  uploadImage,
  aiGenerate,
};

