<template>
  <div class="dashboard">
    <div class="page-header">
      <div class="welcome-section">
        <h2 class="welcome-title">欢迎使用</h2>
        <p class="welcome-subtitle">360度评价管理系统</p>
      </div>
      <div class="period-info">
        <el-tag type="primary" size="large">
          {{ currentYear }}年 第{{ currentQuarter }}季度
        </el-tag>
      </div>
    </div>

    <div class="dashboard-content">
      <div class="stats-cards" v-if="currentUser.role === 'admin'">
        <div class="stat-card">
          <div class="stat-icon">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalUsers }}</div>
            <div class="stat-label">总用户数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalTasks }}</div>
            <div class="stat-label">评价任务数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.completedTasks }}</div>
            <div class="stat-label">已完成数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.pendingTasks }}</div>
            <div class="stat-label">待填写数</div>
          </div>
        </div>
      </div>

      <div class="progress-section" v-if="currentUser.role === 'admin'">
        <div class="section-card">
          <h3 class="section-title">
            <el-icon><DataLine /></el-icon>
            本季度评价进度
          </h3>
          <div class="progress-content">
            <div class="progress-ring-wrapper">
              <svg class="progress-ring" viewBox="0 0 100 100">
                <circle
                  class="progress-ring-bg"
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#f0ede6"
                  stroke-width="8"
                />
                <circle
                  class="progress-ring-fill"
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--color-primary)"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="progressOffset"
                />
              </svg>
              <div class="progress-percent">{{ progressPercent }}%</div>
            </div>
            <div class="progress-stats">
              <div class="progress-stat">
                <span class="dot done"></span>
                <span class="label">已完成</span>
                <span class="value">{{ progressData.completed }}人</span>
              </div>
              <div class="progress-stat">
                <span class="dot in-progress"></span>
                <span class="label">进行中</span>
                <span class="value">{{ progressData.inProgress }}人</span>
              </div>
              <div class="progress-stat">
                <span class="dot not-started"></span>
                <span class="label">未开始</span>
                <span class="value">{{ progressData.notStarted }}人</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="pending-section" v-if="myPendingTasks.length > 0">
        <div class="section-card">
          <h3 class="section-title">
            <el-icon><Bell /></el-icon>
            待我完成
            <el-badge :value="myPendingTasks.length" class="badge-gold" />
          </h3>
          <div class="pending-list">
            <div
              class="pending-item"
              v-for="task in displayedPendingTasks"
              :key="task.id"
            >
              <span class="pending-name">{{ task.target_name }}</span>
              <span class="pending-type">{{ evalTypeName(task.eval_type) }}</span>
              <el-button
                class="btn-fill"
                size="small"
                @click="goFill(task.id)"
              >
                去填写
              </el-button>
            </div>
            <div class="pending-more" v-if="myPendingTasks.length > 3">
              <el-button link @click="router.push('/tasks?status=pending')">
                查看全部{{ myPendingTasks.length }}条
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="quick-actions" v-if="currentUser.role === 'admin'">
        <div class="section-header">
          <h3 class="section-title">
            <el-icon><Tools /></el-icon>
            快捷操作
          </h3>
        </div>
        <div class="action-grid">
          <div class="action-card" @click="openCreateModal">
            <div class="action-icon">
              <el-icon><Plus /></el-icon>
            </div>
            <span>新建任务</span>
          </div>
          <div class="action-card" @click="router.push('/users')">
            <div class="action-icon">
              <el-icon><UserFilled /></el-icon>
            </div>
            <span>添加用户</span>
          </div>
          <div class="action-card" @click="router.push('/summary')">
            <div class="action-icon">
              <el-icon><DataLine /></el-icon>
            </div>
            <span>查看报表</span>
          </div>
          <div class="action-card" @click="handleExport">
            <div class="action-icon">
              <el-icon><Download /></el-icon>
            </div>
            <span>导出数据</span>
          </div>
        </div>
      </div>

      <div class="quick-actions" v-else>
        <div class="section-header">
          <h3 class="section-title">
            <el-icon><Tools /></el-icon>
            快捷操作
          </h3>
        </div>
        <div class="action-grid action-grid-3">
          <div class="action-card" @click="router.push('/summary')">
            <div class="action-icon">
              <el-icon><DataLine /></el-icon>
            </div>
            <span>我的得分</span>
          </div>
          <div class="action-card" @click="router.push('/tasks?status=pending')">
            <div class="action-icon">
              <el-icon><Edit /></el-icon>
            </div>
            <span>待填评价</span>
          </div>
          <div class="action-card" @click="handleLogout">
            <div class="action-icon">
              <el-icon><SwitchButton /></el-icon>
            </div>
            <span>退出登录</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌面端 el-dialog -->
    <el-dialog
      v-if="!isMobile"
      v-model="showCreateModal"
      title="新建评价任务"
      width="580px"
      :max-width="580"
      destroy-on-close
      class="task-dialog"
      :show-close="false"
    >
      <template #header="{ close }">
        <div class="dialog-header">
          <span class="dialog-title">新建评价任务</span>
          <button class="dialog-close" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>
      <DialogContent
        :period="currentPeriod"
        :task-form="taskForm"
        :employee-list="employeeList"
        :leader-list="leaderList"
        :question-banks="questionBanks"
        :role-tag-type="roleTagType"
        :role-name="roleName"
        @change-eval-type="handleEvalTypeChange"
      />
      <template #footer>
        <DialogFooter
          :disabled="!isFormValid"
          @cancel="showCreateModal = false"
          @confirm="handleCreateTask"
        />
      </template>
    </el-dialog>

    <!-- 手机端 BottomSheet -->
    <BottomSheet
      v-if="isMobile"
      v-model="showCreateModal"
      title="新建评价任务"
    >
      <DialogContent
        :period="currentPeriod"
        :task-form="taskForm"
        :employee-list="employeeList"
        :leader-list="leaderList"
        :question-banks="questionBanks"
        :role-tag-type="roleTagType"
        :role-name="roleName"
        @change-eval-type="handleEvalTypeChange"
      />
      <template #footer>
        <DialogFooter
          :disabled="!isFormValid"
          @cancel="showCreateModal = false"
          @confirm="handleCreateTask"
        />
      </template>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Tools, Plus, UserFilled, DataLine, Download,
  User, Document, CircleCheck, Clock, Bell, Edit, SwitchButton,
  Close
} from '@element-plus/icons-vue'
import { supabase, api, getCurrentUser, apiCache } from '../supabase'
import BottomSheet from '@/components/BottomSheet.vue'
import DialogContent from '@/components/DialogContent.vue'
import DialogFooter from '@/components/DialogFooter.vue'

const router = useRouter()
const currentUser = ref({})

const currentPeriod = ref({ year: 0, quarter: 0 })
const currentYear = computed(() => currentPeriod.value.year)
const currentQuarter = computed(() => currentPeriod.value.quarter)

const stats = reactive({
  totalUsers: 0,
  totalTasks: 0,
  completedTasks: 0,
  pendingTasks: 0
})

const progressData = reactive({
  completed: 0,
  inProgress: 0,
  notStarted: 0
})

const myPendingTasks = ref([])

const displayedPendingTasks = computed(() => myPendingTasks.value.slice(0, 3))

const isMobile = ref(false)
const showCreateModal = ref(false)
const taskForm = reactive({
  eval_type: 'self',
  bank_id: '',
  self: { target_ids: [] },
  peer: { reviewer_id: '', target_ids: [] },
  leader: { reviewer_id: '', target_ids: [] }
})
const employeeList = ref([])
const leaderList = ref([])
const questionBanks = ref([])


const circumference = 2 * Math.PI * 42

const progressPercent = computed(() => {
  const total = progressData.completed + progressData.inProgress + progressData.notStarted
  if (total === 0) return 0
  return Math.round((progressData.completed / total) * 100)
})

const progressOffset = computed(() => {
  return circumference - (progressPercent.value / 100) * circumference
})

const evalTypeName = (type) => {
  const typeMap = {
    'self': '自评',
    'peer': '互评',
    'leader': '领导评'
  }
  return typeMap[type] || type
}

const goFill = (taskId) => {
  router.push(`/evaluation/${taskId}`)
}

const loadStats = async () => {
  try {
    const users = await api.getUsers()
    stats.totalUsers = users?.length || 0

    const period = await api.getCurrentPeriod()
    const tasks = await api.getTasks({ period })

    stats.totalTasks = tasks?.length || 0

    // 已完成任务数（直接统计任务）
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const savedTasks = tasks.filter(t => t.status === 'saved').length
    const pendingTasksCount = tasks.filter(t => t.status === 'pending').length

    stats.completedTasks = completedTasks
    stats.pendingTasks = pendingTasksCount + savedTasks

    // 按评价类型统计
    const selfTasks = tasks.filter(t => t.eval_type === 'self')
    const peerTasks = tasks.filter(t => t.eval_type === 'peer')
    const leaderTasks = tasks.filter(t => t.eval_type === 'leader')

    // 按被评价人分组统计
    const targetStats = {}
    tasks.forEach(task => {
      const tid = task.target_user_id
      if (!targetStats[tid]) {
        targetStats[tid] = { self: null, peer: null, leader: null }
      }
      if (task.status === 'completed') {
        if (task.eval_type === 'self') targetStats[tid].self = 'completed'
        if (task.eval_type === 'peer') targetStats[tid].peer = 'completed'
        if (task.eval_type === 'leader') targetStats[tid].leader = 'completed'
      } else if (task.status === 'saved') {
        if (task.eval_type === 'self' && targetStats[tid].self !== 'completed') targetStats[tid].self = 'saved'
        if (task.eval_type === 'peer' && targetStats[tid].peer !== 'completed') targetStats[tid].peer = 'saved'
        if (task.eval_type === 'leader' && targetStats[tid].leader !== 'completed') targetStats[tid].leader = 'saved'
      } else {
        if (task.eval_type === 'self' && targetStats[tid].self === null) targetStats[tid].self = 'pending'
        if (task.eval_type === 'peer' && targetStats[tid].peer === null) targetStats[tid].peer = 'pending'
        if (task.eval_type === 'leader' && targetStats[tid].leader === null) targetStats[tid].leader = 'pending'
      }
    })

    // 统计完成状态的人数
    let completedReviewers = 0
    let inProgressReviewers = 0
    let notStartedReviewers = 0

    Object.values(targetStats).forEach(stat => {
      // 已完成：领导已完成 + 所有员工他评已完成 + 自评已完成
      if (stat.leader === 'completed' && stat.self === 'completed' && stat.peer === 'completed') {
        completedReviewers++
      } else if (stat.self === 'pending' || stat.peer === 'pending' || stat.leader === 'pending' ||
                 stat.self === 'saved' || stat.peer === 'saved' || stat.leader === 'saved') {
        // 有暂存或待填写的归类为进行中
        inProgressReviewers++
      } else {
        notStartedReviewers++
      }
    })

    progressData.completed = completedReviewers
    progressData.inProgress = inProgressReviewers
    progressData.notStarted = notStartedReviewers
  } catch (err) {
    console.error('加载统计数据失败:', err)
  }
}

const loadMyPendingTasks = async () => {
  try {
    const user = await getCurrentUser()
    if (!user) return

    const period = await api.getCurrentPeriod()
    const tasks = await api.getTasks({ period })
    myPendingTasks.value = tasks
      .filter(t => t.reviewer_user_id === user.id && (t.status === 'pending' || t.status === 'saved'))
  } catch (err) {
    console.error('加载待完成任务失败:', err)
  }
}

const handleExport = async () => {
  try {
    const period = await api.getCurrentPeriod()
    const json = await api.exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `360评价数据_${period.year}Q${period.quarter}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('数据导出成功')
  } catch (err) {
    ElMessage.error(err.message || '导出失败')
  }
}

const handleLogout = async () => {
  try {
    await supabase.auth.signOut()
    router.push('/login')
  } catch (err) {
    ElMessage.error(err.message || '退出失败')
  }
}

onMounted(async () => {
  const user = await getCurrentUser()
  currentUser.value = user || {}

  isMobile.value = window.innerWidth <= 768
  window.addEventListener('resize', handleResize)

  const p = await api.getCurrentPeriod()
  currentPeriod.value = p

  if (currentUser.value.role === 'admin') {
    await loadStats()
    await loadEmployeeAndLeaderList()
  }
  await loadMyPendingTasks()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

const loadEmployeeAndLeaderList = async () => {
  try {
    const users = await api.getUsers()
    employeeList.value = users.filter(u => u.role === 'employee' || u.role === 'leader')
    leaderList.value = users.filter(u => u.role === 'leader' || u.role === 'admin')
  } catch (err) {
    console.error('加载用户列表失败:', err)
  }
}

const isFormValid = computed(() => {
  if (!taskForm.eval_type) return false
  if (taskForm.eval_type === 'self') {
    return taskForm.self.target_ids.length > 0
  }
  if (taskForm.eval_type === 'peer') {
    return !!taskForm.peer.reviewer_id && taskForm.peer.target_ids.length > 0
  }
  if (taskForm.eval_type === 'leader') {
    return !!taskForm.leader.reviewer_id && taskForm.leader.target_ids.length > 0
  }
  return false
})

const roleTagType = (role) => {
  const map = { admin: 'danger', leader: 'warning', employee: 'success' }
  return map[role] || 'info'
}

const roleName = (role) => {
  const map = { admin: '管理员', leader: '领导', employee: '员工', guest: '访客' }
  return map[role] || role
}

const handleEvalTypeChange = () => {
  taskForm.self.target_ids = []
  taskForm.peer.reviewer_id = ''
  taskForm.peer.target_ids = []
  taskForm.leader.reviewer_id = ''
  taskForm.leader.target_ids = []
}

const handleCreateTask = async () => {
  try {
    const bankId = taskForm.bank_id || null
    if (taskForm.eval_type === 'self') {
      for (const targetId of taskForm.self.target_ids) {
        await api.createTask(targetId, 'self', [targetId], bankId)
      }
    } else if (taskForm.eval_type === 'peer') {
      for (const targetId of taskForm.peer.target_ids) {
        await api.createTask(targetId, 'peer', [taskForm.peer.reviewer_id], bankId)
      }
    } else if (taskForm.eval_type === 'leader') {
      for (const targetId of taskForm.leader.target_ids) {
        await api.createTask(targetId, 'leader', [taskForm.leader.reviewer_id], bankId)
      }
    }

    const count = taskForm.eval_type === 'self' ? taskForm.self.target_ids.length
      : taskForm.eval_type === 'peer' ? taskForm.peer.target_ids.length
      : taskForm.leader.target_ids.length
    ElMessage.success(`成功创建 ${count} 个任务`)
    showCreateModal.value = false
    apiCache.clear('getTasks')
    await loadStats()
  } catch (err) {
    ElMessage.error(err.message || '创建任务失败')
  }
}

watch(showCreateModal, (newVal) => {
  if (newVal) {
    taskForm.eval_type = 'self'
    taskForm.bank_id = ''
    taskForm.self.target_ids = []
    taskForm.peer.reviewer_id = ''
    taskForm.peer.target_ids = []
    taskForm.leader.reviewer_id = ''
    taskForm.leader.target_ids = []
  }
})

const openCreateModal = async () => {
  try {
    const users = await api.getUsers()
    employeeList.value = users.filter(u => u.role === 'employee' || u.role === 'leader')
    leaderList.value = users.filter(u => u.role === 'leader' || u.role === 'admin')
    questionBanks.value = await api.getQuestionBanks()
  } catch (err) {
    console.error('加载数据失败:', err)
  }

  showCreateModal.value = true
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--padding-lg);
  flex-wrap: wrap;
  gap: var(--padding-md);
}

.welcome-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  font-family: var(--font-serif);
}

.welcome-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin: var(--padding-xs) 0 0;
}

.period-info {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: var(--padding-lg);
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--gap-card);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--padding-lg);
  background: white;
  border-radius: var(--border-radius);
  padding: var(--padding-lg);
  box-shadow: var(--shadow-sm);
  min-height: 90px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-md);
  flex-shrink: 0;
}

.stat-icon.success {
  background: var(--color-success-light);
  color: var(--color-success);
}

.stat-icon.warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-number {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.section-card {
  background: white;
  border-radius: var(--border-radius);
  padding: var(--padding-lg);
  box-shadow: var(--shadow-sm);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--padding-md);
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.badge-gold :deep(.el-badge__content) {
  background: var(--color-primary);
}

.progress-content {
  display: flex;
  align-items: center;
  gap: var(--padding-xl);
}

.progress-ring-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.progress-ring {
  transform: rotate(-90deg);
  width: 100px;
  height: 100px;
}

.progress-ring-fill {
  transition: stroke-dashoffset 0.6s ease;
}

.progress-percent {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--color-primary);
}

.progress-stats {
  display: flex;
  flex-direction: column;
  gap: var(--padding-sm);
}

.progress-stat {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.done {
  background: #4a9e8c;
}

.dot.in-progress {
  background: var(--color-warning);
}

.dot.not-started {
  background: #e0ddd6;
}

.progress-stat .label {
  font-size: 14px;
  color: var(--text-secondary);
  flex: 1;
}

.progress-stat .value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: var(--padding-sm);
}

.pending-item {
  display: flex;
  align-items: center;
  gap: var(--padding-md);
  padding: var(--padding-sm) 0;
  border-bottom: 1px solid var(--border-color);
}

.pending-item:last-child {
  border-bottom: none;
}

.pending-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
}

.pending-type {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  background: var(--info-bg);
  padding: 2px 8px;
  border-radius: var(--border-radius-sm);
}

.btn-fill {
  background: var(--color-primary) !important;
  color: white !important;
  border: none !important;
  font-size: var(--font-xs);
  padding: 4px 12px;
}

.quick-actions {
  background: white;
  border-radius: var(--border-radius);
  padding: var(--padding-lg);
  box-shadow: var(--shadow-sm);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--gap-card);
}

.action-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--padding-sm);
  padding: var(--padding-lg);
  background: var(--info-bg);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-card:hover {
  background: var(--border-color);
  transform: translateY(-2px);
}

.action-card:active {
  transform: scale(0.95);
}

.action-icon {
  width: 48px;
  height: 48px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-lg);
}

.action-card span {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .action-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-sm);
  }

  .action-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .action-card {
    padding: var(--space-md);
  }

  .action-icon {
    width: 36px;
    height: 36px;
    font-size: var(--font-md);
  }

  .action-card span {
    font-size: 10px;
    text-align: center;
    line-height: 1.2;
  }
}

@media (min-width: 769px) {
  .stats-cards {
    grid-template-columns: repeat(4, 1fr);
  }

  .stat-card {
    flex-direction: column;
    text-align: center;
    padding: var(--padding-lg);
  }

  .stat-icon {
    margin-bottom: var(--padding-sm);
  }
}
</style>
