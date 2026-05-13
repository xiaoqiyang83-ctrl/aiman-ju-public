// ========================================
// AIManju v5.2+ 增强TTS配音服务
// 支持多Provider：Edge TTS（免费）、智谱TTS（付费）、阿里云CosyVoice
// 功能：角色音色映射、情感参数控制、SSML标记、批量排队处理
// ========================================

const { pool } = require('../shared');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// TTS Provider类型
const TTS_PROVIDER = {
  EDGE: 'edge',           // Microsoft Edge TTS（免费，推荐）
  ZHIPU: 'zhipu',         // 智谱TTS（付费，效果好）
  COSYVOICE: 'cosyvoice'  // 阿里云CosyVoice（付费）
};

// 当前使用的Provider
const CURRENT_PROVIDER = process.env.TTS_PROVIDER || TTS_PROVIDER.EDGE;

// 预定义的语义化音色列表（中文）
const VOICES = [
  // 女声 - 温柔甜美
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', code: 'xiaoxiao', gender: 'female', style: '温柔', emotion: 'warm', description: '温柔亲和的年轻女声，适合日常对话', age: 'young' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', code: 'xiaohan', gender: 'female', style: '甜美', emotion: 'cheerful', description: '甜美温柔的年轻女声，适合情感场景', age: 'young' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦', code: 'xiaomeng', gender: 'female', style: '可爱', emotion: 'playful', description: '可爱俏皮的年轻女声，适合轻松场景', age: 'young' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', code: 'xiaoyi', gender: 'female', style: '活泼', emotion: 'lively', description: '活泼可爱的年轻女声，适合青春题材', age: 'young' },
  { id: 'zh-CN-XiaoruiNeural', name: '晓睿', code: 'xiaorui', gender: 'female', style: '知性', emotion: 'calm', description: '知性优雅的女性声音，适合正式场合', age: 'adult' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', code: 'xiaomo', gender: 'female', style: '成熟', emotion: 'steady', description: '成熟知性的女性声音，适合御姐角色', age: 'adult' },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', code: 'xiaoxuan', gender: 'female', style: '温暖', emotion: 'gentle', description: '温暖柔和的女性声音，适合治愈系场景', age: 'adult' },
  { id: 'zh-CN-XiaozhenNeural', name: '晓甄', code: 'xiaozhen', gender: 'female', style: '大气', emotion: 'confident', description: '大气端庄的女性声音，适合女强人角色', age: 'adult' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰', code: 'xiaochen', gender: 'female', style: '轻松', emotion: 'relaxed', description: '轻松自然的年轻女声，适合日常漫剧', age: 'young' },
  { id: 'zh-CN-XiaoshuangNeural', name: '晓双', code: 'xiaoshuang', gender: 'female', style: '儿童', emotion: 'innocent', description: '稚嫩可爱的儿童女声，适合萌娃角色', age: 'child' },
  
  // 男声 - 磁性沉稳
  { id: 'zh-CN-YunxiNeural', name: '云希', code: 'yunxi', gender: 'male', style: '阳光', emotion: 'cheerful', description: '阳光帅气的年轻男声，适合青春男主', age: 'young' },
  { id: 'zh-CN-YunjianNeural', name: '云健', code: 'yunjian', gender: 'male', style: '磁性', emotion: 'seductive', description: '磁性低沉的成熟男声，适合霸总角色', age: 'adult' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', code: 'yunyang', gender: 'male', style: '播音', emotion: 'formal', description: '新闻播报风格男声，适合旁白解说', age: 'adult' },
  { id: 'zh-CN-YunfengNeural', name: '云枫', code: 'yunfeng', gender: 'male', style: '沉稳', emotion: 'steady', description: '沉稳有力的成熟男声，适合型男角色', age: 'adult' },
  { id: 'zh-CN-YunhaoNeural', name: '云皓', code: 'yunhao', gender: 'male', style: '广告', emotion: 'energetic', description: '专业广告配音男声，适合宣传场景', age: 'adult' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', code: 'yunxia', gender: 'male', style: '少年', emotion: 'youthful', description: '清澈阳光的少年男声，适合小鲜肉角色', age: 'teen' },
  { id: 'zh-CN-YunzeNeural', name: '云泽', code: 'yunze', gender: 'male', style: '低沉', emotion: 'deep', description: '低沉浑厚的成熟男声，适合大叔角色', age: 'adult' }
];

// 情感风格映射到Edge TTS参数
const EMOTION_PARAMS = {
  warm: { rate: '+0%', pitch: '+0Hz', volume: '+0%' },
  cheerful: { rate: '+10%', pitch: '+10Hz', volume: '+0%' },
  playful: { rate: '+15%', pitch: '+20Hz', volume: '+5%' },
  lively: { rate: '+20%', pitch: '+15Hz', volume: '+5%' },
  calm: { rate: '-5%', pitch: '-10Hz', volume: '-5%' },
  steady: { rate: '-10%', pitch: '-5Hz', volume: '+0%' },
  gentle: { rate: '-5%', pitch: '+5Hz', volume: '+0%' },
  confident: { rate: '+5%', pitch: '+0Hz', volume: '+10%' },
  relaxed: { rate: '+0%', pitch: '+0Hz', volume: '+0%' },
  innocent: { rate: '+15%', pitch: '+30Hz', volume: '+5%' },
  seductive: { rate: '-15%', pitch: '-20Hz', volume: '+5%' },
  formal: { rate: '-5%', pitch: '+0Hz', volume: '+0%' },
  energetic: { rate: '+20%', pitch: '+10Hz', volume: '+15%' },
  youthful: { rate: '+10%', pitch: '+20Hz', volume: '+5%' },
  deep: { rate: '-10%', pitch: '-30Hz', volume: '+5%' }
};

// 音频保存目录
const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');

// 确保音频目录存在
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// API限流配置
const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60000, // 1分钟内最多10个请求
  requestQueue: [],
  lastReset: Date.now()
};

// 清空限流队列
function resetRateLimit() {
  const now = Date.now();
  if (now - RATE_LIMIT.lastReset > RATE_LIMIT.windowMs) {
    RATE_LIMIT.requestQueue = [];
    RATE_LIMIT.lastReset = now;
  }
}

// 检查限流
async function checkRateLimit() {
  resetRateLimit();
  if (RATE_LIMIT.requestQueue.length >= RATE_LIMIT.maxRequests) {
    const oldestRequest = RATE_LIMIT.requestQueue[0];
    const waitTime = RATE_LIMIT.windowMs - (Date.now() - oldestRequest);
    if (waitTime > 0) {
      console.log(`[TTS] 触发限流，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      RATE_LIMIT.requestQueue.shift();
    }
  }
  RATE_LIMIT.requestQueue.push(Date.now());
}

/**
 * 获取可用音色列表
 * @param {string} gender - 可选，按性别筛选
 * @returns {Promise<Array>} 音色列表
 */
async function getVoices(gender = null) {
  try {
    // 尝试从数据库获取
    const result = await pool.query('SELECT * FROM tts_voices WHERE is_active = true ORDER BY id ASC');
    if (result.rows.length > 0) {
      const voices = result.rows.map(v => ({
        id: v.voice_id,
        name: v.voice_name,
        code: v.voice_code,
        gender: v.gender,
        language: v.language,
        style: v.style || '',
        emotion: v.emotion || '',
        description: v.description,
        age: v.age || 'adult'
      }));
      if (gender) {
        return voices.filter(v => v.gender === gender);
      }
      return voices;
    }
  } catch (err) {
    console.log('[TTS] 从数据库获取音色失败，使用预定义列表:', err.message);
  }
  // 返回预定义音色列表
  if (gender) {
    return VOICES.filter(v => v.gender === gender);
  }
  return VOICES;
}

/**
 * 获取音色详情
 * @param {string} voiceId - 音色ID
 * @returns {Object|null} 音色详情
 */
function getVoiceInfo(voiceId) {
  return VOICES.find(v => v.id === voiceId) || null;
}

/**
 * 将文本转换为SSML标记（用于情感控制）
 * @param {string} text - 原始文本
 * @param {Object} options - 情感选项
 * @returns {string} SSML标记文本
 */
function textToSSML(text, options = {}) {
  const { emotion = 'calm', rate = '+0%', pitch = '+0Hz', volume = '+0%' } = options;
  
  // 替换特殊字符
  let ssmlText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  // 添加情感停顿（在句子之间）
  ssmlText = ssmlText.replace(/([，。！？；、])/g, '<break time="200ms"/>$1');
  
  // 重要词汇加重音
  ssmlText = ssmlText.replace(/“([^”]+)”/g, '<emphasis level="moderate">"$1"</emphasis>');
  
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
      ${ssmlText}
    </prosody>
  </speak>`;
}

/**
 * 使用Edge TTS生成语音（免费方案）
 * @param {string} text - 要转换的文本
 * @param {string} voice - 音色ID
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 可选参数 { rate, volume, pitch, emotion }
 * @returns {Promise<string>} 生成的文件路径
 */
async function synthesizeEdgeTTS(text, voice, outputPath, options = {}) {
  const { rate = '+0%', volume = '+0%', pitch = '+0Hz', emotion = null } = options;
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 清理文本：去除换行符（命令行不支持多行文本）
  let cleanText = text.replace(/\n/g, ' ').replace(/\r/g, '').trim();

  // 构建edge-tts参数数组（用execFile避免命令行转义问题）
  const args = ['--text', cleanText, '--voice', voice, '--write-media', outputPath];

  // 如果有情感参数，合并到rate/pitch/volume
  if (emotion && EMOTION_PARAMS[emotion]) {
    const emotionParams = EMOTION_PARAMS[emotion];
    args.push('--rate', options.rate || emotionParams.rate || '+0%');
    args.push('--volume', options.volume || emotionParams.volume || '+0%');
    args.push('--pitch', options.pitch || emotionParams.pitch || '+0Hz');
  } else {
    args.push('--rate', rate);
    args.push('--volume', volume);
    args.push('--pitch', pitch);
  }

  console.log('[TTS] 开始生成配音 (Edge):', { text: cleanText.substring(0, 50), voice, outputPath });

  try {
    const { stdout, stderr } = await execFileAsync('edge-tts', args, { timeout: 60000 });
    if (stderr) {
      console.log('[TTS] edge-tts stderr:', stderr);
    }
    
    if (fs.existsSync(outputPath)) {
      console.log('[TTS] 配音生成成功:', outputPath);
      return outputPath;
    } else {
      throw new Error('音频文件未生成');
    }
  } catch (err) {
    console.error('[TTS] 配音生成失败:', err.message);
    throw err;
  }
}

/**
 * 使用智谱TTS生成语音（付费方案）
 * @param {string} text - 要转换的文本
 * @param {string} voice - 音色ID
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} 生成的文件路径
 */
async function synthesizeZhipuTTS(text, voice, outputPath, options = {}) {
  const { rate = 1.0, volume = 1.0, pitch = 1.0 } = options;
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
  if (!ZHIPU_API_KEY) {
    throw new Error('智谱API Key未配置，请设置ZHIPU_API_KEY环境变量');
  }

  // 智谱TTS API
  const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/t2a_v2';
  
  // 音色映射
  const voiceMap = {
    'zh-CN-XiaoxiaoNeural': 'coptional',
    'zh-CN-YunxiNeural': 'coptional',
    'female-tianmei': 'female-tianmei',
    'male-yunyang': 'male-yunyang'
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 't2a-2.0',
        text: text,
        stream: false,
        voice: voiceMap[voice] || 'coptional',
        speed: rate,
        volume: volume
      })
    });

    if (!response.ok) {
      throw new Error(`智谱TTS API错误: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.data && data.data.audio) {
      // 将base64音频保存为文件
      const audioBuffer = Buffer.from(data.data.audio, 'base64');
      fs.writeFileSync(outputPath, audioBuffer);
      console.log('[TTS] 配音生成成功 (智谱):', outputPath);
      return outputPath;
    } else {
      throw new Error('智谱TTS返回数据格式错误');
    }
  } catch (err) {
    console.error('[TTS] 智谱TTS生成失败:', err.message);
    throw err;
  }
}

/**
 * 统一的语音合成接口
 * @param {string} text - 要转换的文本
 * @param {string} voice - 音色ID
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} 生成的文件路径
 */
async function synthesize(text, voice, outputPath, options = {}) {
  // 检查限流
  await checkRateLimit();

  switch (CURRENT_PROVIDER) {
    case TTS_PROVIDER.ZHIPU:
      return synthesizeZhipuTTS(text, voice, outputPath, options);
    case TTS_PROVIDER.EDGE:
    default:
      return synthesizeEdgeTTS(text, voice, outputPath, options);
  }
}

/**
 * 为单个镜头生成配音
 * @param {number} shotId - 镜头ID
 * @param {string} voice - 音色ID
 * @param {Object} options - 可选参数 { rate, volume, pitch, emotion }
 * @returns {Promise<Object>} 生成结果
 */
async function generateShotAudio(shotId, voice, options = {}) {
  // 获取镜头信息
  const shotRes = await pool.query(
    `SELECT s.*, c.name as character_name, c.default_voice_id as char_default_voice, c.default_voice_name as char_default_voice_name 
     FROM shots s 
     LEFT JOIN characters c ON s.character_id = c.id 
     WHERE s.id = $1`,
    [shotId]
  );
  
  if (shotRes.rows.length === 0) {
    throw new Error('镜头不存在');
  }
  
  const shot = shotRes.rows[0];
  let text = shot.dialogue || shot.original_text || '';
  
  if (!text || text.trim() === '') {
    throw new Error('镜头没有台词');
  }

  // 清洗文本：去除角色标注（如 @队长：、@队员甲：）和多余标记
  text = text.replace(/@[^：:]+[：:]/g, '').trim();
  // 去除方括号标记（如 [旁白]）
  text = text.replace(/\[([^\]]+)\]/g, '').trim();

  // 使用角色绑定的默认音色或指定音色
  const actualVoice = voice || shot.char_default_voice || 'zh-CN-XiaoxiaoNeural';
  
  // 获取音色名称
  const voiceInfo = getVoiceInfo(actualVoice) || { 
    name: shot.char_default_voice_name || actualVoice,
    emotion: options.emotion || 'calm'
  };
  
  // 生成唯一文件名
  const timestamp = Date.now();
  const filename = `shot_${shotId}_${timestamp}.mp3`;
  const outputPath = path.join(AUDIO_DIR, filename);
  const fileUrl = `/uploads/audio/${filename}`;

  try {
    // 更新状态为生成中
    await pool.query(
      'UPDATE shots SET tts_status = $1 WHERE id = $2',
      ['generating', shotId]
    );

    // 生成配音
    const synthesisOptions = {
      rate: options.rate || '+0%',
      volume: options.volume || '+0%',
      pitch: options.pitch || '+0Hz',
      emotion: options.emotion || voiceInfo.emotion
    };
    
    await synthesize(text, actualVoice, outputPath, synthesisOptions);

    // 更新镜头记录
    await pool.query(
      `UPDATE shots SET 
        audio_url = $1, 
        voice_id = $2, 
        voice_name = $3, 
        tts_status = $4 
      WHERE id = $5`,
      [fileUrl, actualVoice, voiceInfo.name, 'completed', shotId]
    );

    // 获取音频时长
    let duration = 0;
    try {
      const audioInfo = await getAudioDuration(outputPath);
      duration = audioInfo.duration;
    } catch (e) {
      console.log('[TTS] 获取音频时长失败:', e.message);
    }

    return {
      shotId,
      audioUrl: fileUrl,
      voice: actualVoice,
      voiceName: voiceInfo.name,
      text,
      duration,
      status: 'completed'
    };
  } catch (err) {
    // 更新状态为失败
    await pool.query(
      'UPDATE shots SET tts_status = $1 WHERE id = $2',
      ['failed', shotId]
    );
    throw err;
  }
}

/**
 * 获取音频文件时长
 * @param {string} filePath - 音频文件路径
 * @returns {Promise<Object>} 音频信息
 */
async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        const duration = parseFloat(stdout.trim()) || 0;
        resolve({ duration });
      }
    });
  });
}

/**
 * 批量生成配音（带排队和限流）
 * @param {number} scriptId - 剧本ID
 * @param {string} defaultVoice - 默认音色
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 批量生成结果
 */
async function batchGenerateAudio(scriptId, defaultVoice = 'zh-CN-XiaoxiaoNeural', options = {}, shotIds = null, voiceMap = {}) {
  // 获取剧本下所有有台词的镜头
  let query = `SELECT s.*, c.default_voice_id as char_default_voice, c.default_voice_name as char_default_voice_name,
            c.name as character_name
     FROM shots s 
     LEFT JOIN characters c ON s.character_id = c.id 
     WHERE s.script_id = $1 
     AND (s.dialogue IS NOT NULL AND s.dialogue != '' OR s.original_text IS NOT NULL AND s.original_text != '')`;
  const params = [scriptId];
  
  // 如果指定了镜头ID，只处理这些镜头
  if (Array.isArray(shotIds) && shotIds.length > 0) {
    query += ` AND s.id = ANY($2)`;
    params.push(shotIds);
  }
  
  query += ` ORDER BY s.scene_id, s.shot_number`;
  
  const shotsRes = await pool.query(query, params);

  const shots = shotsRes.rows;
  const results = {
    total: shots.length,
    success: 0,
    failed: 0,
    details: []
  };

  console.log(`[TTS] 开始批量生成配音，共 ${shots.length} 个镜头...`);

  for (const shot of shots) {
    try {
      // 音色优先级：shotVoiceMap指定 > 角色绑定音色 > 默认音色
      const voice = voiceMap[shot.id] || shot.char_default_voice || defaultVoice;
      const result = await generateShotAudio(shot.id, voice, options);
      results.success++;
      results.details.push({ shotId: shot.id, status: 'success', ...result });
      
      // 批量处理时增加延迟，避免触发限流
      if (shots.indexOf(shot) < shots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      results.failed++;
      results.details.push({ 
        shotId: shot.id, 
        status: 'failed', 
        error: err.message 
      });
      console.error(`[TTS] 镜头 ${shot.id} 配音失败:`, err.message);
    }
  }

  console.log(`[TTS] 批量生成完成: 成功 ${results.success} 个，失败 ${results.failed} 个`);
  return results;
}

/**
 * 删除镜头配音
 * @param {number} shotId - 镜头ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteShotAudio(shotId) {
  // 获取镜头当前配音信息
  const shotRes = await pool.query(
    'SELECT audio_url FROM shots WHERE id = $1',
    [shotId]
  );

  if (shotRes.rows.length === 0) {
    throw new Error('镜头不存在');
  }

  const { audio_url } = shotRes.rows[0];

  // 删除本地文件
  if (audio_url) {
    const filePath = path.join(__dirname, '..', audio_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // 清除数据库记录
  await pool.query(
    'UPDATE shots SET audio_url = NULL, voice_id = NULL, voice_name = NULL, tts_status = $1 WHERE id = $2',
    ['none', shotId]
  );

  return { shotId, deleted: true };
}

/**
 * 更新角色默认音色
 * @param {number} characterId - 角色ID
 * @param {string} voiceId - 音色ID
 * @param {string} voiceName - 音色名称
 * @returns {Promise<Object>} 更新结果
 */
async function updateCharacterDefaultVoice(characterId, voiceId, voiceName) {
  const result = await pool.query(
    'UPDATE characters SET default_voice_id = $1, default_voice_name = $2 WHERE id = $3 RETURNING *',
    [voiceId, voiceName, characterId]
  );

  if (result.rows.length === 0) {
    throw new Error('角色不存在');
  }

  return result.rows[0];
}

/**
 * 获取剧本下所有镜头的配音状态
 * @param {number} scriptId - 剧本ID
 * @returns {Promise<Array>} 配音状态列表
 */
async function getShotAudioStatus(scriptId) {
  const result = await pool.query(
    `SELECT s.id, s.shot_number, s.dialogue, s.original_text, 
            s.audio_url, s.voice_id, s.voice_name, s.tts_status,
            s.scene_id, s.character_id,
            c.name as character_name
     FROM shots s
     LEFT JOIN characters c ON s.character_id = c.id
     WHERE s.script_id = $1
     ORDER BY s.scene_id, s.shot_number`,
    [scriptId]
  );

  return result.rows;
}

/**
 * 预览配音（不保存）
 * @param {string} text - 台词文本
 * @param {string} voice - 音色ID
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 预览结果（包含音频URL）
 */
async function previewAudio(text, voice, options = {}) {
  const voiceInfo = getVoiceInfo(voice) || { name: voice, emotion: 'calm' };
  
  // 生成预览文件名
  const timestamp = Date.now();
  const filename = `preview_${timestamp}.mp3`;
  const outputPath = path.join(AUDIO_DIR, filename);
  const fileUrl = `/uploads/audio/${filename}`;

  const synthesisOptions = {
    rate: options.rate || '+0%',
    volume: options.volume || '+0%',
    pitch: options.pitch || '+0Hz',
    emotion: options.emotion || voiceInfo.emotion
  };

  await synthesize(text, voice, outputPath, synthesisOptions);

  // 获取音频时长
  let duration = 0;
  try {
    const audioInfo = await getAudioDuration(outputPath);
    duration = audioInfo.duration;
  } catch (e) {
    console.log('[TTS] 获取预览音频时长失败:', e.message);
  }

  return {
    audioUrl: fileUrl,
    voice,
    voiceName: voiceInfo.name,
    text,
    duration,
    emotion: synthesisOptions.emotion
  };
}

/**
 * 文本配音（直接传入文本生成音频，用于测试）
 * @param {string} text - 台词文本
 * @param {Object} options - 可选参数 { voice, rate, volume, pitch, emotion }
 * @returns {Promise<Object>} 生成结果
 */
async function textToAudio(text, options = {}) {
  const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
  const voiceInfo = getVoiceInfo(voice) || { name: voice };
  
  const timestamp = Date.now();
  const filename = `text_${timestamp}.mp3`;
  const outputPath = path.join(AUDIO_DIR, filename);
  const fileUrl = `/uploads/audio/${filename}`;

  const synthesisOptions = {
    rate: options.rate || '+0%',
    volume: options.volume || '+0%',
    pitch: options.pitch || '+0Hz',
    emotion: options.emotion || voiceInfo.emotion
  };

  await synthesize(text, voice, outputPath, synthesisOptions);

  let duration = 0;
  try {
    const audioInfo = await getAudioDuration(outputPath);
    duration = audioInfo.duration;
  } catch (e) {
    console.log('[TTS] 获取音频时长失败:', e.message);
  }

  return {
    audioUrl: fileUrl,
    voice,
    voiceName: voiceInfo.name,
    text,
    duration
  };
}

module.exports = {
  VOICES,
  TTS_PROVIDER,
  EMOTION_PARAMS,
  getVoices,
  getVoiceInfo,
  synthesize,
  generateShotAudio,
  batchGenerateAudio,
  deleteShotAudio,
  updateCharacterDefaultVoice,
  getShotAudioStatus,
  previewAudio,
  textToAudio,
  textToSSML
};
