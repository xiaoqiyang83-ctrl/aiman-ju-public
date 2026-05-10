/**
 * 口型同步 Worker
 */
const { Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { pool } = require('../shared');
const { updateTaskStatus } = require('../queues/submit');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processLipSync(job) {
  const { jobId, shotId, params, userId, mockMode } = job.data;
  const { video_url, audio_url } = params;

  console.log(`[lipSyncWorker] 开始口型同步, shotId: ${shotId}`);

  try {
    if (mockMode) {
      // 1. 模拟处理过程
      await updateTaskStatus(jobId, 'active', 20, { message: '正在解析视频帧与音频频谱...' });
      await sleep(1500);
      
      await updateTaskStatus(jobId, 'active', 50, { message: '正在进行口型对齐特征提取...' });
      await sleep(1500);
      
      await updateTaskStatus(jobId, 'active', 80, { message: '正在合成口型同步视频...' });
      await sleep(1000);
      
      const lipSyncVideoUrl = `https://mock-cdn.aimanju.com/videos/lipsync_${shotId}_${Date.now()}.mp4`;
      
      // 2. 更新数据库
      await pool.query(
        `UPDATE shots SET 
          lip_sync_video_url = $1, 
          lip_sync_status = 'completed',
          video_url = $1 -- 完成后直接替换主视频URL
        WHERE id = $2`,
        [lipSyncVideoUrl, shotId]
      );

      // 3. 完成任务
      await updateTaskStatus(jobId, 'completed', 100, {
        message: '口型同步已完成',
        video_url: lipSyncVideoUrl
      });
    } else {
      // TODO: 接入真实口型同步 API (如 Wav2Lip 或 外部服务)
      // 1. 下载视频和音频
      // 2. 调用口型同步算法
      // 3. 上传结果视频
      console.log('[lipSyncWorker] TODO: 接入真实口型同步 API');
      throw new Error('真实 API 尚未接入');
    }

    console.log(`[lipSyncWorker] 任务完成, shotId: ${shotId}`);
  } catch (err) {
    console.error(`[lipSyncWorker] 任务失败:`, err);
    await pool.query(
      `UPDATE shots SET lip_sync_status = 'failed' WHERE id = $1`,
      [shotId]
    );
    await updateTaskStatus(jobId, 'failed', 0, null, err.message);
    throw err;
  }
}

const lipSyncWorker = new Worker('lipSyncQueue', processLipSync, {
  connection: redis,
  concurrency: 2
});

module.exports = { lipSyncWorker };
