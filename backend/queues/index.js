/**
 * BullMQ队列定义
 * 4个队列：videoQueue、audioQueue、exportQueue、imageQueue
 */
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');

// 队列配置
const QUEUE_CONFIGS = {
  video: {
    name: 'videoQueue',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: {
        age: 24 * 3600, // 24小时后自动删除
        count: 1000
      },
      removeOnFail: {
        age: 7 * 24 * 3600 // 7天后删除失败任务
      }
    }
  },
  audio: {
    name: 'audioQueue',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000
      },
      removeOnFail: {
        age: 7 * 24 * 3600
      }
    }
  },
  export: {
    name: 'exportQueue',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 500
      },
      removeOnFail: {
        age: 7 * 24 * 3600
      }
    }
  },
  image: {
    name: 'imageQueue',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 2000
      },
      removeOnFail: {
        age: 7 * 24 * 3600
      }
    }
  },
  autoGenerate: {
    name: 'autoGenerateQueue',
    defaultJobOptions: {
      attempts: 1, // 一键成片流程较长，暂不自动重试
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 }
    }
  },
  lipSync: {
    name: 'lipSyncQueue',
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 }
    }
  }
};

// 创建队列实例
const queues = {
  videoQueue: new Queue(QUEUE_CONFIGS.video.name, {
    connection: redis,
    defaultJobOptions: QUEUE_CONFIGS.video.defaultJobOptions
  }),
  audioQueue: new Queue(QUEUE_CONFIGS.audio.name, {
    connection: redis,
    defaultJobOptions: QUEUE_CONFIGS.audio.defaultJobOptions
  }),
  exportQueue: new Queue(QUEUE_CONFIGS.export.name, {
    connection: redis,
    defaultJobOptions: QUEUE_CONFIGS.export.defaultJobOptions
  }),
  imageQueue: new Queue(QUEUE_CONFIGS.image.name, {
    connection: redis,
    defaultJobOptions: QUEUE_CONFIGS.image.defaultJobOptions
  }),
  autoGenerateQueue: new Queue(QUEUE_CONFIGS.autoGenerate.name, {
    connection: redis,
    defaultJobOptions: QUEUE_CONFIGS.autoGenerate.defaultJobOptions
  }),
  lipSyncQueue: new Queue(QUEUE_CONFIGS.lipSync.name, {
    connection: redis,
    defaultJobOptions: QUEUE_CONFIGS.lipSync.defaultJobOptions
  })
};

// 队列事件监听
Object.entries(queues).forEach(([key, queue]) => {
  queue.on('error', (err) => {
    console.error(`[Queue:${key}] 队列错误:`, err.message);
  });
  
  queue.on('waiting', (job) => {
    console.log(`[Queue:${key}] 任务等待中, jobId: ${job.id}`);
  });
  
  queue.on('active', (job) => {
    console.log(`[Queue:${key}] 任务开始执行, jobId: ${job.id}`);
  });
  
  queue.on('completed', (job, result) => {
    console.log(`[Queue:${key}] 任务完成, jobId: ${job.id}, result:`, result);
  });
  
  queue.on('failed', (job, err) => {
    console.error(`[Queue:${key}] 任务失败, jobId: ${job.id}, error:`, err.message);
  });
  
  queue.on('progress', (job, progress) => {
    console.log(`[Queue:${key}] 任务进度, jobId: ${job.id}, progress: ${progress}%`);
  });
});

/**
 * 获取队列状态统计
 */
async function getQueueStats() {
  const stats = {};
  
  for (const [key, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);
    
    stats[key] = {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  }
  
  return stats;
}

/**
 * 清空指定队列（慎用）
 */
async function clearQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`队列 ${queueName} 不存在`);
  }
  
  await queue.empty();
  console.log(`[Queue:${queueName}] 队列已清空`);
}

/**
 * 关闭所有队列连接
 */
async function closeAllQueues() {
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );
  console.log('[Queues] 所有队列连接已关闭');
}

module.exports = {
  queues,
  QUEUE_CONFIGS,
  getQueueStats,
  clearQueue,
  closeAllQueues
};
