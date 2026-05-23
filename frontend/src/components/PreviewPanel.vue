<template>
  <el-aside class="preview-panel" width="320px">
    <el-scrollbar class="panel-scrollbar">
      <el-tabs v-model="activeTab" class="panel-tabs">
        <!-- 分镜预览 Tab -->
        <el-tab-pane name="shots">
          <template #label>
            <span class="tab-label">
              <el-icon><Grid /></el-icon>
              分镜
            </span>
          </template>
          
          <div class="panel-section">
            <div class="section-header">
              <h3 class="section-title">分镜预览</h3>
              <span class="shot-count">{{ shots.length }}个镜头</span>
            </div>
            <div v-loading="loadingShots" class="shots-grid">
              <div 
                v-for="(shot, index) in shots" 
                :key="shot.id"
                class="shot-item"
                :class="{ active: currentShotIndex === index }"
                @click="handleSelectShot(index)"
              >
                <div class="shot-thumbnail">
                  <img v-if="shot.thumbnail || shot.video_url" :src="shot.thumbnail || shot.video_url" :alt="`镜头${index + 1}`" />
                  <div v-else class="shot-placeholder">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                  <div class="shot-number">{{ index + 1 }}</div>
                  <div v-if="shot.video_status === 'completed'" class="shot-badge success">
                    <el-icon><Check /></el-icon>
                  </div>
                  <div v-else-if="shot.video_status === 'generating'" class="shot-badge loading">
                    <el-icon class="is-loading"><Loading /></el-icon>
                  </div>
                </div>
                <div class="shot-meta">
                  <el-tag size="small" type="info">{{ shot.shot_type || '中景' }}</el-tag>
                  <el-button 
                    size="small" 
                    link 
                    type="primary" 
                    @click.stop="handleShowDetail(shot)"
                  >
                    详情
                  </el-button>
                </div>
              </div>
              <div v-if="!loadingShots && shots.length === 0" class="empty-tip">
                <span>暂无分镜</span>
              </div>
            </div>
          </div>

          <!-- 视频预览区域 -->
          <div class="panel-section">
            <div class="section-header">
              <h3 class="section-title">视频预览 & 详情</h3>
            </div>
            <div class="video-preview">
              <div class="video-container">
                <video 
                  v-if="currentVideoUrl"
                  ref="videoRef"
                  :src="currentVideoUrl"
                  controls
                  :poster="currentThumbnail"
                  class="preview-video"
                />
                <div v-else class="video-placeholder">
                  <el-icon><VideoPlay /></el-icon>
                  <span>{{ currentShotId ? '视频生成中' : '选择分镜预览视频' }}</span>
                </div>
              </div>

              <!-- 镜头详情展示 -->
              <div v-if="currentShot" class="shot-details-box">
                <div class="detail-item">
                  <span class="detail-label">景别：</span>
                  <el-tag size="small" type="info">{{ currentShot.shot_type || '中景' }}</el-tag>
                  <span class="detail-label" style="margin-left: 15px">运镜：</span>
                  <el-tag size="small" type="warning">{{ currentShot.camera_movement || '固定' }}</el-tag>
                  <span class="detail-label" style="margin-left: 15px">时长：</span>
                  <span class="detail-value">{{ currentShot.duration || 3 }}秒</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">画面描述：</span>
                  <p class="detail-text">{{ currentShot.visual_description || '暂无描述' }}</p>
                </div>
                <div v-if="currentShot.dialogue" class="detail-item">
                  <span class="detail-label">台词：</span>
                  <p class="detail-text dialogue">"{{ currentShot.dialogue }}"</p>
                </div>
                <!-- 展示配音信息 -->
                <div v-if="currentShot.audio_url" class="detail-item">
                  <span class="detail-label">配音：</span>
                  <div class="voice-info">
                    <el-tag size="small" type="success">已生成</el-tag>
                    <el-button size="small" link type="primary" @click="playAudioPreview(currentShot.audio_url)">
                      <el-icon><VideoPlay /></el-icon>试听
                    </el-button>
                  </div>
                </div>
              </div>

              <div v-if="currentVideoUrl" class="video-controls">
                <div class="control-item">
                  <span class="control-label">速度</span>
                  <el-select v-model="playbackSpeed" size="small" style="width: 70px">
                    <el-option label="0.5x" :value="0.5" />
                    <el-option label="1.0x" :value="1" />
                    <el-option label="1.5x" :value="1.5" />
                    <el-option label="2.0x" :value="2" />
                  </el-select>
                </div>
                <div class="control-item">
                  <span class="control-label">音量</span>
                  <el-slider v-model="volume" :min="0" :max="1" :step="0.1" size="small" />
                </div>
              </div>
              <div class="video-actions">
                <el-button type="primary" size="small" :disabled="!currentShotId" @click="handleRegenerate">
                  <el-icon><RefreshRight /></el-icon>
                  重生成
                </el-button>
                <el-button type="success" size="small" :disabled="!currentVideoUrl" @click="handleDownload">
                  <el-icon><Download /></el-icon>
                  下载
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 角色库 Tab -->
        <el-tab-pane name="characters">
          <template #label>
            <span class="tab-label">
              <el-icon><User /></el-icon>
              角色
            </span>
          </template>
          <div class="panel-section">
            <div class="section-header">
              <h3 class="section-title">角色库</h3>
              <el-button type="primary" size="small" :icon="Plus" circle @click="handleAddCharacter" />
            </div>
            <div v-loading="loadingCharacters" class="character-list">
              <div 
                v-for="char in characters" 
                :key="char.id"
                class="character-item"
                :class="{ active: selectedCharacter?.id === char.id }"
                @click="handleSelectCharacter(char)"
              >
                <div class="char-avatar">
                  <img v-if="char.image_url || char.avatar" :src="char.image_url || char.avatar" :alt="char.name" />
                  <div v-else class="char-avatar-placeholder">
                    <el-icon><User /></el-icon>
                  </div>
                </div>
                <div class="char-info">
                  <span class="char-name">{{ char.name }}</span>
                  <el-tag v-if="char.gender" size="small" type="info">{{ char.gender }}</el-tag>
                </div>
              </div>
              <div v-if="!loadingCharacters && characters.length === 0" class="empty-tip">
                <span>暂无角色</span>
              </div>
            </div>

            <!-- 角色详情展示 -->
            <div v-if="selectedCharacter" class="character-detail-view">
              <el-divider />
              <div class="char-detail-header">
                <h4>{{ selectedCharacter.name }}</h4>
                <el-tag size="small" type="warning">{{ selectedCharacter.occupation || '普通角色' }}</el-tag>
              </div>
              <p class="char-detail-desc">{{ selectedCharacter.description || '暂无详细描述' }}</p>
              <div v-if="selectedCharacter.reference_image" class="char-reference">
                <span class="detail-label">参考图:</span>
                <img :src="selectedCharacter.reference_image" alt="参考图" />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 导出 Tab -->
        <el-tab-pane name="export">
          <template #label>
            <span class="tab-label">
              <el-icon><Download /></el-icon>
              导出
            </span>
          </template>
          <div class="panel-section">
            <div class="section-header">
              <h3 class="section-title">导出设置</h3>
            </div>
            <div class="export-settings">
              <el-form label-width="60px" label-position="left" size="small">
                <el-form-item label="格式">
                  <el-select v-model="exportSettings.format" style="width: 100%">
                    <el-option label="MP4" value="mp4" />
                    <el-option label="MOV" value="mov" />
                  </el-select>
                </el-form-item>
                <el-form-item label="分辨率">
                  <el-select v-model="exportSettings.resolution" style="width: 100%">
                    <el-option label="720p" value="720p" />
                    <el-option label="1080p" value="1080p" />
                    <el-option label="4K" value="4k" />
                  </el-select>
                </el-form-item>
                <el-form-item label="质量">
                  <el-select v-model="exportSettings.quality" style="width: 100%">
                    <el-option label="中" value="medium" />
                    <el-option label="高" value="high" />
                  </el-select>
                </el-form-item>
              </el-form>
              <el-button type="primary" class="export-btn" :loading="exporting" @click="handleExport">
                <el-icon><Download /></el-icon>
                导出视频
              </el-button>
              
              <!-- 导出历史 -->
              <div class="export-history">
                <div class="history-header">
                  <span>导出历史</span>
                </div>
                <div v-loading="loadingHistory" class="history-list">
                  <div v-for="item in exportHistory" :key="item.id" class="history-item">
                    <div class="history-info">
                      <span class="history-name">{{ item.name || '导出文件' }}</span>
                      <span class="history-time">{{ formatDate(item.created_at) }}</span>
                    </div>
                    <el-button link type="primary" size="small" @click="handleDownloadExport(item)">下载</el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-scrollbar>

  </el-aside>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { scriptsAPI, charactersAPI, scenesAPI, shotsAPI, exportsAPI, videosAPI } from '../api/index'
import { ElMessage } from 'element-plus'
import {
  User,
  Grid,
  VideoPlay,
  Check,
  Loading,
  Plus,
  RefreshRight,
  Download
} from '@element-plus/icons-vue'

const userStore = useUserStore()

// 状态控制
const activeTab = ref('shots')

// 角色数据
const characters = ref([])
const loadingCharacters = ref(false)
const selectedCharacter = ref(null)

// 分镜数据
const shots = ref([])
const loadingShots = ref(false)
const currentShotIndex = ref(-1)
const currentVideoUrl = ref('')
const currentThumbnail = ref('')
const currentShotId = ref(null)
const videoRef = ref(null)

const currentShot = computed(() => {
  if (currentShotIndex.value >= 0 && currentShotIndex.value < shots.value.length) {
    return shots.value[currentShotIndex.value]
  }
  return null
})

// 导出数据
const exportHistory = ref([])
const loadingHistory = ref(false)
const exporting = ref(false)

const exportSettings = reactive({
  format: 'mp4',
  resolution: '1080p',
  fps: 30,
  quality: 'high'
})

const playbackSpeed = ref(1)
const volume = ref(1)

/**
 * 健壮地提取数组数据，兼容多种后端返回格式
 */
function extractArray(response) {
  if (Array.isArray(response)) return response
  if (response?.data) {
    if (Array.isArray(response.data)) return response.data
    if (response.data?.rows && Array.isArray(response.data.rows)) return response.data.rows
  }
  if (response?.rows && Array.isArray(response.rows)) return response.rows
  return []
}

// 监听全局刷新信号
watch(() => userStore.refreshCounter, () => {
  loadData()
})

// 监听当前项目变化，加载数据
watch(() => userStore.currentProject, (project) => {
  if (project?.id) {
    loadData()
  } else {
    // 项目清空时清空数据
    characters.value = []
    shots.value = []
    exportHistory.value = []
    currentVideoUrl.value = ''
    currentThumbnail.value = ''
  }
}, { deep: true })

onMounted(() => {
  if (userStore.currentProject?.id) {
    loadData()
  }
})

const loadData = async () => {
  await Promise.allSettled([
    loadCharacters(),
    loadShots(),
    loadExportHistory()
  ])
}

// 加载角色列表 - 用api而不是原生fetch
const loadCharacters = async () => {
  if (!userStore.currentProject?.id) return
  
  loadingCharacters.value = true
  try {
    const scriptsResponse = await scriptsAPI.list(userStore.currentProject.id)
    const scripts = extractArray(scriptsResponse)
    
    if (scripts.length > 0) {
      const charsResponse = await charactersAPI.list(scripts[0].id)
      const allChars = extractArray(charsResponse)
      characters.value = allChars
      
      // 默认选择第一个角色
      if (allChars.length > 0 && !selectedCharacter.value) {
        selectedCharacter.value = allChars[0]
      }
    } else {
      characters.value = []
    }
  } catch (err) {
    console.error('加载角色失败:', err)
    characters.value = []
  } finally {
    loadingCharacters.value = false
  }
}

// 加载镜头列表 - 用api而不是原生fetch
const loadShots = async () => {
  if (!userStore.currentProject?.id) return
  
  loadingShots.value = true
  try {
    const scriptsResponse = await scriptsAPI.list(userStore.currentProject.id)
    const scripts = extractArray(scriptsResponse)
    
    const allShots = []
    for (const script of scripts) {
      try {
        const scenesResponse = await scenesAPI.list(script.id)
        const scenes = extractArray(scenesResponse)
        
        for (const scene of scenes) {
          try {
            const shotsResponse = await shotsAPI.list(scene.id)
            const sceneShots = extractArray(shotsResponse)
            allShots.push(...sceneShots)
          } catch (err) {
            console.error('加载镜头失败:', err)
          }
        }
      } catch (err) {
        console.error('加载场景失败:', err)
      }
    }
    
    shots.value = allShots
    
    // 如果没有镜头，清空当前预览
    if (allShots.length === 0) {
      currentShotIndex.value = -1
      currentShotId.value = null
      currentVideoUrl.value = ''
      currentThumbnail.value = ''
    } else if (currentShotIndex.value >= allShots.length) {
      // 如果当前索引越界，重置为最后一个或第一个
      handleSelectShot(0)
    } else if (currentShotIndex.value === -1) {
      // 如果有镜头且当前未选择，默认选择第一个
      handleSelectShot(0)
    }
  } catch (err) {
    console.error('加载镜头失败:', err)
    shots.value = []
  } finally {
    loadingShots.value = false
  }
}

// 加载导出历史
const loadExportHistory = async () => {
  if (!userStore.currentProject?.id) return
  
  loadingHistory.value = true
  try {
    const response = await exportsAPI.listByProject(userStore.currentProject.id)
    exportHistory.value = extractArray(response)
  } catch (err) {
    console.error('加载导出历史失败:', err)
    exportHistory.value = []
  } finally {
    loadingHistory.value = false
  }
}

// 方法
const handleAddCharacter = () => {
  ElMessage.info('请在工作区创建角色')
}

const handleSelectCharacter = (char) => {
  selectedCharacter.value = char
}

const handleSelectShot = (index) => {
  currentShotIndex.value = index
  const shot = shots.value[index]
  if (shot) {
    currentShotId.value = shot.id
    currentVideoUrl.value = shot.video_url || ''
    currentThumbnail.value = shot.thumbnail || ''
  }
}

const handleShowDetail = (shot) => {
  userStore.activeShot = shot
  userStore.showShotDetailSignal++
}

const handleRegenerate = async () => {
  if (!currentShotId.value) {
    ElMessage.warning('请先选择一个镜头')
    return
  }
  
  try {
    await videosAPI.regenerate(currentShotId.value, {})
    ElMessage.success('重新生成任务已提交')
    await loadShots()
  } catch (err) {
    ElMessage.error('重新生成失败')
  }
}

const handleDownload = async () => {
  if (!currentShotId.value) {
    ElMessage.warning('请先选择一个镜头')
    return
  }
  
  const shot = shots.value[currentShotIndex.value]
  if (shot?.video_url) {
    window.open(shot.video_url, '_blank')
  }
}

const handleExport = async () => {
  if (!userStore.currentProject?.id) {
    ElMessage.warning('请先选择一个项目')
    return
  }
  
  exporting.value = true
  try {
    await exportsAPI.createVideo({
      project_id: userStore.currentProject.id,
      format: exportSettings.format,
      resolution: exportSettings.resolution,
      fps: exportSettings.fps,
      quality: exportSettings.quality
    })
    ElMessage.success('导出任务已提交')
    await loadExportHistory()
  } catch (err) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const handleDownloadExport = async (item) => {
  if (item.file_url) {
    window.open(item.file_url, '_blank')
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 监听播放速度变化
watch(playbackSpeed, (newSpeed) => {
  if (videoRef.value) {
    videoRef.value.playbackRate = newSpeed
  }
})

// 监听音量变化
watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume
  }
})
</script>

<style scoped>
.preview-panel {
  background-color: #ffffff;
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e8e8e8;
}

.panel-scrollbar {
  flex: 1;
  height: 100%;
}

.panel-scrollbar :deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
  padding: 0;
}

.panel-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
}

.panel-tabs :deep(.el-tabs__content) {
  padding: 0;
}

.panel-tabs :deep(.el-tabs__item) {
  height: 48px;
  line-height: 48px;
  font-size: 14px;
}

.panel-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

/* 区域样式 */
.panel-section {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.shot-count {
  font-size: 12px;
  color: #909399;
}

/* 镜头详情样式 */
.shot-details-box {
  margin-top: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #edf2f7;
}

.detail-item {
  margin-bottom: 8px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #718096;
  margin-right: 8px;
}

.detail-text {
  font-size: 13px;
  color: #2d3748;
  margin: 4px 0 0 0;
  line-height: 1.5;
}

.detail-text.dialogue {
  font-style: italic;
  color: #4a5568;
  background: #fff;
  padding: 6px 10px;
  border-left: 3px solid #cbd5e0;
  border-radius: 2px;
}

/* 角色详情样式 */
.character-detail-view {
  margin-top: 20px;
}

.char-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.char-detail-header h4 {
  margin: 0;
  font-size: 16px;
  color: #1a202c;
}

.char-detail-desc {
  font-size: 13px;
  color: #4a5568;
  line-height: 1.6;
  margin-bottom: 16px;
}

.char-reference {
  margin-top: 12px;
}

.char-reference img {
  width: 100%;
  border-radius: 6px;
  margin-top: 8px;
  border: 1px solid #e2e8f0;
}

/* 角色列表 */
.character-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.character-item:hover {
  background-color: #f5f7fa;
}

.character-item.active {
  background-color: #ecf5ff;
}

.char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background-color: #f0f2f5;
}

.char-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.char-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 18px;
}

.char-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.char-name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 分镜网格 */
.shots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.shot-item {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.shot-item:hover {
  border-color: #dcdfe6;
}

.shot-item.active {
  border-color: #409eff;
}

.shot-thumbnail {
  position: relative;
  aspect-ratio: 16/9;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shot-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shot-placeholder {
  color: #c0c4cc;
  font-size: 20px;
}

.shot-number {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
}

.shot-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
}

.shot-badge.success {
  background-color: #67c23a;
}

.shot-badge.loading {
  background-color: #e6a23c;
}

.shot-meta {
  padding: 4px;
  text-align: center;
}

/* 视频预览 */
.video-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-container {
  width: 100%;
  aspect-ratio: 16/9;
  background-color: #000;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
}

.video-placeholder .el-icon {
  font-size: 32px;
  color: #999;
}

.video-controls {
  display: flex;
  gap: 16px;
  align-items: center;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.control-label {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.video-actions {
  display: flex;
  gap: 8px;
}

.video-actions .el-button {
  flex: 1;
}

/* 导出设置 */
.export-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-btn {
  width: 100%;
}

.export-history {
  margin-top: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background-color: #fafafa;
  border-radius: 4px;
  font-size: 12px;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.history-name {
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  color: #c0c4cc;
  font-size: 11px;
}

/* 空状态 */
.empty-tip {
  text-align: center;
  padding: 16px 0;
  color: #c0c4cc;
  font-size: 13px;
}
</style>
