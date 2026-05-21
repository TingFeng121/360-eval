<template>
  <div class="task-manage">
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="filter-group">
          <el-select v-model="filterTargetId" placeholder="被评价人" clearable filterable class="filter-select">
            <el-option label="全部人员" :value="''" />
            <el-option v-for="user in userList" :key="user.id" :label="user.name" :value="user.id" />
          </el-select>
        </div>
      </div>
      <div class="toolbar-right">
        <el-button v-if="hasPendingPeerTasks" @click="router.push('/batch-evaluation')" class="btn-batch">
          <el-icon><Edit /></el-icon>
          批量互评
        </el-button>
        <el-button v-if="currentUser.role === 'admin'" type="primary" @click="showCreateModal = true" class="btn-primary">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </div>
    </div>

    <div class="status-tabs">
      <div
        v-for="tab in statusTabs"
        :key="tab.value"
        class="status-tab"
        :class="{ active: filterStatus === tab.value }"
        @click="filterStatus = tab.value"
      >
        {{ tab.label }}
        <span class="tab-count">{{ getTabCount(tab.value) }}</span>
      </div>
    </div>

    <div v-if="globalError" class="error-banner">
      <div class="error-content">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ globalError }}</span>
      </div>
      <el-button size="small" @click="forceRefresh">刷新</el-button>
    </div>

    <div v-if="loading" class="loading-state">
      <div v-for="i in 5" :key="i" class="skeleton-row"></div>
    </div>

    <div v-else-if="globalError" class="empty-state">
      <el-empty :description="globalError" />
    </div>

    <div v-else-if="tasks.length === 0" class="empty-state">
      <div class="empty-illustration">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="12" y="16" width="56" height="48" rx="4" stroke="#d9d9d9" stroke-width="2"/>
          <line x1="12" y1="28" x2="68" y2="28" stroke="#d9d9d9" stroke-width="2"/>
          <line x1="24" y1="40" x2="56" y2="40" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
          <line x1="24" y1="50" x2="48" y2="50" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="empty-text">暂无评价任务</p>
      <p class="empty-hint">点击右上角按钮创建第一个任务</p>
    </div>

    <div v-else>
      <div class="table-wrapper">
      <table class="data-table">
        <colgroup>
          <col style="width: 44px">
          <col style="width: 60px">
          <col style="width: 82px">
          <col style="width: 60px">
          <col style="width: 36px">
          <col style="width: 36px">
        </colgroup>
        <thead>
          <tr>
            <th style="width: 40px">序号</th>
            <th style="width: 60px">被评价人</th>
            <th style="width: 80px">评价类型</th>
            <th style="width: 60px">评价人</th>
            <th style="width: 36px">状态</th>
            <th style="width: 36px; padding: 0">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(task, index) in filteredTasks"
            :key="task.id"
            class="table-row animate-fade-in"
            :style="{ animationDelay: `${index * 0.02}s` }"
          >
            <td class="td-index">{{ index + 1 }}</td>
            <td class="td-name td-ellipsis">{{ task.target_name }}</td>
            <td class="td-type">
              <span class="status-tag status-tag-sm" :class="'tag-' + task.eval_type">
                <span class="status-dot"></span>
                {{ evalTypeName(task.eval_type) }}
              </span>
            </td>
            <td class="td-reviewer td-ellipsis">{{ task.reviewer_name || '-' }}</td>
            <td class="td-status">
              <span
                class="status-dot"
                :class="{
                  done: task.status === 'completed',
                  saved: task.status === 'saved',
                  pending: task.status === 'pending'
                }"
                :title="task.status === 'completed' ? '已完成' : task.status === 'saved' ? '已暂存' : '待填写'"
              ></span>
            </td>
            <td class="td-actions">
              <div class="action-buttons">
                <el-button
                  v-if="task.status === 'completed'"
                  class="icon-btn icon-btn-view"
                  @click="goEvaluation(task.id)"
                  title="查看详情"
                >
                  <el-icon><View /></el-icon>
                </el-button>
                <el-button
                  v-else
                  class="icon-btn icon-btn-fill"
                  @click="goEvaluation(task.id)"
                  :title="task.status === 'saved' ? '继续填写' : '去填写'"
                >
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div v-if="!loading && filteredTasks.length > 0 && filteredTasks.length < 5" class="empty-hint-text">
      暂无更多任务
    </div>

    <div v-if="!loading && filteredTasks.length > 0" class="pagination">
      <div class="pagination-info">
        显示 {{ 1 }} - {{ filteredTasks.length }} 条，共 {{ filteredTasks.length }} 条
      </div>
      <div class="pagination-controls">
        <button class="page-btn page-btn-prev" disabled>
          <span>←</span> Previous
        </button>
        <button class="page-btn page-btn-num active">1</button>
        <button class="page-btn page-btn-next" disabled>
          Next <span>→</span>
        </button>
      </div>
    </div>

    <!-- 电脑端 el-dialog -->
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
  Plus, WarningFilled, View, Edit, Close
} from '@element-plus/icons-vue'
import BottomSheet from '@/components/BottomSheet.vue'
import DialogContent from '@/components/DialogContent.vue'
import DialogFooter from '@/components/DialogFooter.vue'
import api, { getCurrentUser } from '../supabase'
import { apiCache } from '../supabase'

const router = useRouter()
const tasks = ref([])
const userList = ref([])
const loading = ref(false)
const filterStatus = ref('')
const filterTargetId = ref('')
const showCreateModal = ref(false)
const globalError = ref(null)
const currentPeriod = ref({ year: 2026, quarter: 1 })
const currentUser = ref({})
const isMobile = ref(false)
const questionBanks = ref([])

watch(showCreateModal, (newVal) => {
  if (newVal) {
    filterTargetId.value = ''
    taskForm.eval_type = 'self'
    taskForm.bank_id = ''
    taskForm.self.target_ids = []
    taskForm.peer.reviewer_id = ''
    taskForm.peer.target_ids = []
    taskForm.leader.reviewer_id = ''
    taskForm.leader.target_ids = []
  }
})

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待评价', value: 'pending' },
  { label: '已完成', value: 'completed' }
]

const getTabCount = (status) => {
  if (!status) return tasks.value.length
  return tasks.value.filter(t => t.status === status).length
}

const filteredTasks = computed(() => {
  let result = tasks.value
  if (filterTargetId.value) {
    result = result.filter(t => t.target_user_id === filterTargetId.value)
  }
  if (filterStatus.value) {
    result = result.filter(t => t.status === filterStatus.value)
  }
  return result
})

const hasPendingPeerTasks = computed(() => {
  return tasks.value.some(t =>
    t.eval_type === 'peer' &&
    t.reviewer_user_id === currentUser.value.id &&
    (t.status === 'pending' || t.status === 'saved')
  )
})

const taskForm = reactive({
  eval_type: 'self',
  bank_id: '',
  self: {
    target_ids: []
  },
  peer: {
    reviewer_id: '',
    target_ids: []
  },
  leader: {
    reviewer_id: '',
    target_ids: []
  }
})

const employeeList = computed(() => userList.value.filter(u => u.role === 'employee'))

const leaderList = computed(() => userList.value.filter(u => u.role === 'leader'))

const isFormValid = computed(() => {
  if (taskForm.eval_type === 'self') {
    return taskForm.self.target_ids.length > 0
  } else if (taskForm.eval_type === 'peer') {
    return !!taskForm.peer.reviewer_id && taskForm.peer.target_ids.length > 0
  } else if (taskForm.eval_type === 'leader') {
    return !!taskForm.leader.reviewer_id && taskForm.leader.target_ids.length > 0
  }
  return false
})

const handleEvalTypeChange = () => {
  taskForm.self.target_ids = []
  taskForm.peer.reviewer_id = ''
  taskForm.peer.target_ids = []
  taskForm.leader.reviewer_id = ''
  taskForm.leader.target_ids = []
}

const evalTypeName = (type) => {
  const map = { self: '自评', peer: '他评', leader: '领导评' }
  return map[type] || type
}

const evalTypeTagType = (type) => {
  const map = { self: '', peer: 'success', leader: 'warning' }
  return map[type] || 'info'
}

const roleName = (role) => {
  const map = { admin: '管理员', leader: '领导', employee: '员工' }
  return map[role] || '员工'
}

const roleTagType = (role) => {
  const map = { admin: 'danger', leader: 'warning', employee: '' }
  return map[role] || 'info'
}

const getAvatarClass = (type) => {
  const map = { self: 'avatar-self', peer: 'avatar-peer', leader: 'avatar-leader' }
  return map[type] || 'avatar-default'
}

const loadTasks = async () => {
  loading.value = true
  globalError.value = null

  try {
    const user = await getCurrentUser()
    const allTasks = await api.getTasks(user)

    if (filterStatus.value) {
      tasks.value = allTasks.filter(t => t.status === filterStatus.value)
    } else {
      tasks.value = allTasks
    }
  } catch (err) {
    console.error('加载任务失败', err)
    if (err.message.includes('SESSION_INVALID')) {
      globalError.value = '登录已失效，请刷新页面重新登录'
    } else {
      globalError.value = '加载任务失败：' + err.message
    }
  } finally {
    loading.value = false
  }
}

const loadUsers = async () => {
  try {
    userList.value = await api.getUsers()
    const period = await api.getCurrentPeriod()
    currentPeriod.value = period
    questionBanks.value = await api.getQuestionBanks()
  } catch (err) {
    console.error('加载用户失败', err)
  }
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
    ElMessage.success('创建成功')
    showCreateModal.value = false
    filterTargetId.value = ''
    filterStatus.value = ''
    taskForm.eval_type = 'self'
    taskForm.bank_id = ''
    taskForm.self.target_ids = []
    taskForm.peer.reviewer_id = ''
    taskForm.peer.target_ids = []
    taskForm.leader.reviewer_id = ''
    taskForm.leader.target_ids = []
    apiCache.clear('getTasks')
    await loadTasks()
  } catch (err) {
    ElMessage.error('创建失败：' + err.message)
  }
}

const goEvaluation = (taskId) => {
  router.push(`/evaluation/${taskId}`)
}

const forceRefresh = () => {
  window.location.reload()
}

onMounted(async () => {
  const user = await getCurrentUser()
  currentUser.value = user || {}
  loadTasks()
  loadUsers()
})
</script>

<style scoped>
.task-manage {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--padding-lg);
  padding-bottom: calc(var(--bottom-nav-height) + var(--padding-xl));
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--padding-lg);
  flex-wrap: wrap;
  gap: var(--gap-card);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  margin-bottom: var(--padding-base);
  gap: var(--padding-md);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  flex: 1;
}

.search-box {
  position: relative;
  width: 280px;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  z-index: 1;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--card-bg);
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.filter-group {
  display: flex;
  gap: var(--padding-sm);
}

.filter-select {
  width: 240px;
}

.filter-select :deep(.el-input__wrapper) {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  box-shadow: none !important;
  height: 36px;
  padding-left: 10px;
  padding-right: 10px;
}

.filter-select :deep(.el-input__inner) {
  font-size: var(--font-size-sm);
}

.btn-primary {
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  color: #ffffff !important;
  border-radius: var(--radius-sm);
  height: 36px;
  font-weight: 500;
}

.btn-batch {
  background: #fff !important;
  border: 1px solid #409eff !important;
  color: #409eff !important;
  border-radius: var(--radius-sm);
  height: 36px;
  font-weight: 500;
}

.btn-batch:hover {
  background: #ecf5ff !important;
}

.btn-primary:hover {
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  color: #ffffff !important;
  opacity: 0.9;
}

.btn-primary .el-icon {
  margin-right: 4px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-btn {
  gap: var(--padding-xs);
}

.error-banner {
  background: var(--danger-bg);
  color: var(--danger-color);
  padding: var(--padding-md);
  border-radius: var(--border-radius-lg);
  margin-bottom: var(--padding-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.error-content {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.filter-tabs {
  display: flex;
  gap: var(--padding-sm);
  margin-bottom: var(--padding-lg);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--padding-xs);
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: var(--padding-xs);
  padding: var(--padding-sm) var(--padding-md);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  min-height: 44px;
}

.filter-tab.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.filter-tab:hover:not(.active) {
  border-color: var(--primary);
  color: var(--primary);
}

.tab-count {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-xs);
  min-width: 20px;
  text-align: center;
}

.filter-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.25);
}

.skeleton-card {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: var(--padding-md);
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--padding-md);
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: var(--padding-xs);
}

.empty-state {
  text-align: center;
  padding: var(--padding-xl) var(--padding-md);
  background: var(--card-bg);
  border-radius: var(--border-radius);
}

.empty-hint-text {
  text-align: center;
  padding: var(--padding-base);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.empty-illustration {
  width: 100px;
  height: 100px;
  background: var(--info-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 40px;
  margin: 0 auto var(--padding-md);
}

.empty-text {
  font-size: var(--font-size-md);
  color: var(--text-primary);
  margin: 0 0 var(--padding-xs);
}

.empty-hint {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--padding-md);
  margin-bottom: var(--padding-lg);
  flex-wrap: wrap;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: var(--padding-md);
}

.filter-count {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.task-table-wrapper {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table-wrapper {
  overflow-x: auto;
  background: var(--card-bg);
  border-radius: var(--border-radius);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.td-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-tag-sm {
  padding: 2px 6px;
  font-size: var(--font-size-xs);
}

.data-table thead th {
  background: var(--info-bg);
  padding: 0 16px;
  text-align: left;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  height: 44px;
  border-bottom: 1px solid var(--border-color);
}

.data-table thead th.th-actions {
  text-align: center;
}

.data-table tbody td {
  padding: 0 16px;
  height: var(--row-height);
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.table-row {
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: var(--info-bg);
}

.td-index {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  text-align: center;
  width: 60px;
}

.td-name {
  font-weight: 500;
}

.td-reviewer {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.done {
  background: #10b981;
}

.status-dot.pending {
  background: #ef4444;
}

.status-dot.saved {
  background: #f97316;
}

.tag-active,
.tag-completed {
  background: rgba(74, 158, 140, 0.12);
  color: #4a9e8c;
}

.tag-active .status-dot,
.tag-completed .status-dot {
  background: #4a9e8c;
}

.tag-pending,
.tag-self,
.tag-peer,
.tag-leader {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.tag-pending .status-dot,
.tag-self .status-dot,
.tag-peer .status-dot,
.tag-leader .status-dot {
  background: var(--color-primary);
}

.td-actions {
  position: sticky;
  right: 0;
  background: #fff;
  text-align: center;
  width: 40px;
  min-width: 40px;
  padding: 0;
  z-index: 1;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none !important;
  background: transparent !important;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.icon-btn-view {
  color: #4a9e8c;
}

.icon-btn-view:hover {
  background: rgba(74, 158, 140, 0.12);
  color: #4a9e8c;
}

.icon-btn-fill {
  color: var(--color-primary);
}

.icon-btn-fill:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.btn-edit {
  background: var(--color-primary-light) !important;
  color: var(--color-primary) !important;
  border: none !important;
  border-radius: var(--radius-sm) !important;
  padding: 4px 8px !important;
  font-size: 12px !important;
  height: 26px;
  transition: all 0.2s;
}

.btn-edit:hover {
  background: rgba(43,95,236,0.2) !important;
}

.td-status {
  text-align: center;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  margin-top: 12px;
}

.pagination-info {
  font-size: 13px;
  color: #9ca3af;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.page-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.task-table {
  width: 100%;
  border-collapse: collapse;
}

.task-table th {
  background: #f8f8fa;
  padding: 14px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-color);
}

.task-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  vertical-align: middle;
}

.task-row:last-child td {
  border-bottom: none;
}

.task-row:hover {
  background: var(--color-primary-light);
}

.row-index {
  color: var(--text-tertiary);
  font-size: 12px;
  width: 60px;
}

.target-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.avatar-self {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
}

.avatar-peer {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
}

.avatar-leader {
  background: linear-gradient(135deg, #fa8c16 0%, #d46b08 100%);
}

.avatar-default {
  background: linear-gradient(135deg, #8c8c8c 0%, #595959 100%);
}

.target-name {
  font-weight: 500;
}

.row-reviewer {
  color: var(--text-secondary);
}

.row-action .el-button {
  min-width: 72px;
}

.action-btn .el-icon {
  margin-right: var(--padding-xs);
}

.task-dialog :deep(.el-dialog) {
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
}

.task-dialog :deep(.el-dialog__header) {
  padding: 0;
  margin: 0;
}

.task-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.task-dialog :deep(.el-overlay-dialog) {
  background: rgba(26, 26, 46, 0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--padding-lg);
  border-bottom: 1px solid var(--border-color);
}

.dialog-title {
  font-family: var(--font-family);
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all var(--transition-fast);
}

.dialog-close:hover {
  background: var(--info-bg);
  color: var(--text-primary);
}

.dialog-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--padding-sm) var(--padding-md);
  background: var(--warning-bg);
  border-left: 3px solid var(--accent);
  margin: var(--padding-lg) var(--padding-lg) 0;
  border-radius: 0 var(--border-radius-sm) var(--border-radius-sm) 0;
}

.dialog-tip .tip-icon {
  color: var(--accent);
  font-size: var(--font-size-md);
  flex-shrink: 0;
}

.dialog-tip span {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.task-form {
  padding: var(--padding-lg);
}

.task-form :deep(.el-form-item) {
  margin-bottom: var(--padding-md);
}

.task-form :deep(.el-form-item__label) {
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  padding-bottom: 6px;
  text-transform: uppercase;
}

.task-form :deep(.el-select) {
  width: 100%;
}

.type-select :deep(.el-input__wrapper),
.full-select :deep(.el-input__wrapper) {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  box-shadow: none !important;
  height: 42px;
  padding-left: 12px;
  padding-right: 12px;
  transition: border-color var(--transition-fast);
}

.type-select :deep(.el-input__wrapper:hover),
.full-select :deep(.el-input__wrapper:hover) {
  border-color: var(--text-tertiary);
}

.type-select :deep(.el-input.is-focus .el-input__wrapper),
.full-select :deep(.el-input.is-focus .el-input__wrapper) {
  border-color: var(--accent) !important;
}

.type-select :deep(.el-input__inner),
.full-select :deep(.el-input__inner) {
  height: 42px;
  line-height: 42px;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.form-section {
  margin-top: 8px;
}

.section-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--padding-md);
  padding: var(--padding-sm) var(--padding-base);
  background: var(--info-bg);
  border-radius: var(--border-radius-sm);
}

.section-hint .el-icon {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.peer-groups {
  display: flex;
  flex-direction: column;
  gap: var(--padding-sm);
  margin-bottom: var(--padding-sm);
}

.peer-group {
  background: var(--info-bg);
  border-radius: var(--border-radius);
  padding: var(--padding-md);
  position: relative;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--padding-sm);
}

.group-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.group-remove {
  color: var(--text-tertiary);
  padding: 4px;
}

.group-remove:hover {
  color: var(--danger);
}

.group-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--padding-sm);
}

.half-item :deep(.el-form-item__label) {
  font-size: var(--font-size-xs);
}

.half-item :deep(.el-input__wrapper) {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  box-shadow: none !important;
  height: 38px;
  padding-left: 10px;
  padding-right: 10px;
  transition: border-color var(--transition-fast);
}

.half-item :deep(.el-input__wrapper:hover) {
  border-color: var(--text-tertiary);
}

.half-item :deep(.el-input.is-focus .el-input__wrapper) {
  border-color: var(--accent) !important;
}

.half-item :deep(.el-input__inner) {
  height: 38px;
  line-height: 38px;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.add-group-btn {
  width: 100%;
  border: 1px dashed var(--border-color);
  border-radius: var(--border-radius-sm);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  height: 40px;
  transition: all var(--transition-fast);
}

.add-group-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.add-group-btn .el-icon {
  margin-right: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--padding-sm);
  padding: var(--padding-md) var(--padding-lg);
  border-top: 1px solid var(--border-color);
}

.btn-cancel {
  min-width: 100px;
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--card-bg);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.btn-confirm {
  min-width: 120px;
  height: 40px;
  border: none;
  border-radius: var(--border-radius-sm);
  background: var(--primary);
  color: var(--accent);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-confirm:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
}

.btn-confirm:disabled {
  background: rgba(26, 26, 46, 0.35);
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
}

.btn-confirm .el-icon {
  margin-right: 4px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.user-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--padding-md);
  padding: var(--padding-xs) 0;
}

.eval-type-option {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  padding: var(--padding-xs) 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--padding-sm);
}

.dialog-footer .el-button {
  min-width: 100px;
}

.fab {
  position: fixed;
  bottom: calc(var(--bottom-nav-height) + var(--padding-lg));
  right: var(--padding-lg);
  width: 56px;
  height: 56px;
  box-shadow: var(--shadow-lg);
  font-size: 24px;
  z-index: 100;
}

@media screen and (max-width: 768px) {
  .task-manage {
    padding: var(--padding-sm);
    padding-bottom: calc(var(--bottom-nav-height) + var(--padding-md));
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-btn span {
    display: inline;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--padding-sm);
  }

  .filter-left {
    display: flex;
    flex-direction: column;
    gap: var(--padding-sm);
    width: 100%;
  }

  .filter-select {
    width: 100% !important;
    min-width: 0;
  }

  .task-table-wrapper {
    overflow-x: auto;
  }

  .task-table {
    min-width: 500px;
  }

  .fab {
    bottom: calc(var(--bottom-nav-height) + var(--padding-md));
    right: var(--padding-md);
    width: 50px;
    height: 50px;
  }
}

.status-tabs {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: var(--padding-xs);
  padding: var(--padding-sm) var(--padding-md);
  background: #f8f9fb;
  border-bottom: 1px solid #f0f0f0;
  -webkit-overflow-scrolling: touch;
}

.status-tab {
  flex-shrink: 0;
  padding: var(--padding-xs) var(--padding-md);
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.status-tab:hover {
  background: rgba(0, 0, 0, 0.04);
}

.status-tab.active {
  background: var(--primary);
  color: white;
}

.status-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.tab-count {
  background: rgba(0, 0, 0, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

@media screen and (max-width: 768px) {
  .task-manage {
    padding: var(--padding-sm);
    padding-bottom: calc(var(--bottom-nav-height) + var(--padding-md));
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-btn span {
    display: inline;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-left {
    flex-wrap: wrap;
  }

  .filter-select {
    width: 100%;
  }

  .task-table-wrapper {
    overflow-x: auto;
  }

  .task-table {
    min-width: 500px;
  }

  .fab {
    bottom: calc(var(--bottom-nav-height) + var(--padding-md));
    right: var(--padding-md);
    width: 50px;
    height: 50px;
  }
}

@media screen and (max-width: 480px) {
  .page-title {
    font-size: var(--font-size-lg);
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--padding-sm);
  }

  .filter-left {
    display: flex;
    flex-direction: column;
    gap: var(--padding-sm);
    width: 100%;
  }

  .filter-select {
    width: 100% !important;
    min-width: 0;
  }

  .filter-select :deep(.el-input__wrapper) {
    width: 100%;
    min-width: 0;
  }

  .filter-count {
    text-align: center;
    padding: var(--padding-xs) 0;
  }

  .dialog-footer {
    flex-direction: column;
    gap: 8px;
  }

  .dialog-footer .el-button {
    width: 100%;
    margin: 0;
  }

  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .data-table {
    min-width: 288px;
  }

  .task-dialog :deep(.el-dialog) {
    position: fixed !important;
    bottom: 0 !important;
    top: auto !important;
    left: 0 !important;
    right: 0 !important;
    margin: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 16px 16px 0 0 !important;
    max-height: 90vh !important;
    overflow-y: auto !important;
  }

  .task-dialog :deep(.el-dialog__body) {
    overflow-y: auto !important;
    max-height: calc(90vh - 120px) !important;
    padding-bottom: 16px !important;
  }

  .task-dialog :deep(.el-dialog__footer) {
    position: sticky !important;
    bottom: 0 !important;
    background: #fff !important;
    padding: 12px 16px !important;
    border-top: 1px solid #f0f0f0 !important;
  }
}

@media (max-width: 768px) {
  .task-dialog :deep(.el-overlay-dialog) {
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 16px !important;
    height: 100% !important;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    box-sizing: border-box !important;
  }

  .task-dialog :deep(.el-dialog) {
    width: 100% !important;
    margin: 0 !important;
    border-radius: 16px 16px 0 0 !important;
    max-height: 85vh !important;
    overflow: hidden !important;
  }

  .task-dialog :deep(.el-dialog__header) {
    padding: 16px 20px 12px !important;
    border-bottom: 1px solid var(--color-border) !important;
  }

  .task-dialog :deep(.el-dialog__header)::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    background: #e0ddd6;
    border-radius: 2px;
    margin: -8px auto 8px;
  }

  .task-dialog :deep(.el-dialog__body) {
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 16px 20px !important;
    -webkit-overflow-scrolling: touch !important;
  }

  .task-dialog :deep(.el-dialog__footer) {
    padding: 12px 20px !important;
    border-top: 1px solid var(--color-border) !important;
    background: #fff !important;
  }

  .dialog-footer {
    flex-direction: column !important;
    gap: 8px !important;
  }

  .dialog-footer .el-button {
    width: 100% !important;
    margin: 0 !important;
    height: 44px !important;
  }

  .dialog-tip {
    margin: 0 0 16px 0;
  }

  .task-form {
    padding: 0;
  }
}
</style>