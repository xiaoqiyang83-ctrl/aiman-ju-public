// ========================================
// AIManju v5.2+ TTS控制器
// 处理配音相关的API请求
// ========================================

const ttsService = require('../services/tts-service');

/**
 * 获取可用音色列表
 * GET /api/tts/voices
 * Query: ?gender=male|female (可选)
 */
async function getVoices(req, res) {
  try {
    const { gender } = req.query;
    const voices = await ttsService.getVoices(gender);
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
 * 获取音色详情
 * GET /api/tts/voice/:voiceId
 */
async function getVoiceDetail(req, res) {
  try {
    const { voiceId } = req.params;
    const voiceInfo = ttsService.getVoiceInfo(voiceId);
    
    if (!voiceInfo) {
      return res.status(404).json({ 
        success: false, 
        message: '音色不存在' 
      });
    }

    res.json({ 
      success: true, 
      data: voiceInfo,
      message: '获取音色详情成功'
    });
  } catch (err) {
    console.error('[TTS] 获取音色详情失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '获取音色详情失败' 
    });
  }
}

/**
 * 生成单个镜头配音
 * POST /api/tts/generate
 * Body: { shotId, voice, rate, volume, pitch, emotion }
 */
async function generate(req, res) {
  try {
    const { shotId, voice, rate, volume, pitch, emotion } = req.body;

    if (!shotId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少镜头ID' 
      });
    }

    const options = {};
    if (rate !== undefined) options.rate = rate;
    if (volume !== undefined) options.volume = volume;
    if (pitch !== undefined) options.pitch = pitch;
    if (emotion !== undefined) options.emotion = emotion;

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
 * Body: { scriptId, voice, rate, volume, pitch, emotion }
 */
async function generateBatch(req, res) {
  try {
    const { scriptId, voice, rate, volume, pitch, emotion } = req.body;

    if (!scriptId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少剧本ID' 
      });
    }

    const options = {};
    if (rate !== undefined) options.rate = rate;
    if (volume !== undefined) options.volume = volume;
    if (pitch !== undefined) options.pitch = pitch;
    if (emotion !== undefined) options.emotion = emotion;

    // 异步执行批量生成，避免超时
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

    if (!characterId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少角色ID' 
      });
    }

    if (!voiceId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少音色ID' 
      });
    }

    const result = await ttsService.updateCharacterDefaultVoice(characterId, voiceId, voiceName);

    res.json({ 
      success: true, 
      data: result,
      message: '音色绑定成功' 
    });
  } catch (err) {
    console.error('[TTS] 更新角色音色失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '更新角色音色失败' 
    });
  }
}

/**
 * 预览配音（不保存）
 * POST /api/tts/preview
 * Body: { text, voice, rate, volume, pitch, emotion }
 */
async function preview(req, res) {
  try {
    const { text, voice, rate, volume, pitch, emotion } = req.body;

    if (!text) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少台词文本' 
      });
    }

    const options = {};
    if (rate !== undefined) options.rate = rate;
    if (volume !== undefined) options.volume = volume;
    if (pitch !== undefined) options.pitch = pitch;
    if (emotion !== undefined) options.emotion = emotion;

    const result = await ttsService.previewAudio(text, voice, options);

    res.json({ 
      success: true, 
      data: result,
      message: '预览配音生成成功' 
    });
  } catch (err) {
    console.error('[TTS] 预览配音失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '预览配音失败' 
    });
  }
}

/**
 * 文本转音频（直接传入文本生成音频）
 * POST /api/tts/text-to-audio
 * Body: { text, voice, rate, volume, pitch, emotion }
 */
async function textToAudio(req, res) {
  try {
    const { text, voice, rate, volume, pitch, emotion } = req.body;

    if (!text) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少台词文本' 
      });
    }

    const options = {};
    if (voice !== undefined) options.voice = voice;
    if (rate !== undefined) options.rate = rate;
    if (volume !== undefined) options.volume = volume;
    if (pitch !== undefined) options.pitch = pitch;
    if (emotion !== undefined) options.emotion = emotion;

    const result = await ttsService.textToAudio(text, options);

    res.json({ 
      success: true, 
      data: result,
      message: '音频生成成功' 
    });
  } catch (err) {
    console.error('[TTS] 文本转音频失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '文本转音频失败' 
    });
  }
}

/**
 * 获取支持的情感风格列表
 * GET /api/tts/emotions
 */
async function getEmotions(req, res) {
  try {
    const emotions = Object.entries(ttsService.EMOTION_PARAMS).map(([key, value]) => ({
      id: key,
      name: getEmotionName(key),
      params: value
    }));

    res.json({ 
      success: true, 
      data: emotions,
      message: '获取情感风格列表成功' 
    });
  } catch (err) {
    console.error('[TTS] 获取情感风格列表失败:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || '获取情感风格列表失败' 
    });
  }
}

/**
 * 获取情感名称映射
 */
function getEmotionName(emotion) {
  const emotionNames = {
    warm: '温柔',
    cheerful: '欢快',
    playful: '俏皮',
    lively: '活泼',
    calm: '平静',
    steady: '稳重',
    gentle: '柔和',
    confident: '自信',
    relaxed: '轻松',
    innocent: '天真',
    seductive: '磁性',
    formal: '正式',
    energetic: '有力',
    youthful: '青春',
    deep: '低沉'
  };
  return emotionNames[emotion] || emotion;
}

module.exports = {
  getVoices,
  getVoiceDetail,
  generate,
  generateBatch,
  remove,
  getStatus,
  updateCharacterVoice,
  preview,
  textToAudio,
  getEmotions
};
