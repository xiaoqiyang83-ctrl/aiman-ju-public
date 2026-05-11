<template>
  <div class="workspace-view">
    <!-- 创作流程进度条 -->
    <div class="workflow-progress">
      <div class="workflow-steps">
        <div 
          v-for="(step, index) in workflowSteps" 
          :key="index"
          class="workflow-step"
          :class="{ 
            active: currentStep === index,
            completed: currentStep > index 
          }"
          @click="handleStepClick(index)"
        >
          <div class="step-connector" v-if="index > 0"></div>
          <div class="step-icon">
            <el-icon v-if="currentStep > index"><Check /></el-icon>
            <component v-else :is="step.icon" />
          </div>
          <span class="step-label">{{ step.label }}</span>
          <span class="step-desc">{{ step.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="workspace-content">
      <!-- 左侧区域 -->
      <div class="workspace-left">
        <!-- 项目概览 -->
        <div class="content-card">
          <div class="card-header">
            <h2 class="card-title">
              <el-icon><FolderOpened /></el-icon>
              项目概览
            </h2>
            <el-button type="primary" size="small" @click="showCreateProject = true">
              <el-icon><Plus /></el-icon>
              新建项目
            </el-button>
          </div>

          <div class="project-overview" v-if="currentProject">
            <div class="project-cover">
              <img v-if="currentProject.cover_image" :src="currentProject.cover_image" alt="封面" />
              <div class="cover-placeholder" v-else>
                <el-icon><VideoCamera /></el-icon>
              </div>
            </div>

            <div class="project-info">
              <div class="project-header">
                <h3 class="project-name">{{ currentProject.title }}</h3>
                <el-button text size="small" @click="showEditProject = true">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
              
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{{ formatDate(currentProject.created_at) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">更新时间</span>
                  <span class="info-value">{{ formatDate(currentProject.updated_at) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">分辨率</span>
                  <span class="info-value">{{ currentProject.resolution || '1080P' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">时长</span>
                  <span class="info-value">{{ currentProject.duration || '00:00' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">帧率</span>
                  <span class="info-value">{{ currentProject.fps || '24fps' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">状态</span>
                  <span class="info-value status" :class="{ completed: currentProject.status === 'completed' }">
                    <el-icon><Clock /></el-icon>
                    {{ currentProject.status === 'completed' ? '已完成' : '制作中' }}
                  </span>
                </div>
              </div>

              <div class="progress-container">
                <div class="progress-header">
                  <span class="progress-label">项目进度</span>
                  <span class="progress-value">{{ currentProject.progress || 0 }}%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: (currentProject.progress || 0) + '%' }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div class="empty-state" v-else>
            <div class="empty-icon"><el-icon><Folder /></el-icon></div>
            <h3 class="empty-title">暂无项目</h3>
            <p class="empty-desc">创建你的第一个漫剧项目，开始创作之旅</p>
            <el-button type="primary" size="large" @click="showCreateProject = true">
              <el-icon><Plus /></el-icon>
              创建项目
            </el-button>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div class="content-card">
          <div class="card-header">
            <h2 class="card-title">
              <el-icon><Grid /></el-icon>
              快捷操作
            </h2>
          </div>

          <div class="quick-actions">
            <div class="action-btn" @click="handleQuickAction('import')">
              <div class="action-icon blue">
                <el-icon><Document /></el-icon>
              </div>
              <span class="action-label">导入剧本</span>
              <span class="action-desc">支持txt/doc文件</span>
            </div>

            <div class="action-btn" @click="handleQuickAction('ai')">
              <div class="action-icon green">
                <el-icon><MagicStick /></el-icon>
              </div>
              <span class="action-label">AI生成剧本</span>
              <span class="action-desc">智能生成内容</span>
            </div>

            <div class="action-btn" @click="handleQuickAction('character')">
              <div class="action-icon purple">
                <el-icon><User /></el-icon>
              </div>
              <span class="action-label">创建角色</span>
              <span class="action-desc">设计角色形象</span>
            </div>

            <div class="action-btn" @click="handleQuickAction('storyboard')">
              <div class="action-icon orange">
                <el-icon><Grid /></el-icon>
              </div>
              <span class="action-label">自动分镜</span>
              <span class="action-desc">AI智能拆分</span>
            </div>

            <div class="action-btn" @click="handleQuickAction('video')">
              <div class="action-icon red">
                <el-icon><VideoCamera /></el-icon>
              </div>
              <span class="action-label">生成视频</span>
              <span class="action-desc">开始生成视频</span>
            </div>

            <div class="action-btn" @click="handleQuickAction('export')">
              <div class="action-icon teal">
                <el-icon><Download /></el-icon>
              </div>
              <span class="action-label">导出视频</span>
              <span class="action-desc">导出与分享发布</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧区域 -->
      <div class="workspace-right">
        <!-- 最近项目 -->
        <div class="content-card">
          <div class="card-header">
            <h2 class="card-title">
              <el-icon><Clock /></el-icon>
              最近项目
            </h2>
            <el-button type="primary" link @click="$router.push('/projects')">
              查看全部
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>

          <div class="project-list" v-if="recentProjects.length > 0">
            <div 
              v-for="project in recentProjects" 
              :key="project.id" 
              class="project-item"
              :class="{ active: currentProject?.id === project.id }"
              @click="selectProject(project)"
            >
              <div class="project-item-cover">
                <img v-if="project.cover_image" :src="project.cover_image" alt="封面" />
                <el-icon v-else><VideoCamera /></el-icon>
              </div>
              <div class="project-item-info">
                <div class="project-item-title">{{ project.title }}</div>
                <div class="project-item-meta">
                  <span>更新于 {{ formatDate(project.updated_at) }}</span>
                  <span class="project-item-status" :class="project.status">
                    {{ project.status === 'completed' ? '已完成' : '制作中' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="empty-state small" v-else>
            <div class="empty-icon"><el-icon><Folder /></el-icon></div>
            <p class="empty-desc">还没有项目，创建一个开始吧</p>
          </div>
        </div>

        <!-- 快捷统计 -->
        <div class="content-card">
          <div class="card-header">
            <h2 class="card-title">
              <el-icon><DataLine /></el-icon>
              创作统计
            </h2>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ stats.projects }}</div>
              <div class="stat-label">项目总数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.characters }}</div>
              <div class="stat-label">角色数量</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.videos }}</div>
              <div class="stat-label">生成视频</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.credits }}</div>
              <div class="stat-label">剩余积分</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建项目对话框 -->
    <el-dialog v-model="showCreateProject" title="创建新项目" width="500px" destroy-on-close>
      <el-form ref="projectFormRef" :model="projectForm" :rules="projectRules" label-position="top">
        <el-form-item label="项目名称" prop="title">
          <el-input v-model="projectForm.title" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="项目描述" prop="description">
          <el-input 
            v-model="projectForm.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入项目描述（可选）" 
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateProject = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateProject">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectApi, characterApi, videoApi } from '../api'
import { ElMessage } from 'element-plus'
import { 
  Check, Document, User, Grid, VideoCamera, Microphone, Folder, 
  FolderOpened, Plus, Clock, MagicStick, Download, ArrowRight,
  Edit, DataLine
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const workflowSteps = [
  { label: '剧本创作', desc: '导入或AI生成', icon: Document },
  { label: '角色设定', desc: '创建角色形象', icon: User },
  { label: '分镜制作', desc: '生成分镜设计', icon: Grid },
  { label: '视频生成', desc: '生成视频镜头', icon: VideoCamera },
  { label: '音频合成', desc: '配音与音效', icon: Microphone },
  { label: '导出发布', desc: '导出与分享', icon: Download }
]

const currentStep = ref(2)
const showCreateProject = ref(false)
const showEditProject = ref(false)
const creating = ref(false)
const projectFormRef = ref(null)
const recentProjects = ref([])
const stats = ref({
  projects: 0,
  characters: 0,
  videos: 0,
  credits: 0
})

const projectForm = reactive({
  title: '',
  description: ''
})

const projectRules = {
  title: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 1, max: 100, message: '项目名称长度1-100字符', trigger: 'blur' }
  ]
}

const currentProject = computed(() => userStore.currentProject)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadProjects = async () => {
  try {
    const { projects, pagination } = await projectApi.getList({ page: 1, limit: 5 })
    recentProjects.value = projects || []
    stats.value.projects = pagination?.total || recentProjects.value.length
    
    if (recentProjects.value.length > 0 && !currentProject.value) {
      userStore.setCurrentProject(recentProjects.value[0])
    }
  } catch (error) {
    console.error('加载项目失败:', error)
  }
}

const loadStats = async () => {
  stats.value.credits = userStore.credits || 0
  
  try {
    const [charactersRes, videosRes] = await Promise.all([
      characterApi.getList({ limit: 1 }),
      videoApi.getList({ limit: 1 })
    ])
    stats.value.characters = charactersRes.pagination?.total || 0
    stats.value.videos = videosRes.pagination?.total || 0
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const selectProject = (project) => {
  userStore.setCurrentProject(project)
  ElMessage.success(`已选择项目：${project.title}`)
}

const handleStepClick = (index) => {
  const routes = ['/script', '/characters', '/storyboard', '/video', '/audio', '/works']
  if (index < routes.length) {
    router.push(routes[index])
  }
}

const handleQuickAction = (action) => {
  if (!currentProject.value && action !== 'character') {
    ElMessage.warning('请先创建或选择项目')
    return
  }
  
  switch (action) {
    case 'import':
      router.push('/script?action=import')
      break
    case 'ai':
      router.push('/script')
      break
    case 'character':
      router.push('/characters')
      break
    case 'storyboard':
      router.push('/storyboard')
      break
    case 'video':
      router.push('/video')
      break
    case 'export':
      ElMessage.info('导出功能开发中...')
      break
  }
}

const handleCreateProject = async () => {
  const valid = await projectFormRef.value?.validate().catch(() => false)
  if (!valid) return

  creating.value = true
  try {
    const res = await projectApi.create({
      title: projectForm.title,
      description: projectForm.description
    })
    userStore.setCurrentProject(res.project)
    showCreateProject.value = false
    projectForm.title = ''
    projectForm.description = ''
    ElMessage.success('项目创建成功')
    loadProjects()
  } catch (error) {
    ElMessage.error(error || '创建失败')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadProjects()
  loadStats()
})
</script>

<style scoped>
.workspace-view {
  max-width: 1400px;
  margin: 0 auto;
}

.workflow-progress {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px 28px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
}

.workflow-steps {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.workflow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  position: relative;
  cursor: pointer;
  padding: 0 6px;
}

.step-connector {
  position: absolute;
  top: 18px;
  right: -50%;
  width: 100%;
  height: 2px;
  background: #d1d5db;
  z-index: 0;
}

.workflow-step.completed .step-connector {
  background: #10b981;
}

.step-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 16px;
  z-index: 1;
  transition: all 0.3s;
  border: 2px solid #e5e7eb;
}

.workflow-step.active .step-icon {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  border-color: #3b82f6;
}

.workflow-step.completed .step-icon {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.step-label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.step-desc {
  font-size: 11px;
  color: #6b7280;
  text-align: center;
}

.workflow-step.active .step-label {
  color: #2563eb;
}

.workflow-step.completed .step-label {
  color: #059669;
}

.workspace-content {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
}

.workspace-left,
.workspace-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.project-overview {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
}

.project-cover {
  width: 100%;
  aspect-ratio: 16/10;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  color: rgba(255, 255, 255, 0.6);
  font-size: 48px;
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #999;
}

.info-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.info-value.status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
}

.info-value.status.completed {
  color: #67c23a;
}

.progress-container {
  margin-top: auto;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 13px;
  color: #666;
}

.progress-value {
  font-size: 13px;
  color: #4A90E2;
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4A90E2, #67C23A);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.content-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
}

/* 快捷操作 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  background: #f9fafb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f3f4f6;
}

.action-btn:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.action-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
}

.action-icon.blue { background: #3b82f6; }
.action-icon.green { background: #10b981; }
.action-icon.purple { background: #8b5cf6; }
.action-icon.orange { background: #f97316; }
.action-icon.red { background: #ef4444; }
.action-icon.teal { background: #06b6d4; }

.action-label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.action-desc {
  font-size: 11px;
  color: #6b7280;
}

/* 项目列表 */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f9fafb;
  border: 1px solid transparent;
}

.project-item:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.project-item.active {
  background: #dbeafe;
  border: 1px solid #3b82f6;
}

.project-item-cover {
  width: 60px;
  height: 40px;
  border-radius: 6px;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  overflow: hidden;
}

.project-item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.project-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-item-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.project-item-status {
  color: #3b82f6;
  font-weight: 500;
}

.project-item-status.completed {
  color: #059669;
}

/* 统计 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 14px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #f3f4f6;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 36px 20px;
}

.empty-state.small {
  padding: 20px;
}

.empty-icon {
  font-size: 48px;
  color: #d1d5db;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 16px;
}
</style>
