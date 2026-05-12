/**
 * video-generate-service.js - 智谱AI CogVideoX视频生成服务
 * v1.0 支持 CogVideoX-Flash(免费) 和 CogVideoX-2(0.5元/次)
 * 支持文生视频和图生视频两种模式
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { pool } = require('../shared');

// 智谱AI配置
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || 'bbeed8803bea453bb6b12198c276087a.EmUkjkS2HbdyoLwg';
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

// CogVideoX模型配置
const COGVIDEO_MODELS = {
  'cogvideox-flash': {
    name: 'CogVideoX-Flash',
    price: 0, // 免费
    supportsImage: true,
    supportsAudio: true,
    maxDuration: 5 // 秒
  },
  'cogvideox-2': {
    name: 'CogVideoX-2',
    price: 0.5,
    supportsImage: true,
    supportsAudio: true,
    maxDuration: 10
  }
};

// 默认使用免费模型
const DEFAULT_MODEL = 'cogvideox-flash';
const DEFAULT_SIZE = '1920x1080';
const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 5; // 秒

// 轮询配置
const POLL_INTERVAL_MS = 3000; // 3秒轮询一次
const MAX_POLL_COUNT = 60; // 最多轮询60次（约3分钟）

/**
 * 下载文件到本地
 * @param {string} url - 文件URL
 * @param {string} localPath - 本地保存路径
 * @returns {Promise<string>} 本地文件路径
 */
async function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    // 确保目录存在
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(localPath);

    // 判断是http还是https
    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        downloadFile(response.headers.location, localPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        reject(new Error('下载失败: HTTP ' + response.statusCode));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('[VideoGenerateService] 文件已保存: ' + localPath);
        resolve(localPath);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(localPath, () => {}); // 清理失败的文件
      reject(err);
    });
  });
}

/**
 * 调用智谱AI CogVideoX视频生成API（异步任务模式）
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 视频描述（英文效果更好）
 * @param {string} [params.imageUrl] - 首帧图片URL（图生视频模式）
 * @param {string} [params.model] - 模型名称
 * @param {string} [params.size] - 视频尺寸
 * @param {number} [params.fps] - 帧率
 * @param {boolean} [params.withAudio] - 是否生成音频
 * @param {string} [params.quality] - 质量 speed/hd
 * @returns {Promise<Object>} { taskId: 任务ID }
 */
async function generateVideo({ prompt, imageUrl, model = DEFAULT_MODEL, size = DEFAULT_SIZE, fps = DEFAULT_FPS, withAudio = true, quality = 'speed' }) {
  const config = COGVIDEO_MODELS[model] || COGVIDEO_MODELS[DEFAULT_MODEL];

  // 构建请求体
  const requestBody = {
    model: model,
    prompt: prompt,
    quality: quality,
    with_audio: withAudio,
    size: size,
    fps: fps
  };

  // 图生视频模式
  if (imageUrl) {
    requestBody.image_url = imageUrl;
  }

  console.log('[VideoGenerateService] 提交视频生成任务');
  console.log('[VideoGenerateService] Model: ' + model + ', Size: ' + size);
  console.log('[VideoGenerateService] With Audio: ' + withAudio);
  console.log('[VideoGenerateService] Prompt: ' + prompt.substring(0, 200) + '...');
  if (imageUrl) {
    console.log('[VideoGenerateService] Image URL: ' + imageUrl);
  }

  // 429重试逻辑
  const MAX_RETRIES = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(ZHIPU_BASE_URL + '/videos/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ZHIPU_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const delay = attempt * 15000; // 15s, 30s, 45s, 60s, 75s
        console.log('[VideoGenerateService] 429限流，第' + attempt + '次重试，等待' + (delay/1000) + '秒...');
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = new Error('CogVideoX API错误: ' + response.status + ' - ' + errorText);
        continue;
      }
      throw new Error('CogVideoX API错误: ' + response.status + ' - ' + errorText);
    }

    const result = await response.json();

    if (!result.id) {
      throw new Error('CogVideoX API返回格式错误: ' + JSON.stringify(result));
    }

    console.log('[VideoGenerateService] 任务已提交, taskId: ' + result.id);
    return { taskId: result.id };
  }
  
  throw lastError || new Error('CogVideoX API重试失败');
}

/**
 * 查询视频生成任务状态
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} { status: PROCESSING/COMPLETED/FAILED, videoUrl?, coverImageUrl?, error? }
 */
async function getVideoTaskStatus(taskId) {
  console.log('[VideoGenerateService] 查询任务状态: ' + taskId);

  const response = await fetch(ZHIPU_BASE_URL + '/videos/generations/' + taskId, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + ZHIPU_API_KEY
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('查询任务状态失败: ' + response.status + ' - ' + errorText);
  }

  const result = await response.json();

  const status = result.task_status?.toUpperCase();
  const videoResult = result.video_result?.[0];

  console.log('[VideoGenerateService] 任务状态: ' + status);

  if (status === 'COMPLETED' && videoResult) {
    return {
      status: 'completed',
      videoUrl: videoResult.url,
      coverImageUrl: videoResult.cover_image_url
    };
  } else if (status === 'FAILED') {
    return {
      status: 'failed',
      error: result.fail_reason || '视频生成失败'
    };
  } else {
    return { status: 'processing' };
  }
}

/**
 * 等待视频生成完成（轮询）
 * @param {string} taskId - 任务ID
 * @param {Function} [onProgress] - 进度回调
 * @returns {Promise<Object>} { videoUrl, coverImageUrl, localVideoPath }
 */
async function waitForVideoCompletion(taskId, onProgress) {
  let pollCount = 0;

  while (pollCount < MAX_POLL_COUNT) {
    const result = await getVideoTaskStatus(taskId);

    if (result.status === 'completed') {
      console.log('[VideoGenerateService] 视频生成完成');
      return result;
    } else if (result.status === 'failed') {
      throw new Error('视频生成失败: ' + result.error);
    }

    pollCount++;
    if (onProgress) {
      onProgress(pollCount, MAX_POLL_COUNT);
    }

    console.log('[VideoGenerateService] 等待中... (' + pollCount + '/' + MAX_POLL_COUNT + ')');
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('视频生成超时（超过' + (MAX_POLL_COUNT * POLL_INTERVAL_MS / 1000) + '秒）');
}

/**
 * 生成分镜视频（图生视频模式，使用首帧图）
 * @param {number} shotId - 镜头ID
 * @param {Object} [options] - 可选参数
 * @param {string} [options.model] - 模型
 * @param {boolean} [options.withAudio] - 是否生成音频
 * @returns {Promise<Object>} { taskId, shotId }
 */
async function generateShotVideo(shotId, options = {}) {
  // 获取镜头信息
  const shotResult = await pool.query(
    'SELECT * FROM shots WHERE id = $1',
    [shotId]
  );

  if (shotResult.rows.length === 0) {
    throw new Error('镜头不存在: ' + shotId);
  }

  const shot = shotResult.rows[0];

  // 获取首帧图URL
  const imageUrl = shot.scene_image_url;

  if (!imageUrl) {
    throw new Error('镜头没有首帧图，请先生成分镜图片');
  }

  // 获取完整的视频提示词
  const prompt = shot.video_prompt || shot.visual_prompt || shot.visual_description || shot.action_description;

  if (!prompt) {
    throw new Error('镜头没有视频提示词');
  }

  // 获取场景信息（用于获取完整URL）
  const sceneResult = await pool.query(
    'SELECT s.* FROM scenes s WHERE s.id = $1',
    [shot.scene_id]
  );

  let fullImageUrl = imageUrl;
  if (!imageUrl.startsWith('http')) {
    // 补全为完整URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    fullImageUrl = baseUrl + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
  }

  const { model = DEFAULT_MODEL, withAudio = true } = options;

  // 提交视频生成任务
  const { taskId } = await generateVideo({
    prompt: prompt,
    imageUrl: fullImageUrl,
    model: model,
    withAudio: withAudio
  });

  // 更新镜头状态
  await pool.query(
    'UPDATE shots SET video_status = $1, job_id = $2 WHERE id = $3',
    ['pending', taskId, shotId]
  );

  return { taskId, shotId };
}

/**
 * 下载视频到本地并更新数据库
 * @param {string} taskId - 任务ID
 * @param {number} shotId - 镜头ID
 * @param {string} videoUrl - 视频URL
 * @param {string} [coverImageUrl] - 封面图URL
 * @returns {Promise<Object>} { localVideoPath, coverImagePath }
 */
async function downloadAndUpdateShot(taskId, shotId, videoUrl, coverImageUrl) {
  // 生成文件名
  const timestamp = Date.now();
  const videoFilename = 'video-shot-' + shotId + '-' + timestamp + '.mp4';
  const videoLocalPath = path.join(__dirname, '../uploads/videos', videoFilename);
  const videoRelativePath = '/uploads/videos/' + videoFilename;

  // 下载视频
  await downloadFile(videoUrl, videoLocalPath);

  let coverRelativePath = null;

  // 下载封面图（可选）
  if (coverImageUrl) {
    const coverFilename = 'cover-shot-' + shotId + '-' + timestamp + '.jpg';
    const coverLocalPath = path.join(__dirname, '../uploads/videos', coverFilename);
    coverRelativePath = '/uploads/videos/' + coverFilename;

    try {
      await downloadFile(coverImageUrl, coverLocalPath);
    } catch (err) {
      console.warn('[VideoGenerateService] 封面图下载失败:', err.message);
      coverRelativePath = null;
    }
  }

  // 更新数据库
  await pool.query(
    'UPDATE shots SET video_url = $1, video_status = $2 WHERE id = $3',
    [videoRelativePath, 'completed', shotId]
  );

  console.log('[VideoGenerateService] 视频已保存, shotId: ' + shotId + ', path: ' + videoRelativePath);

  return {
    localVideoPath: videoLocalPath,
    videoRelativePath: videoRelativePath,
    coverImagePath: coverRelativePath ? path.join(__dirname, '../uploads/videos', coverRelativePath) : null
  };
}

/**
 * 通用视频生成接口（直接传参数）
 * @param {Object} params - { prompt, imageUrl?, model?, size?, fps?, withAudio? }
 * @returns {Promise<Object>} { taskId }
 */
async function generateFromParams(params) {
  const { taskId } = await generateVideo(params);
  return { taskId };
}

/**
 * 测试API连接
 */
async function testConnection() {
  try {
    // 使用简单的测试prompt
    const result = await generateVideo({
      prompt: 'a cat sleeping on a sofa, cozy home, high quality',
      model: 'cogvideox-flash',
      withAudio: false
    });
    return { success: true, taskId: result.taskId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 获取支持的模型列表
 */
function getSupportedModels() {
  return Object.entries(COGVIDEO_MODELS).map(([key, value]) => ({
    id: key,
    name: value.name,
    price: value.price,
    supportsImage: value.supportsImage,
    supportsAudio: value.supportsAudio,
    maxDuration: value.maxDuration
  }));
}

module.exports = {
  generateVideo,
  getVideoTaskStatus,
  waitForVideoCompletion,
  generateShotVideo,
  downloadAndUpdateShot,
  generateFromParams,
  downloadFile,
  testConnection,
  getSupportedModels,
  COGVIDEO_MODELS,
  DEFAULT_MODEL,
  DEFAULT_SIZE,
  DEFAULT_FPS,
  POLL_INTERVAL_MS,
  MAX_POLL_COUNT
};
