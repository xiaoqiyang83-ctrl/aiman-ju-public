// ========================================
// AIManju v5.2 TTS控制器
// 处理配音相关的API请求
// ========================================

const ttsService = require('../services/tts-service');

/**
 * 获取可用音色列表
 * GET /api/tts/voices
 */
async function getVoices(req, res) {
  try {
    const voices = await ttsService.getVoices();
    res.json({ 
      success: true, 
      data: voices,
      message: '获取音色列表成功'
    });
  } catch (err) {
    console.error('[TTS] 获取音色列表失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '获取音色列表失败' 
    });
  }
}

/**
 * 生成单个镜头配音
 * POST /api/tts/generate
 * Body: { shotId, voice, rate, volume }
 */
async function generate(req, res) {
  try {
    const { shotId, voice, rate, volume } = req.body;

    if (!shotId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少镜头ID' 
      });
    }

    const options = {};
    if (rate) options.rate = rate;
    if (volume) options.volume = volume;

    const result = await ttsService.generateShotAudio(shotId, voice, options);

    res.json({ 
      success: true, 
      data: result,
      message: '配音生成成功' 
    });
  } catch (err) {
    console.error('[TTS] 生成配音失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '配音生成失败' 
    });
  }
}

/**
 * 批量生成配音
 * POST /api/tts/generate-batch
 * Body: { scriptId, voice, rate, volume }
 */
async function generateBatch(req, res) {
  try {
    const { scriptId, voice, rate, volume } = req.body;

    if (!scriptId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少剧本ID' 
      });
    }

    const options = {};
    if (rate) options.rate = rate;
    if (volume) options.volume = volume;

    const result = await ttsService.batchGenerateAudio(scriptId, voice, options);

    res.json({ 
      success: true, 
      data: result,
      message: `批量生成完成：成功${result.success}个，失败${result.failed}个` 
    });
  } catch (err) {
    console.error('[TTS] 批量生成配音失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '批量生成配音失败' 
    });
  }
}

/**
 * 删除镜头配音
 * DELETE /api/tts/:shotId
 */
async function remove(req, res) {
  try {
    const { shotId } = req.params;

    if (!shotId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少镜头ID' 
      });
    }

    const result = await ttsService.deleteShotAudio(shotId);

    res.json({ 
      success: true, 
      data: result,
      message: '配音删除成功' 
    });
  } catch (err) {
    console.error('[TTS] 删除配音失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '删除配音失败' 
    });
  }
}

/**
 * 获取剧本下所有镜头的配音状态
 * GET /api/tts/status/:scriptId
 */
async function getStatus(req, res) {
  try {
    const { scriptId } = req.params;

    if (!scriptId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少剧本ID' 
      });
    }

    const status = await ttsService.getShotAudioStatus(scriptId);

    res.json({ 
      success: true, 
      data: status,
      message: '获取配音状态成功' 
    });
  } catch (err) {
    console.error('[TTS] 获取配音状态失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '获取配音状态失败' 
    });
  }
}

/**
 * 更新角色默认音色
 * PUT /api/tts/character-voice
 * Body: { characterId, voiceId, voiceName }
 */
async function updateCharacterVoice(req, res) {
  try {
    const { characterId, voiceId, voiceName } = req.body;

    if (!characterId || !voiceId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数' 
      });
    }

    const result = await ttsService.updateCharacterDefaultVoice(characterId, voiceId, voiceName);

    res.json({ 
      success: true, 
      data: result,
      message: '角色音色绑定成功' 
    });
  } catch (err) {
    console.error('[TTS] 更新角色音色失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '更新角色音色失败' 
    });
  }
}

module.exports = {
  getVoices,
  generate,
  generateBatch,
  remove,
  getStatus,
  updateCharacterVoice
};
