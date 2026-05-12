// ========================================
// API 统一封装 v3.8 功能接入版 (修订)
// ========================================
import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 自动带token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一提取data
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录')
          localStorage.clear()
          window.location.href = '/login'
          break
        case 403:
          ElMessage.error('没有权限访问')
          break
        case 404:
          // 404不弹全局提示，让调用方自己处理
          break
        case 500:
          ElMessage.error('服务器错误')
          break
        default:
          ElMessage.error(data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

// ==================== 认证相关 ====================
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
}

// ==================== 项目相关 ====================
export const projectsAPI = {
  list: () => api.get('/projects'),
  get: (id) => api.get('/projects/' + id),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put('/projects/' + id, data),
  delete: (id) => api.delete('/projects/' + id),
  setTeam: (id, teamId) => api.put('/projects/' + id + '/team', { team_id: teamId }),
  autoGenerate: (id) => api.post('/projects/' + id + '/auto-generate'),
  createFromTemplate: (data) => api.post('/projects/from-template', data)
}

// ==================== 团队相关 ====================
export const teamsAPI = {
  list: () => api.get('/teams'),
  create: (data) => api.post('/teams', data),
  addMember: (teamId, data) => api.post('/teams/' + teamId + '/members', data),
  updateMember: (teamId, userId, data) => api.put('/teams/' + teamId + '/members/' + userId, data)
}

// ==================== 模板相关 ====================
export const templatesAPI = {
  list: (category) => api.get('/templates' + (category ? '?category=' + category : '')),
  get: (id) => api.get('/templates/' + id)
}

// ==================== 剧本相关 ====================
export const scriptsAPI = {
  list: (projectId) => api.get('/scripts?project_id=' + projectId),
  get: (id) => api.get('/scripts/' + id),
  upload: (formData) => api.post('/scripts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, data) => api.put('/scripts/' + id, data),
  delete: (id) => api.delete('/scripts/' + id)
}

// ==================== 角色相关 ====================
export const charactersAPI = {
  list: (scriptId) => api.get('/characters?script_id=' + scriptId),
  get: (id) => api.get('/characters/' + id),
  create: (data) => api.post('/characters', data),
  update: (id, data) => api.put('/characters/' + id, data),
  delete: (id) => api.delete('/characters/' + id),
  aiGenerate: (id, data) => api.post('/characters/' + id + '/ai-generate', data),
  // v5.0 角色一致性系统
  calibrate: (id) => api.post('/characters/' + id + '/calibrate'),
  compilePrompt: (id, data) => api.post('/characters/' + id + '/compile-prompt', data),
  // 变体CRUD
  listVariations: (characterId) => api.get('/characters/' + characterId + '/variations'),
  createVariation: (characterId, data) => api.post('/characters/' + characterId + '/variations', data),
  updateVariation: (id, data) => api.put('/characters/' + characterId + '/variations/' + id, data),
  deleteVariation: (id) => api.delete('/characters/' + characterId + '/variations/' + id),
  // v5.0 CogView生图
  generateImage: (id, data) => api.post('/characters/' + id + '/generate-image', data)
}

// ==================== 场景相关 ====================
export const scenesAPI = {
  list: (scriptId) => api.get('/scenes?script_id=' + scriptId),
  generate: (scriptId) => api.post('/scenes/generate?script_id=' + scriptId),
  update: (id, data) => api.put('/scenes/' + id, data),
  delete: (id) => api.delete('/scenes/' + id),
  generateImage: (sceneId, data) => api.post('/scenes/' + sceneId + '/generate-image', data)
}

// ==================== 镜头相关 ====================
export const shotsAPI = {
  list: (sceneId) => api.get('/shots?scene_id=' + sceneId),
  get: (id) => api.get('/shots/' + id),
  create: (data) => api.post('/shots', data),
  update: (id, data) => api.put('/shots/' + id, data),
  delete: (id) => api.delete('/shots/' + id),
  lipSync: (id) => api.post('/shots/' + id + '/lip-sync')
}

// ==================== 视频相关 ====================
export const videosAPI = {
  // 原有API（兼容旧版）
  text2video: (shotId, data) => api.post('/videos/text2video/' + shotId, data),
  image2video: (shotId, data) => api.post('/videos/image2video/' + shotId, data),
  reference2video: (shotId, data) => api.post('/videos/reference2video/' + shotId, data),
  regenerate: (shotId, data) => api.post('/videos/regenerate/' + shotId, data),
  merge: (data) => api.post('/videos/merge', data),

  // CogVideoX视频生成API（新增）
  // 通用视频生成
  generate: (data) => api.post('/videos/generate', data),
  // 分镜生视频（图生视频）
  generateShot: (shotId, data) => api.post('/videos/generate-shot/' + shotId, data),
  // 查询任务状态（轮询）
  getTaskStatus: (taskId) => api.get('/videos/task/' + taskId),
  // 批量生视频
  batchGenerate: (data) => api.post('/videos/batch-generate', data),
  // 获取支持的模型列表
  getModels: () => api.get('/videos/models'),
  // 测试API连接
  test: () => api.get('/videos/test')
}

// ==================== 音频相关 ====================
export const audioAPI = {
  getVoices: () => api.get('/audio/voices'),
  getBGMPresets: () => api.get('/audio/bgm-presets'),
  getSFXPresets: () => api.get('/audio/sfx-presets'),
  applyBgm: (data) => api.post('/audio/apply-bgm', data),
  applySfx: (data) => api.post('/audio/apply-sfx', data),
  generateVoice: (data) => api.post('/audio/generate-voice', data),
  // 音频资产库
  getLibrary: (projectId) => api.get('/audio/library' + (projectId ? '?project_id=' + projectId : '')),
  upload: (formData) => api.post('/audio/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete('/audio/' + id)
}

// ==================== 图像生成相关 ====================
export const imagesAPI = {
  // 通用生图（直接传prompt）
  generate: (data) => api.post('/images/generate', data),
  // 生成分镜图片
  generateShot: (shotId, data) => api.post('/images/generate-shot/' + shotId, data),
  // 生成角色图片（通过统一images路由）
  generateCharacter: (characterId, data) => api.post('/images/generate-character/' + characterId, data),
  // 测试API连接
  test: () => api.get('/images/test'),
  // 获取支持的模型
  getModels: () => api.get('/images/models')
}

// ==================== 导出相关 ====================
export const exportsAPI = {
  listByProject: (projectId) => api.get('/exports/project/' + projectId + '/list'),
  create: (data) => api.post('/exports', data),
  createVideo: (data) => api.post('/exports/video', data),
  createPDF: (data) => api.post('/exports/pdf', data),
  getStatus: (exportId) => api.get('/exports/' + exportId + '/status'),
  delete: (exportId) => api.delete('/exports/' + exportId)
}

// ==================== 版本相关 ====================
export const versionsAPI = {
  listByProject: (projectId) => api.get('/project_versions/project/' + projectId),
  create: (data) => api.post('/project_versions', data),
  get: (id) => api.get('/project_versions/' + id),
  delete: (id) => api.delete('/project_versions/' + id)
}

// ==================== 用户/积分相关 ====================
export const userAPI = {
  getMembership: () => api.get('/user/membership'),
  getCredits: () => api.get('/user/credits'),
  deductCredits: (data) => api.post('/user/credits/deduct', data),
  recharge: (data) => api.post('/user/credits/recharge', data)
}

// ==================== 任务相关 ====================
export const taskJobsAPI = {
  list: (projectId, status) => {
    let url = '/task_jobs'
    const params = []
    if (projectId) params.push('project_id=' + projectId)
    if (status) params.push('status=' + status)
    if (params.length) url += '?' + params.join('&')
    return api.get(url)
  },
  get: (jobId) => api.get('/task_jobs/' + jobId),
  cancel: (jobId) => api.post('/task_jobs/' + jobId + '/cancel')
}

// 导出基础URL，方便拼接静态资源地址
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * 获取资产完整URL (自动补全后端域名)
 */
export const getAssetUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url
  const base = BASE_URL.replace(/\/api$/, '') // 移除结尾的 /api
  return base + (url.startsWith('/') ? '' : '/') + url
}

// ==================== TTS配音相关 ====================
export const ttsAPI = {
  // 获取可用音色列表
  getVoices: (gender) => api.get('/tts/voices' + (gender ? '?gender=' + gender : '')),
  // 获取音色详情
  getVoiceDetail: (voiceId) => api.get('/tts/voice/' + voiceId),
  // 获取支持的情感风格列表
  getEmotions: () => api.get('/tts/emotions'),
  // 生成单个镜头配音
  generate: (data) => api.post('/tts/generate', data),
  // 批量生成配音
  generateBatch: (data) => api.post('/tts/generate-batch', data),
  // 预览配音（不保存）
  preview: (data) => api.post('/tts/preview', data),
  // 文本转音频
  textToAudio: (data) => api.post('/tts/text-to-audio', data),
  // 删除镜头配音
  remove: (shotId) => api.delete('/tts/' + shotId),
  // 获取剧本下所有镜头的配音状态
  getStatus: (scriptId) => api.get('/tts/status/' + scriptId),
  // 更新角色默认音色
  updateCharacterVoice: (data) => api.put('/tts/character-voice', data)
}

export default api
