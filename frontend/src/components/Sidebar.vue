<template>
  <el-aside class="sidebar" :width="collapsed ? '64px' : '200px'">
    <div class="collapse-toggle" @click="collapsed = !collapsed">
      <el-icon><component :is="collapsed ? 'DArrowRight' : 'DArrowLeft'" /></el-icon>
    </div>
    <!-- Logo区域 -->
    <div class="sidebar-logo" :class="{ 'logo-collapsed': collapsed }">
      <div class="logo-icon">
        <span class="logo-icon-text">AI</span>
      </div>
      <div class="logo-text" v-show="!collapsed">
        <span class="logo-title">AI漫剧</span>
        <span class="logo-subtitle">一站式创作平台</span>
      </div>
    </div>

    <!-- 导航菜单 -->
    <el-scrollbar class="sidebar-scrollbar">
      <el-menu
        :default-active="activeModule"
        class="sidebar-menu"
        background-color="#1a1f36"
        text-color="#a0a9c4"
        active-text-color="#ffffff"
        :collapse="collapsed"
        @select="handleSelect"
      >
        <!-- 基础入口 -->
        <div class="menu-section">
          <div class="menu-section-title">基础入口</div>
          <el-menu-item index="workspace">
            <el-icon><HomeFilled /></el-icon>
            <template #title>工作台</template>
          </el-menu-item>
          <el-menu-item index="projects">
            <el-icon><Folder /></el-icon>
            <template #title>项目管理</template>
          </el-menu-item>
        </div>

        <!-- 创作模块 -->
        <div class="menu-section">
          <div class="menu-section-title">创作模块</div>
          <el-menu-item index="script">
            <el-icon><Document /></el-icon>
            <template #title>剧本</template>
          </el-menu-item>
          <el-menu-item index="character">
            <el-icon><User /></el-icon>
            <template #title>角色</template>
          </el-menu-item>
          <el-menu-item index="storyboard">
            <el-icon><Grid /></el-icon>
            <template #title>分镜</template>
          </el-menu-item>
          <el-menu-item index="video">
            <el-icon><VideoPlay /></el-icon>
            <template #title>视频生成</template>
          </el-menu-item>
          <el-menu-item index="audio">
            <el-icon><Microphone /></el-icon>
            <template #title>音频</template>
          </el-menu-item>
        </div>

        <!-- 资源中心 -->
        <div class="menu-section">
          <div class="menu-section-title">资源中心</div>
          <el-menu-item index="materials">
            <el-icon><Picture /></el-icon>
            <template #title>素材库</template>
          </el-menu-item>
          <el-menu-item index="templates">
            <el-icon><Collection /></el-icon>
            <template #title>模板库</template>
          </el-menu-item>
          <el-menu-item index="works">
            <el-icon><Files /></el-icon>
            <template #title>我的作品</template>
          </el-menu-item>
        </div>

        <!-- 用户中心 -->
        <div class="menu-section">
          <div class="menu-section-title">用户中心</div>
          <el-menu-item index="vip">
            <el-icon><UserFilled /></el-icon>
            <template #title>会员中心</template>
          </el-menu-item>
          <el-menu-item index="points">
            <el-icon><Coin /></el-icon>
            <template #title>积分充值</template>
          </el-menu-item>
          <el-menu-item index="history">
            <el-icon><Clock /></el-icon>
            <template #title>使用记录</template>
          </el-menu-item>
          <el-menu-item index="settings">
            <el-icon><Setting /></el-icon>
            <template #title>设置</template>
          </el-menu-item>
        </div>
      </el-menu>
    </el-scrollbar>

    <!-- 用户信息和登出 -->
    <div class="sidebar-user" :class="{ 'user-collapsed': collapsed }">
      <div class="user-info">
        <div class="user-avatar">
          <el-icon><UserFilled /></el-icon>
        </div>
        <div class="user-details" v-show="!collapsed">
          <span class="user-name">{{ userName }}</span>
          <el-tag v-if="isVip" type="warning" size="small">VIP</el-tag>
        </div>
      </div>
      <el-button link type="danger" @click="handleLogout">
        <el-icon><SwitchButton /></el-icon>
      </el-button>
    </div>

    <!-- 底部存储用量 -->
    <div class="sidebar-footer" v-show="!collapsed">
      <div class="storage-info">
        <div class="storage-header">
          <el-icon><Folder /></el-icon>
          <span>云端存储</span>
        </div>
        <div class="storage-progress">
          <el-progress
            :percentage="storagePercentage"
            :stroke-width="6"
            :show-text="false"
            :color="storageColor"
          />
        </div>
        <div class="storage-text">
          <span class="storage-used">{{ storageUsed }}</span>
          <span class="storage-total">/ {{ storageTotal }}</span>
        </div>
      </div>
    </div>
  </el-aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessageBox } from 'element-plus'
import { ref } from 'vue'
import {
  HomeFilled,
  Folder,
  Document,
  User,
  Grid,
  VideoPlay,
  Microphone,
  Picture,
  Collection,
  Files,
  UserFilled,
  Coin,
  Clock,
  Setting,
  SwitchButton,
  DArrowLeft,
  DArrowRight
} from '@element-plus/icons-vue'

const collapsed = ref(false)

const props = defineProps({
  activeModule: {
    type: String,
    default: 'workspace'
  }
})

const emit = defineEmits(['module-change'])
const router = useRouter()
const userStore = useUserStore()

const userName = computed(() => userStore.userName)
const isVip = computed(() => userStore.isVip)

const handleSelect = (index) => {
  // 处理路由跳转
  if (index === 'workspace') {
    router.push('/workspace')
  } else if (index === 'projects') {
    router.push('/projects')
  }
  emit('module-change', index)
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    userStore.logout()
    router.push('/login')
  }).catch(() => {})
}

// 存储信息（可从API获取）
const storageUsed = '12.8GB'
const storageTotal = '50GB'
const storagePercentage = computed(() => {
  return Math.round((12.8 / 50) * 100)
})
const storageColor = computed(() => {
  const percent = storagePercentage.value
  if (percent < 60) return '#67c23a'
  if (percent < 80) return '#e6a23c'
  return '#f56c6c'
})
</script>

<style scoped>
.sidebar {
  background-color: #1a1f36;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Logo区域 */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo-icon {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #409eff 0%, #53a8ff 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-icon-text {
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.logo-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo-title {
  color: white;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.logo-subtitle {
  color: #a0a9c4;
  font-size: 8px;
  white-space: nowrap;
}

/* 滚动条 */
.sidebar-scrollbar {
  flex: 1;
  overflow: hidden;
}

.sidebar-scrollbar :deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
  padding: 8px 0;
}

/* 菜单 */
.sidebar-menu {
  border-right: none;
}

.menu-section {
  padding: 2px 0;
}

.menu-section-title {
  padding: 4px 8px;
  font-size: 9px;
  color: #606885;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 34px;
  line-height: 34px;
  margin: 1px 4px;
  padding: 0 8px !important;
  font-size: 12px;
  border-radius: 5px;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.08);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.2);
}

/* 用户信息 */
.sidebar-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background-color: rgba(0, 0, 0, 0.1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  color: white;
  font-size: 12px;
  font-weight: 500;
}

/* 底部存储 */
.sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.storage-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.storage-header {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #a0a9c4;
  font-size: 11px;
}

.storage-text {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
}

.storage-used {
  color: #a0a9c4;
}

.storage-total {
  color: #606885;
}

/* 折叠切换按钮 */
.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  cursor: pointer;
  color: #a0a9c4;
  transition: color 0.2s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.collapse-toggle:hover {
  color: #ffffff;
}

/* Logo折叠状态 */
.sidebar-logo.logo-collapsed {
  justify-content: center;
  padding: 14px 10px;
}

/* 用户区折叠状态 */
.sidebar-user.user-collapsed {
  justify-content: center;
  padding: 10px;
}

/* 折叠时section标题隐藏 */
.sidebar :deep(.menu-section-title) {
  transition: opacity 0.2s;
}
.sidebar .el-menu--collapse :deep(.menu-section-title) {
  display: none;
}

/* transition */
.sidebar {
  transition: width 0.3s;
}
</style>
