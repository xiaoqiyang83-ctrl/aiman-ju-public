/**
 * 音频生成Worker
 * 处理音频生成任务：tts配音
 */
const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const { redis } = require('../config/redis');
const { updateTaskStatus } = require('../queues/submit');
const { pool } = require('../shared');

// Worker配置
const AUDIO_CONCURRENCY = parseInt(process.env.AUDIO_CONCURRENCY) || 2;
const JOB_TIMEOUT = 2 * 60 * 1000; // 2分钟

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'audio');

// 确保输出目录存在
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * 生成Mock音频URL
 */
function generateMockAudioUrl(audioId, sceneId) {
  const timestamp = Date.now();
  return `/audio/mock_tts_${audioId}_${timestamp}.mp3`;
}

/**
 * 估算音频时长（根据文本长度）
 */
function estimateDuration(text, speed = 1.0) {
  // 假设中文约300字/分钟，英文约150词/分钟
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const duration = (chineseChars / 300 + englishWords / 150) * 60 / speed;
  return Math.max(1, Math.round(duration));
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
 * 音频生成逻辑
 */
async function processAudioJob(job) {
  const { audioId, sceneId, type, params, userId, mockMode, jobId } = job.data;
  
  console.log(`[audioWorker] 开始处理音频任务, audioId: ${audioId}, type: ${type}, mockMode: ${mockMode}`);
  
  await ensureOutputDir();
  
  try {
    // 进度0%: 准备阶段
    await updateProgress(job, 0, '准备生成配音...');
    
    // 获取场景信息（如果有sceneId）
    let text = params.text || '';
    if (sceneId) {
      const sceneResult = await pool.query(
        `SELECT * FROM scenes WHERE id = $1`,
        [sceneId]
      );
      if (sceneResult.rows.length > 0) {
        text = sceneResult.rows[0].dialogue || text;
      }
    }
    
    // 进度10%: 检查文本
    await updateProgress(job, 10, '检查配音文本...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (!text || text.trim().length === 0) {
      throw new Error('配音文本为空');
    }
    
    // 进度20%: 准备生成
    await updateProgress(job, 20, '准备语音合成...');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    let audioUrl;
    let duration = 0;
    
    if (mockMode) {
      // Mock模式：模拟TTS生成延迟（1-3秒）
      const delay = 1000 + Math.random() * 2000;
      console.log(`[audioWorker] Mock模式, 模拟延迟 ${Math.round(delay)}ms`);
      
      // 模拟进度
      for (let i = 30; i <= 80; i += 20) {
        await updateProgress(job, i, '语音合成中...');
        await new Promise(resolve => setTimeout(resolve, delay / 3));
      }
      
      // 生成Mock音频URL
      audioUrl = generateMockAudioUrl(audioId, sceneId);
      duration = estimateDuration(text, params.speed || 1.0);
      
    } else {
      // 真实模式：调用TTS API
      await updateProgress(job, 30, '正在调用TTS API...');
      
      // TODO: 接入TTS API（如阿里云、腾讯云等）
      // const result = await callTTSAPI(text, params.voice, params.speed);
      // audioUrl = result.audioUrl;
      // duration = result.duration;
      
      throw new Error('真实模式尚未实现，请设置MOCK_MODE=true');
    }
    
    // 进度90%: 完成
    await updateProgress(job, 90, '音频生成完成，准备保存...');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 进度100%: 完成
    await updateProgress(job, 100, '配音生成完成');
    
    // 更新scene_audio表
    await pool.query(
      `UPDATE scene_audio SET 
        file_url = $1,
        status = 'completed',
        duration = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3`,
      [audioUrl, duration, audioId]
    );
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'completed', 100, { audioUrl, duration });
    
    console.log(`[audioWorker] 音频任务完成, audioId: ${audioId}, audioUrl: ${audioUrl}, duration: ${duration}s`);
    
    return {
      success: true,
      audioId,
      sceneId,
      audioUrl,
      duration
    };
    
  } catch (error) {
    console.error(`[audioWorker] 音频任务失败, audioId: ${audioId}:`, error.message);
    
    // 更新scene_audio表状态
    await pool.query(
      `UPDATE scene_audio SET 
        status = 'failed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
      [audioId]
    );
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'failed', job.progress || 0, null, error.message);
    
    throw error;
  }
}

// 创建Worker
const audioWorker = new Worker(
  'audioQueue',
  processAudioJob,
  {
    connection: redis,
    concurrency: AUDIO_CONCURRENCY,
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
audioWorker.on('completed', (job, result) => {
  console.log(`[audioWorker] 任务完成, jobId: ${job.data.jobId}, result:`, result);
});

audioWorker.on('failed', (job, err) => {
  console.error(`[audioWorker] 任务失败, jobId: ${job?.data?.jobId}:`, err.message);
});

audioWorker.on('error', (err) => {
  console.error('[audioWorker] Worker错误:', err.message);
});

audioWorker.on('stalled', (job) => {
  console.warn(`[audioWorker] 任务停滞, jobId: ${job?.data?.jobId}`);
});

module.exports = { audioWorker, processAudioJob };
