/**
 * 视频生成Worker
 * 处理视频生成任务：text2video、image2video、reference2video
 */
const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const { redis } = require('../config/redis');
const { updateTaskStatus } = require('../queues/submit');
const { pool } = require('../shared');

// Worker配置
const VIDEO_CONCURRENCY = parseInt(process.env.VIDEO_CONCURRENCY) || 1;
const JOB_TIMEOUT = 10 * 60 * 1000; // 10分钟

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'videos');

// 确保输出目录存在
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * 生成Mock视频URL
 */
function generateMockVideoUrl(shotId, type) {
  const timestamp = Date.now();
  return `/videos/mock_${type}_${shotId}_${timestamp}.mp4`;
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
 * 视频生成逻辑
 */
async function processVideoJob(job) {
  const { shotId, type, params, userId, mockMode, jobId } = job.data;
  
  console.log(`[videoWorker] 开始处理视频任务, shotId: ${shotId}, type: ${type}, mockMode: ${mockMode}`);
  
  await ensureOutputDir();
  
  try {
    // 进度0%: 准备阶段
    await updateProgress(job, 0, '准备生成视频...');
    
    // 获取分镜信息（shots通过script_id关联scripts，scripts有project_id）
    const shotResult = await pool.query(
      `SELECT s.* FROM shots s
       WHERE s.id = $1`,
      [shotId]
    );
    
    if (shotResult.rows.length === 0) {
      throw new Error(`分镜 ${shotId} 不存在`);
    }
    
    const shot = shotResult.rows[0];
    
    // 进度10%: 检查参数
    await updateProgress(job, 10, '检查生成参数...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 进度30%: 准备生成（Mock模式）
    await updateProgress(job, 30, '正在生成视频...');
    
    let videoUrl;
    
    if (mockMode) {
      // 模拟生成过程
      if (type === 'image2video') {
        await updateProgress(job, 20, '正在上传场景参考图...');
        if (params.scene_image_url) {
          console.log(`[videoWorker] 使用场景参考图: ${params.scene_image_url}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await updateProgress(job, 50, '正在分析图片内容与运动幅度...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        await updateProgress(job, 30, '正在上传角色参考图...');
        if (params.reference_image) {
          console.log(`[videoWorker] 使用角色参考图: ${params.reference_image}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      await updateProgress(job, 70, 'AI模型视频生成中...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await updateProgress(job, 95, '正在合成并优化最终视频...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      videoUrl = `https://mock-cdn.aimanju.com/videos/mock_${shotId}_${Date.now()}.mp4`;
    } else {
      // 真实模式：调用外部API
      await updateProgress(job, 10, '正在准备生成参数...');
      
      if (type === 'image2video') {
        // TODO: 接入即梦或 Vidu API (图生视频)
        // 1. 准备场景参考图: params.scene_image_url
        // 2. 准备提示词: params.visual_description
        // 3. 调用 API: const result = await jimengClient.image2video({ image: params.scene_image_url, prompt: params.visual_description, ... })
        console.log('[videoWorker] TODO: 接入图生视频 API (I2V)');
        videoUrl = `https://jimeng-mock.aimanju.com/videos/jimeng_${shotId}.mp4`;
      } else if (type === 'reference2video' || type === 'character_video') {
        // TODO: 接入 Vidu API (参考生视频)
        // 1. 准备参考图: params.reference_image
        // 2. 准备提示词: params.visual_description
        // 3. 调用 Vidu API: const result = await viduClient.createTask({ reference_image: params.reference_image, prompt: params.visual_description, ... })
        // 4. 轮询状态直到完成
        console.log('[videoWorker] TODO: 接入 Vidu API (Ref2Video)');
        videoUrl = `https://vidu-mock.aimanju.com/videos/vidu_${shotId}.mp4`;
      } else {
        // TODO: 接入即梦或 Vidu API (文本生视频)
        // const result = await callJiMengAPI(type, params);
        // videoUrl = result.videoUrl;
        console.log('[videoWorker] TODO: 接入视频生成 API (Text2Video)');
        videoUrl = `https://mock-cdn.aimanju.com/videos/mock_${shotId}.mp4`;
      }
    }
    
    // 进度100%: 完成
    await updateProgress(job, 100, '视频生成完成');
    
    // 更新shots表
    await pool.query(
      `UPDATE shots SET 
        video_url = $1,
        video_status = 'completed'
      WHERE id = $2`,
      [videoUrl, shotId]
    );
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'completed', 100, { videoUrl });
    
    console.log(`[videoWorker] 视频任务完成, shotId: ${shotId}, videoUrl: ${videoUrl}`);
    
    return {
      success: true,
      shotId,
      videoUrl,
      type
    };
    
  } catch (error) {
    console.error(`[videoWorker] 视频任务失败, shotId: ${shotId}:`, error.message);
    
    // 更新shots表状态
    await pool.query(
      `UPDATE shots SET video_status = 'failed' WHERE id = $1`,
      [shotId]
    );
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'failed', job.progress || 0, null, error.message);
    
    throw error;
  }
}

// 创建Worker
const videoWorker = new Worker(
  'videoQueue',
  processVideoJob,
  {
    connection: redis,
    concurrency: VIDEO_CONCURRENCY,
    limiter: {
      max: 1,
      duration: 1000 // 每秒最多1个任务
    },
    lockDuration: JOB_TIMEOUT,
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 3600
    }
  }
);

// Worker事件
videoWorker.on('completed', (job, result) => {
  console.log(`[videoWorker] 任务完成, jobId: ${job.data.jobId}, result:`, result);
});

videoWorker.on('failed', (job, err) => {
  console.error(`[videoWorker] 任务失败, jobId: ${job?.data?.jobId}:`, err.message);
});

videoWorker.on('error', (err) => {
  console.error('[videoWorker] Worker错误:', err.message);
});

videoWorker.on('stalled', (job) => {
  console.warn(`[videoWorker] 任务停滞, jobId: ${job?.data?.jobId}`);
});

module.exports = { videoWorker, processVideoJob };
