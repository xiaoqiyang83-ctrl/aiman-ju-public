<template>
  <el-aside class="sidebar" :class="{ 'is-collapsed': isCollapsed }" :style="{ width: isCollapsed ? '65px' : '240px' }">
    <!-- Logo区域 -->
    <div class="sidebar-logo" @click="toggleCollapse">
      <div class="logo-icon">
        <span class="logo-icon-text">AI</span>
      </div>
      <div v-show="!isCollapsed" class="logo-text">
        <span class="logo-title">AI漫剧制作工具</span>
        <span class="logo-subtitle">一站式AI漫剧创作平台</span>
      </div>
      <div class="collapse-btn">
        <el-icon :class="{ 'rotate-180': isCollapsed }">
          <DArrowLeft />
        </el-icon>
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
        :collapse="isCollapsed"
        @select="handleSelect"
      >
        <!-- 基础入口 -->
        <div class="menu-section">
          <div v-show="!isCollapsed" class="menu-section-title">基础入口</div>
          <el-menu-item index="workspace">
            <el-tooltip :content="isCollapsed ? '工作台' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><HomeFilled /></el-icon>
              <template #title>工作台</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="projects">
            <el-tooltip :content="isCollapsed ? '项目管理' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Folder /></el-icon>
              <template #title>项目管理</template>
            </el-tooltip>
          </el-menu-item>
        </div>

        <!-- 创作模块 -->
        <div class="menu-section">
          <div v-show="!isCollapsed" class="menu-section-title">创作模块</div>
          <el-menu-item index="script">
            <el-tooltip :content="isCollapsed ? '剧本' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Document /></el-icon>
              <template #title>剧本</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="character">
            <el-tooltip :content="isCollapsed ? '角色' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><User /></el-icon>
              <template #title>角色</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="storyboard">
            <el-tooltip :content="isCollapsed ? '分镜' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Grid /></el-icon>
              <template #title>分镜</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="video">
            <el-tooltip :content="isCollapsed ? '视频生成' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><VideoPlay /></el-icon>
              <template #title>视频生成</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="audio">
            <el-tooltip :content="isCollapsed ? '音频' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Microphone /></el-icon>
              <template #title>音频</template>
            </el-tooltip>
          </el-menu-item>
        </div>

        <!-- 资源中心 -->
        <div class="menu-section">
          <div v-show="!isCollapsed" class="menu-section-title">资源中心</div>
          <el-menu-item index="materials">
            <el-tooltip :content="isCollapsed ? '素材库' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Picture /></el-icon>
              <template #title>素材库</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="templates">
            <el-tooltip :content="isCollapsed ? '模板库' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Collection /></el-icon>
              <template #title>模板库</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="works">
            <el-tooltip :content="isCollapsed ? '我的作品' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Files /></el-icon>
              <template #title>我的作品</template>
            </el-tooltip>
          </el-menu-item>
        </div>

        <!-- 用户中心 -->
        <div class="menu-section">
          <div v-show="!isCollapsed" class="menu-section-title">用户中心</div>
          <el-menu-item index="vip">
            <el-tooltip :content="isCollapsed ? '会员中心' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><UserFilled /></el-icon>
              <template #title>会员中心</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="points">
            <el-tooltip :content="isCollapsed ? '积分充值' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Coin /></el-icon>
              <template #title>积分充值</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="history">
            <el-tooltip :content="isCollapsed ? '使用记录' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Clock /></el-icon>
              <template #title>使用记录</template>
            </el-tooltip>
          </el-menu-item>
          <el-menu-item index="settings">
            <el-tooltip :content="isCollapsed ? '设置' : ''" placement="right" :disabled="!isCollapsed">
              <el-icon><Setting /></el-icon>
              <template #title>设置</template>
            </el-tooltip>
          </el-menu-item>
        </div>
      </el-menu>
    </el-scrollbar>

    <!-- 用户信息和登出 -->
    <div class="sidebar-user">
      <div v-show="!isCollapsed" class="user-info">
        <div class="user-avatar">
          <el-icon><UserFilled /></el-icon>
        </div>
        <div class="user-details">
          <span class="user-name">{{ userName }}</span>
          <el-tag v-if="isVip" type="warning" size="small">VIP</el-tag>
        </div>
      </div>
      <el-button link type="danger" @click="handleLogout">
        <el-icon><SwitchButton /></el-icon>
      </el-button>
    </div>

    <!-- 底部存储用量 -->
    <div v-show="!isCollapsed" class="sidebar-footer">
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessageBox } from 'element-plus'
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
  DArrowLeft
} from '@element-plus/icons-vue'

const props = defineProps({
  activeModule: {
    type: String,
    default: 'workspace'
  }
})

const emit = defineEmits(['module-change', 'collapse-change'])
const router = useRouter()
const userStore = useUserStore()

// 折叠状态
const isCollapsed = ref(false)

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  emit('collapse-change', isCollapsed.value)
}

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
  transition: width 0.3s ease;
}

/* Logo区域 */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  user-select: none;
  position: relative;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #409eff 0%, #53a8ff 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-icon-text {
  color: white;
  font-size: 16px;
  font-weight: bold;
}

.logo-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.logo-title {
  color: white;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.logo-subtitle {
  color: #a0a9c4;
  font-size: 10px;
  white-space: nowrap;
}

/* 折叠按钮 */
.collapse-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606885;
  border-radius: 4px;
  transition: all 0.2s;
}

.collapse-btn:hover {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.collapse-btn .el-icon {
  transition: transform 0.3s ease;
}

.collapse-btn .rotate-180 {
  transform: rotate(180deg);
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

.sidebar-menu:not(.el-menu--collapse) {
  width: 240px;
}

.menu-section {
  padding: 8px 0;
}

.menu-section-title {
  padding: 8px 20px;
  font-size: 11px;
  color: #606885;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
  margin: 2px 8px;
  border-radius: 8px;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.08);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.2);
}

/* 折叠状态下菜单项居中 */
.sidebar-menu.el-menu--collapse :deep(.el-menu-item) {
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin: 2px auto;
  width: 48px;
  justify-content: center;
}

.sidebar-menu.el-menu--collapse :deep(.el-menu-item .el-icon) {
  margin: 0;
}

/* 用户信息 */
.sidebar-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background-color: rgba(0, 0, 0, 0.1);
}

.sidebar-user .el-button {
  margin-left: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
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
  font-size: 13px;
  font-weight: 500;
}

/* 底部存储 */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.storage-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.storage-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #a0a9c4;
  font-size: 12px;
}

.storage-text {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.storage-used {
  color: #a0a9c4;
}

.storage-total {
  color: #606885;
}
</style>
