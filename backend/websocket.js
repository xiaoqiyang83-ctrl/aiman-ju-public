/**
 * WebSocket支持（可选功能）
 * 用于实时推送任务状态更新
 */
const WebSocket = require('ws');

let wss = null;
const clients = new Map(); // projectId -> Set of WebSocket connections

/**
 * 初始化WebSocket服务
 */
function setupWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws/tasks' });
  
  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] 客户端连接');
    
    let clientProjectId = null;
    
    // 解析projectId（从查询参数）
    const url = new URL(req.url, 'http://localhost');
    const projectId = url.searchParams.get('projectId');
    
    if (projectId) {
      clientProjectId = parseInt(projectId);
      if (!clients.has(clientProjectId)) {
        clients.set(clientProjectId, new Set());
      }
      clients.get(clientProjectId).add(ws);
      console.log(`[WebSocket] 客户端订阅项目 ${clientProjectId}`);
    }
    
    // 接收消息
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleClientMessage(ws, data);
      } catch (err) {
        console.error('[WebSocket] 解析消息失败:', err);
      }
    });
    
    // 断开连接
    ws.on('close', () => {
      console.log('[WebSocket] 客户端断开');
      if (clientProjectId && clients.has(clientProjectId)) {
        clients.get(clientProjectId).delete(ws);
        if (clients.get(clientProjectId).size === 0) {
          clients.delete(clientProjectId);
        }
      }
    });
    
    // 错误处理
    ws.on('error', (err) => {
      console.error('[WebSocket] 连接错误:', err);
    });
    
    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket连接已建立',
      projectId: clientProjectId
    }));
  });
  
  console.log('[WebSocket] WebSocket服务已启动，监听 /ws/tasks');
  
  return wss;
}

/**
 * 处理客户端消息
 */
function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'subscribe':
      // 订阅项目
      if (data.projectId) {
        const projectId = parseInt(data.projectId);
        if (!clients.has(projectId)) {
          clients.set(projectId, new Set());
        }
        clients.get(projectId).add(ws);
        ws.send(JSON.stringify({
          type: 'subscribed',
          projectId
        }));
      }
      break;
      
    case 'unsubscribe':
      // 取消订阅
      if (data.projectId) {
        const projectId = parseInt(data.projectId);
        if (clients.has(projectId)) {
          clients.get(projectId).delete(ws);
        }
      }
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    default:
      console.log('[WebSocket] 未知消息类型:', data.type);
  }
}

/**
 * 广播任务更新到项目
 */
function broadcastTaskUpdate(projectId, taskData) {
  if (!wss || !clients.has(projectId)) return;
  
  const message = JSON.stringify({
    type: 'task_update',
    ...taskData
  });
  
  clients.get(projectId).forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
  
  console.log(`[WebSocket] 广播任务更新到项目 ${projectId}`);
}

/**
 * 广播任务完成到项目
 */
function broadcastTaskComplete(projectId, jobId, result) {
  if (!wss || !clients.has(projectId)) return;
  
  const message = JSON.stringify({
    type: 'task_complete',
    jobId,
    ...result
  });
  
  clients.get(projectId).forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
  
  console.log(`[WebSocket] 广播任务完成到项目 ${projectId}, jobId: ${jobId}`);
}

/**
 * 广播任务失败到项目
 */
function broadcastTaskFailed(projectId, jobId, error) {
  if (!wss || !clients.has(projectId)) return;
  
  const message = JSON.stringify({
    type: 'task_failed',
    jobId,
    error
  });
  
  clients.get(projectId).forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * 广播队列状态更新
 */
function broadcastQueueStatus() {
  if (!wss) return;
  
  const message = JSON.stringify({
    type: 'queue_status'
  });
  
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * 关闭WebSocket服务
 */
function closeWebSocket() {
  if (wss) {
    wss.close();
    clients.clear();
    console.log('[WebSocket] WebSocket服务已关闭');
  }
}

/**
 * 获取连接统计
 */
function getConnectionStats() {
  let totalConnections = 0;
  const projectConnections = {};
  
  clients.forEach((sockets, projectId) => {
    totalConnections += sockets.size;
    projectConnections[projectId] = sockets.size;
  });
  
  return {
    totalConnections,
    projectConnections,
    projectCount: clients.size
  };
}

module.exports = {
  setupWebSocket,
  broadcastTaskUpdate,
  broadcastTaskComplete,
  broadcastTaskFailed,
  broadcastQueueStatus,
  closeWebSocket,
  getConnectionStats
};
