/**
 * Redis配置文件
 * 用于BullMQ队列连接
 */
const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null, // BullMQ要求设置为null
  enableReadyCheck: false, // 避免连接延迟问题
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('[Redis] 超过最大重试次数，放弃连接');
      return null;
    }
    return Math.min(times * 100, 3000);
  }
};

// 创建Redis客户端
const redis = new Redis(redisConfig);

// 事件监听
redis.on('connect', () => {
  console.log('[Redis] 连接成功');
});

redis.on('error', (err) => {
  console.error('[Redis] 连接错误:', err.message);
});

redis.on('close', () => {
  console.log('[Redis] 连接已关闭');
});

module.exports = { redis, redisConfig };
