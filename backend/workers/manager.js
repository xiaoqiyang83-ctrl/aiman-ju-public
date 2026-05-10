/**
 * Worker管理器
 * 启动所有Worker、优雅关闭、错误处理、状态监控
 */
const { videoWorker } = require('./videoWorker');
const { audioWorker } = require('./audioWorker');
const { exportWorker } = require('./exportWorker');
const { imageWorker } = require('./imageWorker');
const { redis } = require('../config/redis');
const { queues, getQueueStats, closeAllQueues } = require('../queues');
const { pool } = require('../shared');

// 所有Worker实例
const workers = {
  video: videoWorker,
  audio: audioWorker,
  export: exportWorker,
  image: imageWorker
};

// 运行状态
let isRunning = false;
let startTime = null;

/**
 * 启动所有Worker
 */
async function startAllWorkers() {
  if (isRunning) {
    console.log('[WorkerManager] Workers已经在运行中');
    return;
  }
  
  console.log('[WorkerManager] 正在启动所有Workers...');
  console.log(`[WorkerManager] VIDEO_CONCURRENCY: ${process.env.VIDEO_CONCURRENCY || 1}`);
  console.log(`[WorkerManager] AUDIO_CONCURRENCY: ${process.env.AUDIO_CONCURRENCY || 2}`);
  console.log(`[WorkerManager] EXPORT_CONCURRENCY: ${process.env.EXPORT_CONCURRENCY || 1}`);
  console.log(`[WorkerManager] IMAGE_CONCURRENCY: ${process.env.IMAGE_CONCURRENCY || 2}`);
  console.log(`[WorkerManager] MOCK_MODE: ${process.env.MOCK_MODE !== 'false'}`);
  
  isRunning = true;
  startTime = new Date();
  
  console.log('[WorkerManager] 所有Workers已启动');
}

/**
 * 优雅关闭所有Worker
 */
async function gracefulShutdown(signal) {
  console.log(`[WorkerManager] 收到${signal}信号，开始优雅关闭...`);
  
  isRunning = false;
  
  try {
    // 关闭所有Worker
    console.log('[WorkerManager] 正在关闭Workers...');
    await Promise.all(
      Object.entries(workers).map(async ([name, worker]) => {
        try {
          await worker.close();
          console.log(`[WorkerManager] ${name}Worker已关闭`);
        } catch (err) {
          console.error(`[WorkerManager] 关闭${name}Worker失败:`, err.message);
        }
      })
    );
    
    // 关闭所有队列
    await closeAllQueues();
    
    // 关闭Redis连接
    await redis.quit();
    console.log('[WorkerManager] Redis连接已关闭');
    
    console.log('[WorkerManager] 优雅关闭完成');
    process.exit(0);
    
  } catch (error) {
    console.error('[WorkerManager] 优雅关闭出错:', error.message);
    process.exit(1);
  }
}

// 注册信号处理器
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('[WorkerManager] 未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WorkerManager] 未处理的Promise拒绝:', reason);
});

/**
 * 获取Worker状态
 */
async function getWorkersStatus() {
  const stats = await getQueueStats();
  
  return {
    running: isRunning,
    uptime: startTime ? Math.round((Date.now() - startTime.getTime()) / 1000) : 0,
    queues: stats,
    workers: {
      video: {
        name: 'videoWorker',
        concurrency: parseInt(process.env.VIDEO_CONCURRENCY) || 1,
        status: videoWorker ? 'running' : 'stopped'
      },
      audio: {
        name: 'audioWorker',
        concurrency: parseInt(process.env.AUDIO_CONCURRENCY) || 2,
        status: audioWorker ? 'running' : 'stopped'
      },
      export: {
        name: 'exportWorker',
        concurrency: parseInt(process.env.EXPORT_CONCURRENCY) || 1,
        status: exportWorker ? 'running' : 'stopped'
      },
      image: {
        name: 'imageWorker',
        concurrency: parseInt(process.env.IMAGE_CONCURRENCY) || 2,
        status: imageWorker ? 'running' : 'stopped'
      }
    }
  };
}

/**
 * 获取最近的任务记录
 */
async function getRecentJobs(limit = 20) {
  const result = await pool.query(
    `SELECT * FROM task_jobs 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * 获取用户最近的任务记录
 */
async function getUserJobs(userId, limit = 20) {
  const result = await pool.query(
    `SELECT * FROM task_jobs 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * 获取项目相关的任务记录
 */
async function getProjectJobs(projectId, limit = 50) {
  const result = await pool.query(
    `SELECT * FROM task_jobs 
     WHERE project_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [projectId, limit]
  );
  return result.rows;
}

/**
 * 获取失败任务统计
 */
async function getFailedJobsStats() {
  const result = await pool.query(
    `SELECT 
       queue_name,
       COUNT(*) as count
     FROM task_jobs 
     WHERE status = 'failed' 
       AND created_at > NOW() - INTERVAL '24 hours'
     GROUP BY queue_name`
  );
  return result.rows;
}

/**
 * 健康检查
 */
async function healthCheck() {
  try {
    // 检查Redis连接
    await redis.ping();
    
    // 检查数据库
    await pool.query('SELECT 1');
    
    return {
      status: 'healthy',
      redis: 'connected',
      database: 'connected',
      workers: isRunning ? 'running' : 'stopped'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

module.exports = {
  workers,
  startAllWorkers,
  gracefulShutdown,
  getWorkersStatus,
  getRecentJobs,
  getUserJobs,
  getProjectJobs,
  getFailedJobsStats,
  healthCheck
};
