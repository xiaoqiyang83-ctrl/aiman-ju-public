<template>
  <div class="teams-container">
    <div class="teams-header">
      <div class="header-left">
        <h2 class="page-title">团队管理</h2>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showCreateTeam = true">
          <el-icon><Plus /></el-icon>
          创建团队
        </el-button>
      </div>
    </div>

    <div class="teams-content">
      <el-card v-loading="loading" class="teams-list-card">
        <div v-if="teams.length === 0" class="empty">
          <el-empty description="暂无团队，先创建一个吧" />
        </div>
        <el-table v-else :data="teams" style="width: 100%">
          <el-table-column prop="name" label="团队名称" min-width="180" />
          <el-table-column prop="my_role" label="我的角色" width="120">
            <template #default="{ row }">
              <el-tag :type="row.my_role === 'owner' ? 'success' : (row.my_role === 'admin' ? 'warning' : 'info')" size="small">
                {{ row.my_role }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="成员数" width="120">
            <template #default="{ row }">
              {{ row.members?.length || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click="openMembers(row)">成员管理</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-dialog v-model="showCreateTeam" title="创建团队" width="420px">
      <el-form label-width="90px">
        <el-form-item label="团队名称" required>
          <el-input v-model="createTeamName" placeholder="请输入团队名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateTeam = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateTeam">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="showMembersDrawer" title="成员管理" size="520px">
      <div v-if="currentTeam" class="members-panel">
        <div class="team-meta">
          <div class="team-title">{{ currentTeam.name }}</div>
          <el-tag size="small" effect="plain">我的角色：{{ currentTeam.my_role }}</el-tag>
        </div>

        <el-divider />

        <div class="invite-bar">
          <el-input v-model="inviteUsername" placeholder="输入用户名邀请" style="width: 260px" />
          <el-select v-model="inviteRole" style="width: 140px">
            <el-option label="member" value="member" />
            <el-option label="admin" value="admin" />
          </el-select>
          <el-button type="primary" :disabled="!canEditCurrentTeam" :loading="inviting" @click="handleInvite">
            邀请
          </el-button>
        </div>

        <el-table :data="currentTeam.members || []" style="width: 100%">
          <el-table-column prop="username" label="成员" min-width="160" />
          <el-table-column prop="role" label="角色" width="120">
            <template #default="{ row }">
              <el-tag :type="row.role === 'owner' ? 'success' : (row.role === 'admin' ? 'warning' : 'info')" size="small">
                {{ row.role }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="权限" width="160">
            <template #default="{ row }">
              <el-select
                v-model="row.role"
                size="small"
                style="width: 120px"
                :disabled="!canEditCurrentTeam || row.role === 'owner'"
                @change="(val) => handleChangeRole(row.user_id, val)"
              >
                <el-option label="member" value="member" />
                <el-option label="admin" value="admin" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { teamsAPI } from '../api/index'
import { Plus } from '@element-plus/icons-vue'

const loading = ref(false)
const teams = ref([])

const showCreateTeam = ref(false)
const createTeamName = ref('')
const creating = ref(false)

const showMembersDrawer = ref(false)
const currentTeam = ref(null)
const inviteUsername = ref('')
const inviteRole = ref('member')
const inviting = ref(false)

const canEditCurrentTeam = computed(() => {
  const role = currentTeam.value?.my_role
  return role === 'owner' || role === 'admin'
})

const loadTeams = async () => {
  loading.value = true
  try {
    const res = await teamsAPI.list()
    if (res.success) teams.value = res.data || []
  } catch (err) {
    console.error('加载团队失败:', err)
    ElMessage.error('加载团队失败')
  } finally {
    loading.value = false
  }
}

const handleCreateTeam = async () => {
  if (!createTeamName.value.trim()) {
    ElMessage.warning('请输入团队名称')
    return
  }
  creating.value = true
  try {
    const res = await teamsAPI.create({ name: createTeamName.value.trim() })
    if (res.success) {
      ElMessage.success('创建成功')
      showCreateTeam.value = false
      createTeamName.value = ''
      await loadTeams()
    }
  } catch (err) {
    console.error('创建团队失败:', err)
    ElMessage.error(err.response?.data?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const openMembers = (team) => {
  currentTeam.value = JSON.parse(JSON.stringify(team))
  showMembersDrawer.value = true
}

const handleInvite = async () => {
  if (!currentTeam.value?.id) return
  if (!inviteUsername.value.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  inviting.value = true
  try {
    const res = await teamsAPI.addMember(currentTeam.value.id, {
      username: inviteUsername.value.trim(),
      role: inviteRole.value
    })
    if (res.success) {
      ElMessage.success('已邀请/更新成员')
      inviteUsername.value = ''
      await loadTeams()
      const updated = teams.value.find(t => t.id === currentTeam.value.id)
      if (updated) currentTeam.value = JSON.parse(JSON.stringify(updated))
    }
  } catch (err) {
    console.error('邀请失败:', err)
    ElMessage.error(err.response?.data?.message || '邀请失败')
  } finally {
    inviting.value = false
  }
}

const handleChangeRole = async (userId, role) => {
  if (!currentTeam.value?.id) return
  try {
    const res = await teamsAPI.updateMember(currentTeam.value.id, userId, { role })
    if (res.success) {
      ElMessage.success('角色已更新')
      await loadTeams()
      const updated = teams.value.find(t => t.id === currentTeam.value.id)
      if (updated) currentTeam.value = JSON.parse(JSON.stringify(updated))
    }
  } catch (err) {
    console.error('更新角色失败:', err)
    ElMessage.error(err.response?.data?.message || '更新失败')
    await loadTeams()
    const updated = teams.value.find(t => t.id === currentTeam.value.id)
    if (updated) currentTeam.value = JSON.parse(JSON.stringify(updated))
  }
}

onMounted(() => {
  loadTeams()
})
</script>

<style scoped>
.teams-container {
  padding: 20px;
}

.teams-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.teams-list-card {
  border-radius: 10px;
}

.empty {
  padding: 20px 0;
}

.members-panel {
  padding: 6px 0;
}

.team-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.team-title {
  font-size: 16px;
  font-weight: 600;
}

.invite-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
</style>

