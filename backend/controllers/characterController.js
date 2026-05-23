const characterService = require('../services/characterService');
const aiService = require('../services/ai-service');

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
      // v5.0 新增字段
      identity_anchors,
      negative_prompt,
      consistency_elements,
      gender,
      age,
      personality,
      role_desc,
      appearance,
      visual_prompt_en,
      visual_prompt_zh,
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
      identityAnchors: identity_anchors,
      negativePrompt: negative_prompt,
      consistencyElements: consistency_elements,
      gender,
      age,
      personality,
      roleDesc: role_desc,
      appearance,
      visualPromptEn: visual_prompt_en,
      visualPromptZh: visual_prompt_zh,
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Characters] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const {
      name,
      description,
      image_url,
      front_image_url,
      side_image_url,
      back_image_url,
      expressions,
      costumes,
      // v5.0 新增字段
      identity_anchors,
      negative_prompt,
      consistency_elements,
      gender,
      age,
      personality,
      role_desc,
      appearance,
      visual_prompt_en,
      visual_prompt_zh,
    } = req.body;

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
      identityAnchors: identity_anchors,
      negativePrompt: negative_prompt,
      consistencyElements: consistency_elements,
      gender,
      age,
      personality,
      roleDesc: role_desc,
      appearance,
      visualPromptEn: visual_prompt_en,
      visualPromptZh: visual_prompt_zh,
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

// ==================== v5.0 AI角色校准接口 ====================

/**
 * 触发AI校准 - 生成6层身份锚点
 * POST /api/characters/:id/calibrate
 */
async function calibrate(req, res) {
  try {
    const character = await characterService.getCharacter({ userId, id: req.params.id });
    
    if (!character) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }

    // 检查AI服务是否配置
    if (!aiService.isConfigured()) {
      return res.status(503).json({ 
        success: false, 
        message: 'AI服务未配置，请先配置API密钥' 
      });
    }

    console.log('[Character Calibrate] 开始校准角色:', character.name);

    // 调用AI校准函数
    const result = await aiService.calibrateCharacterAnchors(
      {
        name: character.name,
        description: character.description,
        appearance: character.appearance,
        gender: character.gender,
        age: character.age,
        personality: character.personality,
        role_desc: character.role_desc
      },
      aiService.generateText
    );

    console.log('[Character Calibrate] 校准完成:', result);

    // 更新角色记录
    const updated = await characterService.updateCharacter({
      userId,
      id: req.params.id,
      identityAnchors: result.identity_anchors,
      negativePrompt: result.negative_prompt,
      consistencyElements: result.consistency_elements
    });

    res.json({
      success: true,
      message: 'AI校准完成',
      data: {
        character_id: req.params.id,
        identity_anchors: result.identity_anchors,
        negative_prompt: result.negative_prompt,
        consistency_elements: result.consistency_elements
      }
    });
  } catch (err) {
    console.error('[Character Calibrate] 校准失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 编译视觉提示词
 * POST /api/characters/:id/compile-prompt
 */
async function compilePrompt(req, res) {
  try {
    const character = await characterService.getCharacter({ userId, id: req.params.id });
    
    if (!character) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }

    const { variation_id } = req.body;
    let variation = null;

    // 如果指定了变体，获取变体信息
    if (variation_id) {
      variation = await characterService.getVariation({ userId, id: variation_id });
      if (!variation) {
        return res.status(404).json({ success: false, message: '变体不存在' });
      }
    }

    console.log('[Character Compile] 编译提示词:', character.name, variation ? `变体:${variation.name}` : '');

    // 调用编译函数
    const result = aiService.compileCharacterPrompt(character, variation);

    // 可选：保存编译结果到角色
    if (req.body.save) {
      await characterService.updateCharacter({
        userId,
        id: req.params.id,
        visualPromptEn: result.visual_prompt_en,
        visualPromptZh: result.visual_prompt_zh
      });
    }

    res.json({
      success: true,
      message: '提示词编译完成',
      data: {
        character_id: req.params.id,
        variation_id: variation_id || null,
        visual_prompt_en: result.visual_prompt_en,
        visual_prompt_zh: result.visual_prompt_zh,
        negative_prompt_en: result.negative_prompt_en
      }
    });
  } catch (err) {
    console.error('[Character Compile] 编译失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==================== v5.0 角色变体 CRUD ====================

async function listVariations(req, res) {
  try {
    const { character_id } = req.params;
    const rows = await characterService.listVariations({ userId, characterId: character_id });
    if (rows === null) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Character Variations] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getVariation(req, res) {
  try {
    const { character_id, id } = req.params;
    const row = await characterService.getVariation({ userId, id, characterId: character_id });
    if (!row) {
      return res.status(404).json({ success: false, message: '变体不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Character Variations] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createVariation(req, res) {
  try {
    const { character_id } = req.params;
    const {
      name,
      description,
      visual_prompt,
      visual_prompt_zh,
      reference_image,
      is_stage_variation,
      episode_range,
      age_description,
      stage_description,
    } = req.body;

    const row = await characterService.createVariation({
      userId,
      characterId: character_id,
      name,
      description,
      visualPrompt: visual_prompt,
      visualPromptZh: visual_prompt_zh,
      referenceImage: reference_image,
      isStageVariation: is_stage_variation,
      episodeRange: episode_range,
      ageDescription: age_description,
      stageDescription: stage_description,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Character Variations] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateVariation(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      visual_prompt,
      visual_prompt_zh,
      reference_image,
      is_stage_variation,
      episode_range,
      age_description,
      stage_description,
    } = req.body;

    const row = await characterService.updateVariation({
      userId,
      id,
      name,
      description,
      visualPrompt: visual_prompt,
      visualPromptZh: visual_prompt_zh,
      referenceImage: reference_image,
      isStageVariation: is_stage_variation,
      episodeRange: episode_range,
      ageDescription: age_description,
      stageDescription: stage_description,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: '变体不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Character Variations] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteVariation(req, res) {
  try {
    const { id } = req.params;
    const row = await characterService.deleteVariation({ userId, id });
    if (!row) {
      return res.status(404).json({ success: false, message: '变体不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Character Variations] 操作失败:', err);
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
  // v5.0 AI校准
  calibrate,
  compilePrompt,
  // v5.0 变体
  listVariations,
  getVariation,
  createVariation,
  updateVariation,
  deleteVariation,
};
