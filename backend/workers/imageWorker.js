/**
 * 图片生成Worker
 * 处理图片生成任务：character_image（角色图）、shot_image（分镜图）
 */
const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const { redis } = require('../config/redis');
const { updateTaskStatus } = require('../queues/submit');
const { pool } = require('../shared');

// Worker配置
const IMAGE_CONCURRENCY = parseInt(process.env.IMAGE_CONCURRENCY) || 2;
const JOB_TIMEOUT = 5 * 60 * 1000; // 5分钟

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images');

// 确保输出目录存在
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * 生成SVG占位图（Mock模式）
 */
function generatePlaceholderSvg(type, params) {
  const width = 512;
  const height = 512;
  const bgColor = type === 'character_image' ? '#4A90D9' : '#67C23A';
  const title = type === 'character_image' ? 'Character' : 'Shot';
  const timestamp = Date.now();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2C3E50;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad1)"/>
  <circle cx="${width/2}" cy="${height/2 - 40}" r="80" fill="rgba(255,255,255,0.3)"/>
  <text x="${width/2}" y="${height/2 + 60}" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
    ${title} Image
  </text>
  <text x="${width/2}" y="${height/2 + 100}" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    Generated at ${new Date(timestamp).toLocaleString()}
  </text>
</svg>`;
}

/**
 * 生成Mock图片URL
 */
function generateMockImageUrl(type, refId) {
  const timestamp = Date.now();
  const folder = type === 'character_image' ? 'characters' : 'shots';
  return `/images/${folder}/mock_${type}_${refId}_${timestamp}.svg`;
}

/**
 * 更新任务进度
 */
async function updateProgress(job, progress, message) {
  await job.updateProgress(progress);
  await updateTaskStatus(
    job.data.jobId,
    'active',
    progress,
    { message }
  );
}

/**
 * 图片生成逻辑
 */
async function processImageJob(job) {
  const { type, params, userId, mockMode, jobId } = job.data;
  const refId = params.refId || params.characterId;
  
  console.log(`[imageWorker] 开始处理图片任务, type: ${type}, refId: ${refId}, mockMode: ${mockMode}`);
  
  await ensureOutputDir();
  
  try {
    // 进度0%: 准备阶段
    await updateProgress(job, 0, '准备生成图片...');
    
    let prompt = params.prompt || '';
    let imageUrl;
    let updateTable, updateId;
    
    // 根据类型获取更多信息
    if (type === 'character_image' && params.characterId) {
      const charResult = await pool.query(
        `SELECT * FROM characters WHERE id = $1`,
        [params.characterId]
      );
      if (charResult.rows.length > 0) {
        const char = charResult.rows[0];
        prompt = prompt || char.description || char.name;
        updateTable = 'characters';
        updateId = params.characterId;
      }
    } else if (type === 'shot_image' && params.shotId) {
      const shotResult = await pool.query(
        `SELECT * FROM shots WHERE id = $1`,
        [params.shotId]
      );
      if (shotResult.rows.length > 0) {
        const shot = shotResult.rows[0];
        prompt = prompt || shot.prompt || shot.description;
        updateTable = 'shots';
        updateId = params.shotId;
      }
    }
    
    // 进度10%: 检查提示词
    await updateProgress(job, 10, '检查图片描述...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (!prompt && !mockMode) {
      throw new Error('图片描述为空');
    }
    
    // 进度20%: 准备生成
    await updateProgress(job, 20, '准备图像生成...');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (mockMode) {
      // Mock模式：模拟生成延迟
      const delay = 2000 + Math.random() * 3000;
      console.log(`[imageWorker] Mock模式, 模拟延迟 ${Math.round(delay)}ms`);
      
      // 模拟进度
      for (let i = 30; i <= 80; i += 20) {
        await updateProgress(job, i, '图像生成中...');
        await new Promise(resolve => setTimeout(resolve, delay / 3));
      }
      
      // 生成Mock图片URL
      imageUrl = generateMockImageUrl(type, refId);
      
      // 在Mock模式下也生成一个SVG文件
      const folder = type === 'character_image' ? 'characters' : 'shots';
      const filePath = path.join(OUTPUT_DIR, folder, `mock_${type}_${refId}_${Date.now()}.svg`);
      await fs.writeFile(filePath, generatePlaceholderSvg(type, params));
      
    } else {
      // 真实模式：调用即梦API
      await updateProgress(job, 30, '正在调用即梦API...');
      
      // TODO: 接入即梦API
      // const result = await callJiMengImageAPI(prompt, params);
      // imageUrl = result.imageUrl;
      
      throw new Error('真实模式尚未实现，请设置MOCK_MODE=true');
    }
    
    // 进度90%: 完成
    await updateProgress(job, 90, '图片生成完成，准备保存...');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 进度100%: 完成
    await updateProgress(job, 100, '图片生成完成');
    
    // 更新对应表
    if (updateTable === 'characters') {
      await pool.query(
        `UPDATE characters SET 
          image_url = $1,
          image_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [imageUrl, updateId]
      );
    } else if (updateTable === 'shots') {
      await pool.query(
        `UPDATE shots SET 
          image_url = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [imageUrl, updateId]
      );
    }
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'completed', 100, { imageUrl });
    
    console.log(`[imageWorker] 图片任务完成, type: ${type}, refId: ${refId}, imageUrl: ${imageUrl}`);
    
    return {
      success: true,
      type,
      refId,
      imageUrl
    };
    
  } catch (error) {
    console.error(`[imageWorker] 图片任务失败, type: ${type}, refId: ${refId}:`, error.message);
    
    // 更新表状态
    const refId = params.refId || params.characterId;
    if (type === 'character_image' && params.characterId) {
      await pool.query(
        `UPDATE characters SET 
          image_status = 'failed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [params.characterId]
      );
    }
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'failed', job.progress || 0, null, error.message);
    
    throw error;
  }
}

// 创建Worker
const imageWorker = new Worker(
  'imageQueue',
  processImageJob,
  {
    connection: redis,
    concurrency: IMAGE_CONCURRENCY,
    limiter: {
      max: 2,
      duration: 1000
    },
    lockDuration: JOB_TIMEOUT,
    removeOnComplete: {
      age: 24 * 3600,
      count: 2000
    },
    removeOnFail: {
      age: 7 * 24 * 3600
    }
  }
);

// Worker事件
imageWorker.on('completed', (job, result) => {
  console.log(`[imageWorker] 任务完成, jobId: ${job.data.jobId}, result:`, result);
});

imageWorker.on('failed', (job, err) => {
  console.error(`[imageWorker] 任务失败, jobId: ${job?.data?.jobId}:`, err.message);
});

imageWorker.on('error', (err) => {
  console.error('[imageWorker] Worker错误:', err.message);
});

imageWorker.on('stalled', (job) => {
  console.warn(`[imageWorker] 任务停滞, jobId: ${job?.data?.jobId}`);
});

module.exports = { imageWorker, processImageJob };
