<template>
  <div class="projects-container">
    <!-- 顶部工具栏 -->
    <div class="projects-header">
      <div class="header-left">
        <h2 class="page-title">项目管理</h2>
      </div>
      <div class="header-right">
        <el-button @click="router.push('/teams')">
          <el-icon><User /></el-icon>
          团队管理
        </el-button>
        <el-button type="warning" @click="showTemplateDialog = true">
          <el-icon><MagicStick /></el-icon>
          模板中心
        </el-button>
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建项目
        </el-button>
      </div>
    </div>

    <!-- 项目列表 -->
    <div class="projects-content">
      <div v-loading="loading" class="projects-grid">
        <el-card 
          v-for="project in projects" 
          :key="project.id"
          class="project-card"
          shadow="hover"
          @click="handleOpenProject(project)"
        >
          <div class="project-cover">
            <img v-if="project.cover_image" :src="project.cover_image" :alt="project.name" />
            <div v-else class="cover-placeholder">
              <el-icon><VideoCamera /></el-icon>
            </div>
            <div class="cover-overlay">
              <el-button type="primary" size="small">打开项目</el-button>
            </div>
          </div>
          <div class="project-info">
            <h3 class="project-name">{{ project.name }}</h3>
            <div class="team-row" v-if="project.team_name">
              <el-tag size="small" effect="plain">团队：{{ project.team_name }}</el-tag>
            </div>
            <div class="project-meta">
              <span>
                <el-icon><Document /></el-icon>
                {{ project.script_count || 0 }}个剧本
              </span>
              <span>
                <el-icon><VideoPlay /></el-icon>
                {{ project.video_count || 0 }}个视频
              </span>
            </div>
            <div class="project-footer">
              <span class="update-time">{{ formatDate(project.created_at) }}</span>
              <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, project)">
                <el-button link type="primary" @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="duplicate">复制项目</el-dropdown-item>
                    <el-dropdown-item command="team">设置团队</el-dropdown-item>
                    <el-dropdown-item command="export">导出</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </el-card>

        <!-- 新建项目卡片 -->
        <div class="project-card new-project" @click="showCreateDialog = true">
          <div class="new-project-content">
            <el-icon class="add-icon"><Plus /></el-icon>
            <span>新建项目</span>
          </div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <el-empty 
        v-if="!loading && projects.length === 0" 
        description="暂无项目，点击上方按钮创建"
      />
    </div>

    <!-- 创建项目弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建项目" width="450px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input v-model="createForm.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="可选，描述项目内容"
          />
        </el-form-item>
        <el-form-item label="团队">
          <el-select v-model="createForm.team_id" style="width: 100%" placeholder="选择团队（可选）" clearable>
            <el-option label="个人项目" :value="null" />
            <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateProject">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showTeamDialog" title="设置项目团队" width="420px">
      <el-form label-width="80px">
        <el-form-item label="项目">
          <el-input :model-value="currentTeamProject?.name || ''" disabled />
        </el-form-item>
        <el-form-item label="团队">
          <el-select v-model="teamDialogTeamId" style="width: 100%" placeholder="选择团队" clearable>
            <el-option label="个人项目" :value="null" />
            <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTeamDialog = false">取消</el-button>
        <el-button type="primary" :loading="settingTeam" @click="handleSetTeam">保存</el-button>
      </template>
    </el-dialog>

    <!-- 模板中心弹窗 -->
    <el-dialog v-model="showTemplateDialog" title="模板中心" width="900px" top="5vh">
      <div class="template-center">
        <div class="template-filter">
          <el-radio-group v-model="selectedCategory" size="default" @change="loadTemplates">
            <el-radio-button label="全部" />
            <el-radio-button label="霸道总裁" />
            <el-radio-button label="古风" />
            <el-radio-button label="校园" />
            <el-radio-button label="悬疑" />
            <el-radio-button label="玄幻" />
          </el-radio-group>
        </div>

        <div v-loading="loadingTemplates" class="template-grid">
          <el-card 
            v-for="tpl in templates" 
            :key="tpl.id"
            class="template-card"
            shadow="hover"
          >
            <div class="template-cover">
              <img v-if="tpl.cover_image" :src="getAssetUrl(tpl.cover_image)" :alt="tpl.name" />
              <div v-else class="tpl-cover-placeholder">{{ tpl.category }}</div>
              <div class="tpl-overlay">
                <el-button type="primary" @click="handleUseTemplate(tpl)">使用模板</el-button>
              </div>
            </div>
            <div class="template-info">
              <div class="tpl-name-row">
                <span class="tpl-name">{{ tpl.name }}</span>
                <el-tag size="mini" effect="plain">{{ tpl.category }}</el-tag>
              </div>
              <p class="tpl-desc">{{ tpl.description }}</p>
              <div class="tpl-footer">
                <span class="tpl-count"><el-icon><User /></el-icon> {{ tpl.use_count }}人使用</span>
                <el-tag v-if="tpl.is_official" size="mini" type="success">官方</el-tag>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-dialog>

    <!-- 重命名弹窗 -->
    <el-dialog v-model="showRenameDialog" title="重命名项目" width="450px">
      <el-form :model="renameForm" label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input v-model="renameForm.name" placeholder="请输入项目名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="handleRenameProject">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsAPI, templatesAPI, teamsAPI, getAssetUrl } from '../api/index'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, 
  Document, 
  VideoPlay, 
  MoreFilled, 
  VideoCamera,
  MagicStick,
  User 
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const projects = ref([])
const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const creating = ref(false)
const renaming = ref(false)
const currentRenameProject = ref(null)

// 模板中心相关
const showTemplateDialog = ref(false)
const loadingTemplates = ref(false)
const templates = ref([])
const selectedCategory = ref('全部')

const teams = ref([])
const loadingTeams = ref(false)

const createForm = reactive({
  name: '',
  description: '',
  team_id: null
})

const loadTemplates = async () => {
  loadingTemplates.value = true
  try {
    const res = await templatesAPI.list(selectedCategory.value)
    if (res.success) {
      templates.value = res.data
    }
  } catch (err) {
    console.error('加载模板失败:', err)
  } finally {
    loadingTemplates.value = false
  }
}

const loadTeams = async () => {
  loadingTeams.value = true
  try {
    const res = await teamsAPI.list()
    if (res.success) teams.value = res.data || []
  } catch (err) {
    console.error('加载团队失败:', err)
  } finally {
    loadingTeams.value = false
  }
}

const handleUseTemplate = async (tpl) => {
  try {
    const { value: name } = await ElMessageBox.prompt('请输入新项目名称', '从模板创建', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: `${tpl.name}_副本`,
      inputPattern: /\S+/,
      inputErrorMessage: '项目名称不能为空'
    })

    const res = await projectsAPI.createFromTemplate({
      template_id: tpl.id,
      project_name: name
    })

    if (res.success) {
      ElMessage.success('从模板创建项目成功！')
      showTemplateDialog.value = false
      await loadProjects() // 刷新项目列表
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('从模板创建失败:', err)
      ElMessage.error('创建失败')
    }
  }
}

// 监听模板弹窗打开
watch(showTemplateDialog, (val) => {
  if (val) loadTemplates()
})

const renameForm = reactive({
  name: ''
})

/**
 * 从后端响应中提取项目数组
 * 兼容多种返回格式：
 * - { success: true, data: [...] }
 * - { data: [...] }
 * - [...] (直接数组)
 * - { rows: [...] } (pg原始结果误传)
 */
function extractProjects(response) {
  if (Array.isArray(response)) return response
  if (response?.data) {
    if (Array.isArray(response.data)) return response.data
    if (response.data?.rows && Array.isArray(response.data.rows)) return response.data.rows
  }
  if (response?.rows && Array.isArray(response.rows)) return response.rows
  console.warn('[Projects] 无法解析项目列表响应:', response)
  return []
}

/**
 * 从后端响应中提取单个项目
 */
function extractProject(response) {
  if (response?.data) {
    if (response.data?.rows) return response.data.rows[0]
    return response.data
  }
  return response
}

// 加载项目列表
const loadProjects = async () => {
  loading.value = true
  try {
    const response = await projectsAPI.list()
    projects.value = extractProjects(response)
    console.log('[Projects] 加载成功, 项目数:', projects.value.length, '第一个项目:', projects.value[0])
  } catch (err) {
    console.error('[Projects] 加载失败:', err)
    ElMessage.error('加载项目失败')
  } finally {
    loading.value = false
  }
}

// 打开项目
const handleOpenProject = (project) => {
  if (!project?.id) {
    ElMessage.error('项目数据异常，缺少ID')
    return
  }
  userStore.setCurrentProject(project)
  router.push('/workspace')
}

// 创建项目
const handleCreateProject = async () => {
  if (!createForm.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  
  creating.value = true
  try {
    const response = await projectsAPI.create({ 
      name: createForm.name.trim(),
      description: createForm.description?.trim() || '',
      team_id: createForm.team_id
    })
    const newProject = extractProject(response)
    if (newProject?.id) {
      projects.value.unshift(newProject)
    } else {
      // 创建成功但没拿到完整数据，重新加载列表
      await loadProjects()
    }
    showCreateDialog.value = false
    createForm.name = ''
    createForm.description = ''
    createForm.team_id = null
    ElMessage.success('项目创建成功')
  } catch (err) {
    console.error('[Projects] 创建失败:', err)
    ElMessage.error('创建项目失败: ' + (err.response?.data?.message || err.message))
  } finally {
    creating.value = false
  }
}

// 重命名项目
const handleRenameProject = async () => {
  if (!renameForm.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  
  renaming.value = true
  try {
    await projectsAPI.update(currentRenameProject.value.id, { name: renameForm.name.trim() })
    const index = projects.value.findIndex(p => p.id === currentRenameProject.value.id)
    if (index > -1) {
      projects.value[index].name = renameForm.name.trim()
    }
    showRenameDialog.value = false
    ElMessage.success('重命名成功')
  } catch (err) {
    ElMessage.error('重命名失败')
  } finally {
    renaming.value = false
  }
}

// 操作处理
const handleCommand = (command, project) => {
  switch (command) {
    case 'rename':
      currentRenameProject.value = project
      renameForm.name = project.name
      showRenameDialog.value = true
      break
    case 'duplicate':
      handleDuplicateProject(project)
      break
    case 'team':
      openTeamDialog(project)
      break
    case 'export':
      ElMessage.info('导出项目: ' + project.name)
      break
    case 'delete':
      handleDeleteProject(project)
      break
  }
}

const showTeamDialog = ref(false)
const currentTeamProject = ref(null)
const teamDialogTeamId = ref(null)
const settingTeam = ref(false)

const openTeamDialog = async (project) => {
  currentTeamProject.value = project
  teamDialogTeamId.value = project.team_id ?? null
  showTeamDialog.value = true
  if (!teams.value.length && !loadingTeams.value) await loadTeams()
}

const handleSetTeam = async () => {
  if (!currentTeamProject.value?.id) return
  settingTeam.value = true
  try {
    const res = await projectsAPI.setTeam(currentTeamProject.value.id, teamDialogTeamId.value)
    if (res.success) {
      ElMessage.success('已更新团队关联')
      showTeamDialog.value = false
      await loadProjects()
    }
  } catch (err) {
    console.error('设置团队失败:', err)
    ElMessage.error(err.response?.data?.message || '设置失败')
  } finally {
    settingTeam.value = false
  }
}

// 复制项目
const handleDuplicateProject = async (project) => {
  try {
    const response = await projectsAPI.create({ 
      name: project.name + ' (副本)'
    })
    const newProject = extractProject(response)
    if (newProject?.id) {
      projects.value.unshift(newProject)
    } else {
      await loadProjects()
    }
    ElMessage.success('复制成功')
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

// 删除项目
const handleDeleteProject = (project) => {
  if (!project?.id) {
    ElMessage.error('项目数据异常，无法删除')
    return
  }
  
  ElMessageBox.confirm('确定要删除项目 "' + project.name + '" 吗？此操作不可恢复。', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await projectsAPI.delete(project.id)
      const index = projects.value.findIndex(p => p.id === project.id)
      if (index > -1) {
        projects.value.splice(index, 1)
      }
      ElMessage.success('删除成功')
    } catch (err) {
      ElMessage.error('删除失败: ' + (err.response?.data?.message || '未知错误'))
    }
  }).catch(() => {})
}

// 格式化日期
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

// 组件挂载时加载项目
onMounted(() => {
  loadProjects()
  loadTeams()
})
</script>

<style scoped>
.projects-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f5f7fa;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.projects-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.team-row {
  margin: 6px 0 10px;
}

/* 模板中心样式 */
.template-center {
  padding: 0 10px;
}

.template-filter {
  margin-bottom: 24px;
  text-align: center;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
  max-height: 65vh;
  overflow-y: auto;
  padding: 10px;
}

.template-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s;
  cursor: default;
}

.template-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}

.template-cover {
  position: relative;
  height: 160px;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tpl-cover-placeholder {
  font-size: 24px;
  font-weight: bold;
  color: #909399;
}

.tpl-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.template-card:hover .tpl-overlay {
  opacity: 1;
}

.template-info {
  padding: 16px;
}

.tpl-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tpl-name {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.tpl-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  height: 42px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 16px;
}

.tpl-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f0f2f5;
  padding-top: 12px;
}

.tpl-count {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.project-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.project-card:hover {
  transform: translateY(-4px);
}

.project-cover {
  position: relative;
  height: 160px;
  overflow: hidden;
  border-radius: 4px;
  background: #f0f2f5;
}

.project-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 48px;
}

.cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.project-card:hover .cover-overlay {
  opacity: 1;
}

.project-info {
  padding: 12px 0 0;
}

.project-name {
  margin: 0 0 8px;
  font-size: 15px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.project-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.update-time {
  font-size: 12px;
  color: #c0c4cc;
}

.new-project {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  border: 2px dashed #dcdfe6;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.3s;
}

.new-project:hover {
  border-color: #409eff;
}

.new-project-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #909399;
}

.add-icon {
  font-size: 32px;
}
</style>
