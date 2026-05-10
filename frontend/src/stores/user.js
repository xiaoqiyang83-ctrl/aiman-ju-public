// ========================================
// User Store (Pinia) v3.8 功能接入版
// ========================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI, projectsAPI, userAPI } from '../api/index'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))
  const currentProject = ref(JSON.parse(localStorage.getItem('currentProject') || 'null'))
  const membership = ref({ plan_type: 'free', status: 'active' })
  const credits = ref({ balance: 0, total_earned: 0, total_spent: 0, history: [] })
  const loading = ref(false)
  const error = ref(null)
  
  // 用于组件间通信的响应式变量
  const refreshCounter = ref(0)
  const activeShot = ref(null) // 当前激活的分镜，用于在右侧面板和工作区同步
  const showShotDetailSignal = ref(0) // 触发显示详情弹窗的信号

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => userInfo.value?.username || userInfo.value?.name || '用户')
  const userId = computed(() => {
    // 优先从userInfo取
    if (userInfo.value?.id) return userInfo.value.id
    // 兜底：从JWT token解析
    try {
      const t = token.value
      if (t) {
        const payload = JSON.parse(atob(t.split('.')[1]))
        return payload.id || null
      }
    } catch (e) {}
    return null
  })
  const isVip = computed(() => userInfo.value?.is_vip || userInfo.value?.isVip || false)

  // 方法
  const setToken = (newToken) => {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
  }

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  const setCurrentProject = (project) => {
    currentProject.value = project
    if (project) {
      localStorage.setItem('currentProject', JSON.stringify(project))
    } else {
      localStorage.removeItem('currentProject')
    }
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    currentProject.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    localStorage.removeItem('currentProject')
  }

  // 登录
  const login = async (username, password) => {
    loading.value = true
    error.value = null
    try {
      const response = await authAPI.login({ username, password })
      
      if (response.success || response.token) {
        const tokenVal = response.token || response.data?.token
        const userInfoVal = {
          id: response.user?.id || response.data?.user?.id,
          username: response.user?.username || response.data?.user?.username || username,
          is_vip: response.user?.is_vip || response.data?.user?.is_vip || false
        }
        console.log('[Login] 保存用户信息:', userInfoVal)
        setToken(tokenVal)
        setUserInfo(userInfoVal)
        return { success: true }
      } else {
        throw new Error(response.message || '登录失败')
      }
    } catch (err) {
      error.value = err.message
      return { success: false, message: err.message }
    } finally {
      loading.value = false
    }
  }

  // 注册
  const register = async (username, password) => {
    loading.value = true
    error.value = null
    try {
      const response = await authAPI.register({ username, password })
      
      if (response.success || response.token) {
        setToken(response.token || response.data?.token)
        setUserInfo({
          id: response.user?.id || response.data?.user?.id,
          username: username,
          is_vip: false
        })
        return { success: true }
      } else {
        throw new Error(response.message || '注册失败')
      }
    } catch (err) {
      error.value = err.message
      return { success: false, message: err.message }
    } finally {
      loading.value = false
    }
  }

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const response = await projectsAPI.list()
      return response.data || response || []
    } catch (err) {
      error.value = err.message
      return []
    }
  }

  // 创建项目
  const createProject = async (name) => {
    try {
      const response = await projectsAPI.create({ name })
      return response.data || response
    } catch (err) {
      error.value = err.message
      return null
    }
  }

  // 删除项目
  const deleteProject = async (id) => {
    try {
      await projectsAPI.delete(id)
      return true
    } catch (err) {
      error.value = err.message
      return false
    }
  }

  const fetchMembership = async () => {
    try {
      const res = await userAPI.getMembership()
      if (res.success) {
        membership.value = res.data
      }
    } catch (err) {
      console.error('[UserStore] 获取会员失败:', err)
    }
  }

  const fetchCredits = async () => {
    try {
      const res = await userAPI.getCredits()
      if (res.success) {
        credits.value = res.data
      }
    } catch (err) {
      console.error('[UserStore] 获取积分失败:', err)
    }
  }

  return {
    // 状态
    token,
    userInfo,
    currentProject,
    membership,
    credits,
    loading,
    error,
    refreshCounter,
    activeShot,
    showShotDetailSignal,
    // 计算属性
    isLoggedIn,
    userName,
    userId,
    isVip,
    // 方法
    setToken,
    setUserInfo,
    setCurrentProject,
    logout,
    login,
    register,
    loadProjects,
    createProject,
    deleteProject,
    fetchMembership,
    fetchCredits
  }
})
