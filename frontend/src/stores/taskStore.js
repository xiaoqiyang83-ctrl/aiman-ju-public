/**
 * 任务状态轮询Store - v3.8
 * 管理视频、音频、导出、图片生成任务的轮询和状态更新
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export const useTaskStore = defineStore('task', () => {
  // ==================== 状态 ====================
  const tasks = ref({}); // jobId -> taskInfo
  const pollingIntervals = ref({}); // jobId -> intervalId
  const callbacks = ref({}); // jobId -> callback function
  const taskQueue = ref([]); // 任务队列（按顺序）
  
  // ==================== Getters ====================
  const getTask = computed(() => (jobId) => tasks.value[jobId]);
  
  const getTaskStatus = computed(() => (jobId) => {
    return tasks.value[jobId]?.status || 'unknown';
  });
  
  const getTaskProgress = computed(() => (jobId) => {
    return tasks.value[jobId]?.progress || 0;
  });
  
  const getProjectTasks = computed(() => (projectId) => {
    return Object.values(tasks.value).filter(t => t.projectId === projectId);
  });
  
  const getActiveTasks = computed(() => {
    return Object.values(tasks.value).filter(
      t => ['pending', 'active', 'processing'].includes(t.status)
    );
  });
  
  // ==================== API请求 ====================
  /**
   * 获取任务状态
   */
  async function fetchTaskStatus(jobId) {
    try {
      const response = await axios.get(`${API_BASE}/api/tasks/${jobId}`);
      if (response.data.success) {
        updateTask(jobId, response.data.data);
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error(`[TaskStore] 获取任务状态失败, jobId: ${jobId}:`, error);
      return null;
    }
  }
  
  /**
   * 获取队列状态
   */
  async function fetchQueueStatus() {
    try {
      const response = await axios.get(`${API_BASE}/api/tasks/queue/status`);
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('[TaskStore] 获取队列状态失败:', error);
      return null;
    }
  }
  
  /**
   * 取消任务
   */
  async function cancelTask(jobId, userId) {
    try {
      const response = await axios.post(`${API_BASE}/api/tasks/${jobId}/cancel`, { userId });
      if (response.data.success) {
        updateTask(jobId, { status: 'cancelled' });
        stopPolling(jobId);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[TaskStore] 取消任务失败, jobId: ${jobId}:`, error);
      return false;
    }
  }
  
  /**
   * 获取用户的所有任务
   */
  async function fetchUserTasks(userId, limit = 20) {
    try {
      const response = await axios.get(`${API_BASE}/api/tasks/user/${userId}`, {
        params: { limit }
      });
      if (response.data.success) {
        // 更新本地缓存
        response.data.data.forEach(task => {
          updateTask(task.job_id, task);
        });
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('[TaskStore] 获取用户任务失败:', error);
      return [];
    }
  }
  
  /**
   * 获取项目的所有任务
   */
  async function fetchProjectTasks(projectId, limit = 50) {
    try {
      const response = await axios.get(`${API_BASE}/api/tasks/project/${projectId}`, {
        params: { limit }
      });
      if (response.data.success) {
        // 更新本地缓存
        response.data.data.forEach(task => {
          updateTask(task.job_id, task);
        });
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('[TaskStore] 获取项目任务失败:', error);
      return [];
    }
  }
  
  // ==================== 轮询管理 ====================
  /**
   * 轮询任务状态
   * @param {string} jobId - 任务ID
   * @param {function} callback - 状态更新回调
   * @param {number} interval - 轮询间隔(ms)，默认2000
   * @param {number} maxAttempts - 最大轮询次数，默认300（10分钟）
   */
  function startPolling(jobId, callback, interval = 2000, maxAttempts = 300) {
    // 如果已在轮询，先停止
    if (pollingIntervals.value[jobId]) {
      stopPolling(jobId);
    }
    
    let attempts = 0;
    const taskInfo = tasks.value[jobId] || {};
    
    // 保存回调
    if (callback) {
      callbacks.value[jobId] = callback;
    }
    
    console.log(`[TaskStore] 开始轮询任务, jobId: ${jobId}, interval: ${interval}ms`);
    
    // 立即获取一次状态
    fetchTaskStatus(jobId);
    
    // 设置轮询定时器
    const intervalId = setInterval(async () => {
      attempts++;
      
      const result = await fetchTaskStatus(jobId);
      
      // 执行回调
      if (callbacks.value[jobId] && result) {
        callbacks.value[jobId](result);
      }
      
      // 检查是否应该停止轮询
      const currentStatus = result?.status || tasks.value[jobId]?.status;
      
      if (['completed', 'failed', 'cancelled'].includes(currentStatus)) {
        console.log(`[TaskStore] 任务结束，停止轮询, jobId: ${jobId}, status: ${currentStatus}`);
        stopPolling(jobId);
        
        // 任务结束时执行最终回调
        if (callbacks.value[jobId]) {
          callbacks.value[jobId](result || tasks.value[jobId]);
        }
      }
      
      // 超过最大次数，停止轮询
      if (attempts >= maxAttempts) {
        console.warn(`[TaskStore] 轮询达到最大次数，停止, jobId: ${jobId}`);
        stopPolling(jobId);
      }
      
    }, interval);
    
    pollingIntervals.value[jobId] = intervalId;
    
    return intervalId;
  }
  
  /**
   * 停止轮询
   */
  function stopPolling(jobId) {
    if (pollingIntervals.value[jobId]) {
      clearInterval(pollingIntervals.value[jobId]);
      delete pollingIntervals.value[jobId];
    }
    if (callbacks.value[jobId]) {
      delete callbacks.value[jobId];
    }
  }
  
  /**
   * 停止所有轮询
   */
  function stopAllPolling() {
    Object.keys(pollingIntervals.value).forEach(jobId => {
      stopPolling(jobId);
    });
  }
  
  /**
   * 批量轮询多个任务
   */
  function startBatchPolling(jobIds, onUpdate, interval = 2000) {
    // 立即获取所有状态
    jobIds.forEach(jobId => fetchTaskStatus(jobId));
    
    // 设置批量轮询
    const intervalId = setInterval(async () => {
      const results = await Promise.all(
        jobIds.map(jobId => fetchTaskStatus(jobId))
      );
      
      if (onUpdate) {
        onUpdate(results.filter(Boolean));
      }
      
      // 检查是否全部结束
      const allFinished = results.every(
        r => r && ['completed', 'failed', 'cancelled'].includes(r.status)
      );
      
      if (allFinished) {
        clearInterval(intervalId);
        console.log('[TaskStore] 所有批量任务已完成');
      }
    }, interval);
    
    return intervalId;
  }
  
  // ==================== 任务管理 ====================
  /**
   * 更新任务信息
   */
  function updateTask(jobId, taskInfo) {
    const oldTask = tasks.value[jobId] || {};
    tasks.value[jobId] = {
      ...oldTask,
      ...taskInfo,
      updatedAt: new Date().toISOString()
    };
  }
  
  /**
   * 添加任务
   */
  function addTask(jobId, taskInfo) {
    tasks.value[jobId] = {
      ...taskInfo,
      jobId,
      createdAt: new Date().toISOString()
    };
    
    // 添加到队列
    if (!taskQueue.value.includes(jobId)) {
      taskQueue.value.push(jobId);
    }
  }
  
  /**
   * 移除任务
   */
  function removeTask(jobId) {
    stopPolling(jobId);
    delete tasks.value[jobId];
    taskQueue.value = taskQueue.value.filter(id => id !== jobId);
  }
  
  /**
   * 清空所有任务
   */
  function clearAllTasks() {
    stopAllPolling();
    tasks.value = {};
    taskQueue.value = [];
  }
  
  // ==================== 便捷方法 ====================
  /**
   * 提交视频生成任务并开始轮询
   */
  async function submitVideoTask(shotId, type, params, userId, callback) {
    try {
      const response = await axios.post(`${API_BASE}/api/videos/generate`, {
        shotId,
        type,
        params,
        userId
      });
      
      if (response.data.success) {
        const { jobId } = response.data;
        addTask(jobId, {
          type: 'video',
          taskType: type,
          refId: shotId,
          projectId: params.projectId,
          status: 'pending'
        });
        
        // 开始轮询
        if (callback) {
          startPolling(jobId, callback);
        }
        
        return { success: true, jobId };
      }
      
      return { success: false, error: response.data.error };
    } catch (error) {
      console.error('[TaskStore] 提交视频任务失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 提交音频生成任务并开始轮询
   */
  async function submitAudioTask(sceneId, params, userId, callback) {
    try {
      const response = await axios.post(`${API_BASE}/api/audio/tts`, {
        sceneId,
        ...params,
        userId
      });
      
      if (response.data.success) {
        const { jobId } = response.data;
        addTask(jobId, {
          type: 'audio',
          taskType: 'tts',
          refId: sceneId,
          projectId: params.projectId,
          status: 'pending'
        });
        
        if (callback) {
          startPolling(jobId, callback);
        }
        
        return { success: true, jobId };
      }
      
      return { success: false, error: response.data.error };
    } catch (error) {
      console.error('[TaskStore] 提交音频任务失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 提交导出任务并开始轮询
   */
  async function submitExportTask(projectId, params, userId, callback) {
    try {
      const response = await axios.post(`${API_BASE}/api/exports/create`, {
        projectId,
        ...params,
        userId
      });
      
      if (response.data.success) {
        const { jobId, exportId } = response.data;
        addTask(jobId, {
          type: 'export',
          taskType: 'export_mp4',
          refId: exportId,
          projectId,
          status: 'pending'
        });
        
        if (callback) {
          startPolling(jobId, callback);
        }
        
        return { success: true, jobId, exportId };
      }
      
      return { success: false, error: response.data.error };
    } catch (error) {
      console.error('[TaskStore] 提交导出任务失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 提交图片生成任务并开始轮询
   */
  async function submitImageTask(type, params, userId, callback) {
    try {
      const response = await axios.post(`${API_BASE}/api/images/generate`, {
        type,
        params,
        userId
      });
      
      if (response.data.success) {
        const { jobId } = response.data;
        addTask(jobId, {
          type: 'image',
          taskType: type,
          refId: params.refId,
          projectId: params.projectId,
          status: 'pending'
        });
        
        if (callback) {
          startPolling(jobId, callback);
        }
        
        return { success: true, jobId };
      }
      
      return { success: false, error: response.data.error };
    } catch (error) {
      console.error('[TaskStore] 提交图片任务失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ==================== 进度计算辅助 ====================
  /**
   * 计算任务总进度（多任务时）
   */
  function calculateTotalProgress(jobIds) {
    if (!jobIds || jobIds.length === 0) return 0;
    
    let totalProgress = 0;
    let count = 0;
    
    jobIds.forEach(jobId => {
      const task = tasks.value[jobId];
      if (task) {
        totalProgress += task.progress || 0;
        count++;
      }
    });
    
    return count > 0 ? Math.round(totalProgress / count) : 0;
  }
  
  /**
   * 获取任务状态文本
   */
  function getStatusText(status) {
    const statusMap = {
      pending: '等待中',
      active: '处理中',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消'
    };
    return statusMap[status] || status;
  }
  
  /**
   * 获取任务类型文本
   */
  function getTaskTypeText(taskType) {
    const typeMap = {
      text2video: '文生视频',
      image2video: '图生视频',
      reference2video: '参考生视频',
      tts: '配音生成',
      export_mp4: '视频导出',
      character_image: '角色图生成',
      shot_image: '分镜图生成'
    };
    return typeMap[taskType] || taskType;
  }
  
  // ==================== 初始化 ====================
  // 页面卸载时清理
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      stopAllPolling();
    });
  }
  
  return {
    // 状态
    tasks,
    taskQueue,
    
    // Getters
    getTask,
    getTaskStatus,
    getTaskProgress,
    getProjectTasks,
    getActiveTasks,
    
    // API请求
    fetchTaskStatus,
    fetchQueueStatus,
    fetchUserTasks,
    fetchProjectTasks,
    cancelTask,
    
    // 轮询管理
    startPolling,
    stopPolling,
    stopAllPolling,
    startBatchPolling,
    
    // 任务管理
    updateTask,
    addTask,
    removeTask,
    clearAllTasks,
    
    // 便捷方法
    submitVideoTask,
    submitAudioTask,
    submitExportTask,
    submitImageTask,
    
    // 辅助方法
    calculateTotalProgress,
    getStatusText,
    getTaskTypeText
  };
});
