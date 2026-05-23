/**
 * imageController.js - 图像生成控制器
 * 统一处理生图相关请求
 */

const imageService = require('../services/image-service');

/**
 * POST /api/images/generate
 * 通用生图接口
 */
async function generate(req, res) {
  try {
    const { prompt, model, size, quality } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必填参数: prompt' 
      });
    }

    const result = await imageService.generateFromPrompt({ 
      prompt, 
      model, 
      size, 
      quality 
    });

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      sourceUrl: result.sourceUrl,
      message: '图片生成成功'
    });
  } catch (error) {
    console.error('[ImageController] 生图失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '图片生成失败' 
    });
  }
}

/**
 * POST /api/images/generate-shot/:shotId
 * 生成分镜图片
 */
async function generateShot(req, res) {
  try {
    const { shotId } = req.params;
    const { visualContinuityPrompt, size } = req.body || {};
    
    if (!shotId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少shotId' 
      });
    }

    const result = await imageService.generateShotImage(
      parseInt(shotId), 
      visualContinuityPrompt,
      size
    );

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      message: '分镜图片生成成功'
    });
  } catch (error) {
    console.error('[ImageController] 分镜生图失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '分镜图片生成失败' 
    });
  }
}

/**
 * POST /api/images/generate-character/:characterId
 * 生成角色三视图（正面+侧面+背面）
 */
async function generateCharacter(req, res) {
  try {
    const { id } = req.params;  // 从characters路由来，参数名是:id，不是:characterId
    const { variation_id, prompt, style } = req.body || {};
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少characterId' 
      });
    }

    const results = await imageService.generateCharacterImage(
      parseInt(id), 
      variation_id ? parseInt(variation_id) : null,
      { prompt, style }
    );

    res.json({
      success: true,
      message: `角色三视图生成完成（${Object.keys(results).length}个视角）`,
      front_image_url: results.front || null,
      side_image_url: results.side || null,
      back_image_url: results.back || null,
      image_url: results.front || null
    });
  } catch (error) {
    console.error('[ImageController] 角色生图失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '角色图片生成失败' 
    });
  }
}

/**
 * GET /api/images/test
 * 测试API连接
 */
async function test(req, res) {
  try {
    const result = await imageService.testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'CogView API连接正常',
        testUrl: result.url
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'CogView API连接失败',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '测试失败',
      error: error.message
    });
  }
}

/**
 * GET /api/images/models
 * 获取支持的模型列表
 */
async function getModels(req, res) {
  res.json({
    success: true,
    models: imageService.COGVIEW_MODELS,
    default: imageService.DEFAULT_MODEL
  });
}

module.exports = {
  generate,
  generateShot,
  generateCharacter,
  test,
  getModels
};
