/**
 * Worker启动入口
 * 用于独立启动Worker进程（不依赖主Express服务器）
 */
const { startAllWorkers, gracefulShutdown, healthCheck } = require('./workers/manager');

console.log('='.repeat(50));
console.log('AIManju Worker 启动中...');
console.log('='.repeat(50));

// 启动Worker
startAllWorkers();

// 健康检查定时器
setInterval(async () => {
  const health = await healthCheck();
  if (health.status !== 'healthy') {
    console.warn('[Worker] 健康检查失败:', health);
  }
}, 60000); // 每分钟检查一次

// 进程信息
process.on('exit', (code) => {
  console.log(`[Worker] 进程退出, code: ${code}`);
});

process.on('disconnect', () => {
  console.log('[Worker] 主进程断开连接');
});
