// ========================================
// AIManju v5.2 Edge TTS配音服务
// 使用Python edge-tts通过child_process调用
// ========================================

const { pool } = require('../shared');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 预定义的中文音色列表
const VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female', style: '温柔', description: '温柔亲和的年轻女声' },
  { id: 'zh-CN-YunxiNeural', name: '云希', gender: 'male', style: '阳光', description: '阳光帅气的年轻男声' },
  { id: 'zh-CN-YunjianNeural', name: '云健', gender: 'male', style: '磁性', description: '磁性低沉的成熟男声' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female', style: '活泼', description: '活泼可爱的年轻女声' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male', style: '播音', description: '新闻播报风格男声' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰', gender: 'female', style: '轻松', description: '轻松自然的年轻女声' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', gender: 'female', style: '甜美', description: '甜美温柔的年轻女声' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦', gender: 'female', style: '可爱', description: '可爱俏皮的年轻女声' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', gender: 'female', style: '成熟', description: '成熟知性的女性声音' },
  { id: 'zh-CN-XiaoruiNeural', name: '晓睿', gender: 'female', style: '知性', description: '知性优雅的女性声音' },
  { id: 'zh-CN-XiaoshuangNeural', name: '晓双', gender: 'female', style: '儿童', description: '稚嫩可爱的儿童女声' },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', gender: 'female', style: '温暖', description: '温暖柔和的女性声音' },
  { id: 'zh-CN-XiaozhenNeural', name: '晓甄', gender: 'female', style: '大气', description: '大气端庄的女性声音' },
  { id: 'zh-CN-YunfengNeural', name: '云枫', gender: 'male', style: '沉稳', description: '沉稳有力的成熟男声' },
  { id: 'zh-CN-YunhaoNeural', name: '云皓', gender: 'male', style: '广告', description: '专业广告配音男声' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', gender: 'male', style: '少年', description: '清澈阳光的少年男声' },
  { id: 'zh-CN-YunzeNeural', name: '云泽', gender: 'male', style: '低沉', description: '低沉浑厚的成熟男声' },
];

// 音频保存目录
const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');

// 确保音频目录存在
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * 获取可用音色列表
 * @returns {Promise<Array>} 音色列表
 */
async function getVoices() {
  try {
    // 尝试从数据库获取
    const result = await pool.query('SELECT * FROM tts_voices WHERE is_active = true ORDER BY id ASC');
    if (result.rows.length > 0) {
      return result.rows.map(v => ({
        id: v.voice_id,
        name: v.voice_name,
        code: v.voice_code,
        gender: v.gender,
        language: v.language,
        description: v.description
      }));
    }
  } catch (err) {
    console.log('[TTS] 从数据库获取音色失败，使用预定义列表:', err.message);
  }
  // 返回预定义音色列表
  return VOICES;
}

/**
 * 使用edge-tts生成语音
 * @param {string} text - 要转换的文本
 * @param {string} voice - 音色ID
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 可选参数 { rate, volume }
 * @returns {Promise<string>} 生成的文件路径
 */
async function synthesize(text, voice, outputPath, options = {}) {
  const { rate = '+0%', volume = '+0%' } = options;
  
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 构建edge-tts命令
  const cmd = `edge-tts --text "${text.replace(/"/g, '\\"')}" --voice ${voice} --rate ${rate} --volume ${volume} --write-media "${outputPath}"`;

  console.log('[TTS] 开始生成配音:', { text: text.substring(0, 50), voice, outputPath });

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
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
 * 为单个镜头生成配音
 * @param {number} shotId - 镜头ID
 * @param {string} voice - 音色ID
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 生成结果
 */
async function generateShotAudio(shotId, voice, options = {}) {
  // 获取镜头信息
  const shotRes = await pool.query(
    'SELECT s.*, c.name as character_name, c.default_voice_id as char_default_voice FROM shots s LEFT JOIN characters c ON s.character_id = c.id WHERE s.id = $1',
    [shotId]
  );
  
  if (shotRes.rows.length === 0) {
    throw new Error('镜头不存在');
  }
  
  const shot = shotRes.rows[0];
  const text = shot.dialogue || shot.original_text || '';
  
  if (!text || text.trim() === '') {
    throw new Error('镜头没有台词');
  }

  // 使用角色绑定的默认音色或指定音色
  const actualVoice = voice || shot.char_default_voice || 'zh-CN-XiaoxiaoNeural';
  
  // 获取音色名称
  const voiceInfo = VOICES.find(v => v.id === actualVoice) || { name: actualVoice };
  
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
    await synthesize(text, actualVoice, outputPath, options);

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

    return {
      shotId,
      audioUrl: fileUrl,
      voice: actualVoice,
      voiceName: voiceInfo.name,
      text,
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
 * 批量生成配音
 * @param {number} scriptId - 剧本ID
 * @param {string} defaultVoice - 默认音色
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 批量生成结果
 */
async function batchGenerateAudio(scriptId, defaultVoice = 'zh-CN-XiaoxiaoNeural', options = {}) {
  // 获取剧本下所有有台词的镜头
  const shotsRes = await pool.query(
    `SELECT s.*, c.default_voice_id as char_default_voice 
     FROM shots s 
     LEFT JOIN characters c ON s.character_id = c.id 
     WHERE s.script_id = $1 
     AND (s.dialogue IS NOT NULL AND s.dialogue != '' OR s.original_text IS NOT NULL AND s.original_text != '')
     ORDER BY s.scene_id, s.shot_number`,
    [scriptId]
  );

  const shots = shotsRes.rows;
  const results = {
    total: shots.length,
    success: 0,
    failed: 0,
    details: []
  };

  for (const shot of shots) {
    try {
      // 使用角色绑定的默认音色或指定音色
      const voice = shot.char_default_voice || defaultVoice;
      const result = await generateShotAudio(shot.id, voice, options);
      results.success++;
      results.details.push({ shotId: shot.id, status: 'success', ...result });
    } catch (err) {
      results.failed++;
      results.details.push({ 
        shotId: shot.id, 
        status: 'failed', 
        error: err.message 
      });
    }
  }

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
            c.name as character_name
     FROM shots s
     LEFT JOIN characters c ON s.character_id = c.id
     WHERE s.script_id = $1
     ORDER BY s.scene_id, s.shot_number`,
    [scriptId]
  );

  return result.rows;
}

module.exports = {
  VOICES,
  getVoices,
  synthesize,
  generateShotAudio,
  batchGenerateAudio,
  deleteShotAudio,
  updateCharacterDefaultVoice,
  getShotAudioStatus
};
