<template>
  <div class="member-center">
    <div class="center-header">
      <el-button link @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>返回
      </el-button>
      <h2>会员中心</h2>
    </div>

    <el-row :gutter="20">
      <!-- 左侧：账户信息 -->
      <el-col :span="8">
        <el-card class="user-info-card">
          <div class="user-profile">
            <el-avatar :size="64" :src="userStore.userInfo.avatar">{{ userStore.userName.charAt(0) }}</el-avatar>
            <h3>{{ userStore.userName }}</h3>
            <el-tag :type="userStore.membership.plan_type === 'free' ? 'info' : 'warning'">
              {{ planName }}
            </el-tag>
          </div>
          <el-divider />
          <div class="balance-info">
            <div class="info-item">
              <span class="label">可用积分</span>
              <span class="value">{{ userStore.credits.balance }}</span>
            </div>
            <el-button type="primary" class="recharge-btn" @click="showRecharge = true">立即充值</el-button>
          </div>
        </el-card>

        <el-card class="plan-card" header="套餐选择">
          <div class="plan-list">
            <div 
              v-for="plan in plans" 
              :key="plan.type" 
              class="plan-item" 
              :class="{ active: selectedPlan === plan.type }"
              @click="selectedPlan = plan.type"
            >
              <div class="plan-name">{{ plan.name }}</div>
              <div class="plan-price">¥{{ plan.price }}<span>/月</span></div>
              <ul class="plan-features">
                <li v-for="feat in plan.features" :key="feat">{{ feat }}</li>
              </ul>
            </div>
          </div>
          <el-button type="warning" class="buy-btn" long @click="handleBuyPlan">立即开通</el-button>
        </el-card>
      </el-col>

      <!-- 右侧：消费流水 -->
      <el-col :span="16">
        <el-card header="积分记录">
          <el-table :data="userStore.credits.history" stripe style="width: 100%">
            <el-table-column prop="created_at" label="时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="项目" />
            <el-table-column prop="amount" label="积分变动" width="120">
              <template #default="{ row }">
                <span :class="row.type === 'spend' ? 'spend-text' : 'earn-text'">
                  {{ row.type === 'spend' ? '-' : '+' }}{{ row.amount }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 充值弹窗 -->
    <el-dialog v-model="showRecharge" title="积分充值" width="400px">
      <div class="recharge-options">
        <div 
          v-for="opt in rechargeOptions" 
          :key="opt.credits" 
          class="recharge-opt"
          :class="{ active: selectedRecharge === opt.credits }"
          @click="selectedRecharge = opt.credits"
        >
          <div class="opt-credits">{{ opt.credits }} 积分</div>
          <div class="opt-price">¥{{ opt.price }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showRecharge = false">取消</el-button>
        <el-button type="primary" @click="handleRecharge">确认支付</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { userAPI } from '../api'

const userStore = useUserStore()
const showRecharge = ref(false)
const selectedPlan = ref('pro')
const selectedRecharge = ref(500)

const planName = computed(() => {
  const plans = { free: '普通用户', pro: 'Pro会员', enterprise: '企业版' }
  return plans[userStore.membership.plan_type] || '普通用户'
})

const plans = [
  { 
    type: 'pro', 
    name: 'Pro会员', 
    price: 99, 
    features: ['每月赠送2000积分', '优先渲染通道', '支持4K导出', '角色一致性增强']
  },
  { 
    type: 'enterprise', 
    name: '企业版', 
    price: 499, 
    features: ['不限积分使用', '独立GPU节点', '多账号协作', '专属技术支持']
  }
]

const rechargeOptions = [
  { credits: 500, price: 50 },
  { credits: 1200, price: 100 },
  { credits: 3000, price: 200 },
  { credits: 8000, price: 500 }
]

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm')

const handleRecharge = async () => {
  try {
    const res = await userAPI.recharge({ amount: selectedRecharge.value })
    if (res.success) {
      ElMessage.success('支付成功 (Mock)')
      showRecharge.value = false
      await userStore.fetchCredits()
    }
  } catch (err) {
    ElMessage.error('支付失败')
  }
}

const handleBuyPlan = async () => {
  try {
    const res = await userAPI.recharge({ plan_type: selectedPlan.value })
    if (res.success) {
      ElMessage.success('订阅成功 (Mock)')
      await userStore.fetchMembership()
    }
  } catch (err) {
    ElMessage.error('购买失败')
  }
}

onMounted(() => {
  userStore.fetchMembership()
  userStore.fetchCredits()
})
</script>

<style scoped>
.member-center {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.center-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.user-info-card {
  text-align: center;
  margin-bottom: 20px;
}

.user-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.balance-info {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item .value {
  font-size: 24px;
  font-weight: bold;
  color: #e6a23c;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.plan-item {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.plan-item.active {
  border-color: #e6a23c;
  background: #fdf6ec;
}

.plan-name {
  font-weight: bold;
  margin-bottom: 10px;
}

.plan-price {
  font-size: 20px;
  color: #f56c6c;
  margin-bottom: 10px;
}

.plan-price span {
  font-size: 14px;
  color: #909399;
}

.plan-features {
  padding-left: 20px;
  font-size: 13px;
  color: #606266;
}

.recharge-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.recharge-opt {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.recharge-opt.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.opt-credits {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 5px;
}

.opt-price {
  color: #f56c6c;
}

.spend-text { color: #f56c6c; }
.earn-text { color: #67c23a; }

.buy-btn, .recharge-btn {
  width: 100%;
}
</style>
