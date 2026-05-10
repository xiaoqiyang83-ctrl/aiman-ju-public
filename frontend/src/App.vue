<template>
  <el-config-provider :locale="zhCn">
    <!-- 登录页全屏 -->
    <Login v-if="route.path === '/login'" />

    <!-- 主界面三栏布局 -->
    <el-container v-else class="app-container">
      <Sidebar 
        :active-module="currentModule" 
        @module-change="handleModuleChange"
      />
      <el-main class="main-content">
        <router-view 
          :active-tab="currentModule"
          @tab-change="handleTabChange"
        />
      </el-main>
      <PreviewPanel />
    </el-container>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from './stores/user'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import Sidebar from './components/Sidebar.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import Login from './views/Login.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const currentModule = ref('workspace')

const handleModuleChange = (module) => {
  currentModule.value = module
  if (module === 'projects') {
    router.push('/projects')
  } else {
    router.push('/workspace')
  }
}

const handleTabChange = (tab) => {
  currentModule.value = tab
}

watch(() => route.path, (newPath) => {
  if (newPath === '/projects') {
    currentModule.value = 'projects'
  } else if (newPath === '/workspace' || newPath === '/') {
    currentModule.value = 'workspace'
  }
})

onMounted(() => {
  if (!userStore.isLoggedIn && route.path !== '/login') {
    router.push('/login')
  }
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; }
#app { width: 100%; height: 100%; }
</style>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  background-color: #f5f7fa;
  overflow: hidden;
}
.main-content {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
