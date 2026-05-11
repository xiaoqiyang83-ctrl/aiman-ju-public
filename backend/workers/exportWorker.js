/**
 * 导出Worker
 * 处理视频导出任务：MP4拼接
 */
const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const { redis } = require('../config/redis');
const { updateTaskStatus } = require('../queues/submit');
const { pool } = require('../config/database');

// Worker配置
const EXPORT_CONCURRENCY = parseInt(process.env.EXPORT_CONCURRENCY) || 1;
const JOB_TIMEOUT = 15 * 60 * 1000; // 15分钟

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'exports');

// 确保输出目录存在
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * 检查FFmpeg是否可用
 */
async function checkFFmpeg() {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error) => {
      resolve(!error);
    });
  });
}

/**
 * 生成Mock导出URL
 */
function generateMockExportUrl(projectId, exportId, format) {
  const timestamp = Date.now();
  return `/uploads/exports/mock_project_${projectId}_${exportId}_${timestamp}.${format}`;
}

/**
 * 估算导出文件大小（基于分镜数量）
 */
function estimateFileSize(shotsCount, quality) {
  // 估算：720p约5MB/分钟，1080p约15MB/分钟，4K约50MB/分钟
  const baseSize = quality === '4k' ? 50 : quality === '1080p' ? 15 : 5;
  const avgDurationPerShot = 5; // 每分镜平均5秒
  const totalDuration = shotsCount * avgDurationPerShot / 60; // 分钟
  return Math.round(totalDuration * baseSize * 1024 * 1024); // 字节
}

/**
 * 更新任务进度
 */
async function updateProgress(job, progress, message) {
  await job.updateProgress(progress);
  if (job?.data?.exportId) {
    await pool.query(
      `UPDATE exports SET status = 'processing', progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [progress, job.data.exportId]
    );
  }
  await updateTaskStatus(
    job.data.jobId,
    'active',
    progress,
    { message }
  );
}

/**
 * 导出逻辑
 */
async function processExportJob(job) {
  const { exportId, projectId, type, params, userId, mockMode, jobId } = job.data;
  
  console.log(`[exportWorker] 开始处理导出任务, exportId: ${exportId}, mockMode: ${mockMode}`);
  
  await ensureOutputDir();
  
  try {
    // 进度0%: 准备阶段
    await updateProgress(job, 0, '准备导出项目...');
    
    // 获取项目信息
    const projectResult = await pool.query(
      `SELECT * FROM projects WHERE id = $1`,
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error(`项目 ${projectId} 不存在`);
    }
    
    const project = projectResult.rows[0];
    
    // 获取所有分镜
    const shotsResult = await pool.query(
      `SELECT * FROM shots 
       WHERE project_id = $1 
       ORDER BY order_index ASC`,
      [projectId]
    );
    
    const shots = shotsResult.rows;
    const config = params?.config || {
      resolution: params?.resolution || params?.quality || '1080p',
      format: params?.format || 'mp4',
      include_voice: params?.include_voice !== false,
      include_bgm: params?.include_bgm !== false
    };
    const quality = config.resolution || '1080p';
    const format = config.format || 'mp4';
    
    // 进度10%: 检查分镜
    await updateProgress(job, 10, `检查 ${shots.length} 个分镜...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 检查分镜视频是否都已生成
    const missingVideos = shots.filter(s => !s.video_url || s.video_status !== 'completed');
    if (missingVideos.length > 0 && !mockMode) {
      throw new Error(`${missingVideos.length} 个分镜视频尚未生成完成`);
    }
    
    // 进度20%: 准备导出
    await updateProgress(job, 20, '准备视频拼接...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let exportUrl;
    let fileSize = 0;
    let duration = 0;
    
    // 检查FFmpeg
    const hasFFmpeg = await checkFFmpeg();
    
    if (mockMode || !hasFFmpeg) {
      // Mock模式：模拟导出延迟（5-10秒）
      const delay = 5000 + Math.random() * 5000;
      console.log(`[exportWorker] Mock模式, 模拟延迟 ${Math.round(delay)}ms`);
      
      // 模拟进度
      await updateProgress(job, 30, '视频拼接中...');
      await new Promise(resolve => setTimeout(resolve, delay / 4));
      await updateProgress(job, 55, '视频拼接中...');
      await new Promise(resolve => setTimeout(resolve, delay / 4));
      if (config.include_voice || config.include_bgm) {
        await updateProgress(job, 70, '音频轨道处理中...');
        await new Promise(resolve => setTimeout(resolve, delay / 4));
      }
      await updateProgress(job, 80, '封装导出文件...');
      await new Promise(resolve => setTimeout(resolve, delay / 4));
      
      // 生成Mock导出URL
      exportUrl = generateMockExportUrl(projectId, exportId, format);
      fileSize = estimateFileSize(shots.length, quality);
      duration = shots.length * 5; // 每分镜5秒估算

      const filename = path.basename(exportUrl);
      const outputPath = path.join(OUTPUT_DIR, filename);
      const firstVideo = shots.find(s => typeof s.video_url === 'string' && s.video_url.includes('/uploads/'));
      if (firstVideo) {
        const parts = firstVideo.video_url.split('/').filter(Boolean);
        const folder = parts[1];
        const srcName = path.basename(firstVideo.video_url);
        const srcPath = path.join(__dirname, '..', 'uploads', folder, srcName);
        try {
          await fs.copyFile(srcPath, outputPath);
        } catch {
          await fs.writeFile(outputPath, Buffer.from('MOCK_MP4'));
        }
      } else {
        await fs.writeFile(outputPath, Buffer.from('MOCK_MP4'));
      }
      
    } else {
      // 真实模式：使用FFmpeg拼接
      await updateProgress(job, 30, '正在拼接视频...');
      
      // TODO: 使用FFmpeg拼接视频
      // const result = await concatenateVideos(shots, quality, format, OUTPUT_DIR);
      // exportUrl = result.url;
      // fileSize = result.fileSize;
      // duration = result.duration;
      
      throw new Error('FFmpeg模式尚未实现，请设置MOCK_MODE=true');
    }
    
    // 进度90%: 完成
    await updateProgress(job, 90, '视频导出完成，准备保存...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 进度100%: 完成
    await updateProgress(job, 100, '项目导出完成');
    
    // 更新exports表
    await pool.query(
      `UPDATE exports SET 
        file_url = $1,
        file_path = $1,
        file_size = $2,
        duration = $3,
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4`,
      [exportUrl, fileSize, duration, exportId]
    );
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'completed', 100, { exportUrl, fileSize, duration });
    
    console.log(`[exportWorker] 导出任务完成, exportId: ${exportId}, exportUrl: ${exportUrl}`);
    
    return {
      success: true,
      exportId,
      projectId,
      exportUrl,
      fileSize,
      duration
    };
    
  } catch (error) {
    console.error(`[exportWorker] 导出任务失败, exportId: ${exportId}:`, error.message);
    
    // 更新exports表状态
    await pool.query(
      `UPDATE exports SET 
        status = 'failed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
      [exportId]
    );
    
    // 更新任务状态
    await updateTaskStatus(jobId, 'failed', job.progress || 0, null, error.message);
    
    throw error;
  }
}

// 创建Worker
const exportWorker = new Worker(
  'exportQueue',
  processExportJob,
  {
    connection: redis,
    concurrency: EXPORT_CONCURRENCY,
    limiter: {
      max: 1,
      duration: 2000
    },
    lockDuration: JOB_TIMEOUT,
    removeOnComplete: {
      age: 24 * 3600,
      count: 500
    },
    removeOnFail: {
      age: 7 * 24 * 3600
    }
  }
);

// Worker事件
exportWorker.on('completed', (job, result) => {
  console.log(`[exportWorker] 任务完成, jobId: ${job.data.jobId}, result:`, result);
});

exportWorker.on('failed', (job, err) => {
  console.error(`[exportWorker] 任务失败, jobId: ${job?.data?.jobId}:`, err.message);
});

exportWorker.on('error', (err) => {
  console.error('[exportWorker] Worker错误:', err.message);
});

exportWorker.on('stalled', (job) => {
  console.warn(`[exportWorker] 任务停滞, jobId: ${job?.data?.jobId}`);
});

module.exports = { exportWorker, processExportJob };
