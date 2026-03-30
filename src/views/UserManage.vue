<template>
  <div class="user-manage">
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索用户姓名或账号"
            class="search-input"
            @input="handleSearch"
          />
        </div>
        <div class="filter-group">
          <el-select v-model="filterRole" placeholder="角色" clearable class="filter-select">
            <el-option label="全部角色" value="" />
            <el-option label="员工" value="employee" />
            <el-option label="领导" value="leader" />
            <el-option label="管理员" value="admin" />
            <el-option label="访客" value="guest" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="状态" clearable class="filter-select">
            <el-option label="全部状态" value="" />
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </div>
      </div>
      <div class="toolbar-right" v-if="!isGuest">
        <el-button type="primary" @click="handleAdd" class="btn-primary">
          <el-icon><Plus /></el-icon>
          新增用户
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div v-for="i in 5" :key="i" class="skeleton-row"></div>
    </div>

    <div v-else-if="filteredUsers.length === 0" class="empty-state">
      <div class="empty-illustration">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="16" y="24" width="48" height="40" rx="4" stroke="#d9d9d9" stroke-width="2"/>
          <circle cx="30" cy="36" r="6" stroke="#d9d9d9" stroke-width="2"/>
          <path d="M20 52C20 46.4772 24.4772 42 30 42H50C55.5228 42 60 46.4772 60 52V54H20V52Z" stroke="#d9d9d9" stroke-width="2"/>
          <line x1="36" y1="34" x2="36" y2="42" stroke="#d9d9d9" stroke-width="2"/>
        </svg>
      </div>
      <p class="empty-text">{{ searchKeyword || filterRole || filterStatus ? '未找到匹配的用户' : '暂无用户' }}</p>
      <p class="empty-hint" v-if="!searchKeyword && !filterRole && !filterStatus">点击右上角按钮添加第一个用户</p>
    </div>

    <div v-else>
      <div class="table-wrapper">
      <table class="data-table">
        <colgroup>
          <col style="width: 70px">
          <col style="width: 80px">
          <col style="width: 80px">
          <col style="width: 64px">
          <col style="width: 40px">
        </colgroup>
        <thead>
          <tr>
            <th style="width: 70px">姓名</th>
            <th style="width: 80px">账号</th>
            <th style="width: 80px">部门</th>
            <th style="width: 64px">角色</th>
            <th style="width: 40px; padding: 0">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(user, index) in filteredUsers"
            :key="user.id"
            class="table-row animate-fade-in"
            :style="{ animationDelay: `${index * 0.02}s` }"
          >
            <td class="td-name td-ellipsis">{{ user.name }}</td>
            <td class="td-username td-ellipsis">{{ user.username }}</td>
            <td class="td-dept td-ellipsis">{{ user.department || '-' }}</td>
            <td class="td-role">
              <span class="role-tag" :class="'role-' + user.role">
                {{ roleName(user.role) }}
              </span>
            </td>
            <td class="td-actions">
              <div class="action-buttons" v-if="!isGuest">
                <el-button size="small" class="btn-edit" @click="handleEdit(user)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button size="small" class="btn-delete" @click="handleDelete(user)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div v-if="!loading && filteredUsers.length > 0" class="pagination">
      <div class="pagination-info">
        显示 {{ 1 }} - {{ filteredUsers.length }} 条，共 {{ filteredUsers.length }} 条
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
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
      width="90%"
      :max-width="500"
      destroy-on-close
      class="user-dialog"
    >
      <UserFormContent :is-edit="isEdit" :form="form" />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" round>取消</el-button>
          <el-button type="primary" @click="handleSubmit" round :disabled="!form.username || !form.name || (!isEdit && !form.password)">
            <el-icon><Check /></el-icon>
            {{ isEdit ? '保存修改' : '确认创建' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 手机端 BottomSheet -->
    <BottomSheet
      v-if="isMobile"
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
    >
      <UserFormContent :is-edit="isEdit" :form="form" />
      <template #footer>
        <el-button @click="dialogVisible = false" round>取消</el-button>
        <el-button type="primary" @click="handleSubmit" round :disabled="!form.username || !form.name || (!isEdit && !form.password)">
          <el-icon><Check /></el-icon>
          {{ isEdit ? '保存修改' : '确认创建' }}
        </el-button>
      </template>
    </BottomSheet>

    <el-dialog v-model="deleteDialogVisible" title="确认删除" width="90%" :max-width="400" destroy-on-close class="delete-dialog">
      <div class="delete-confirm">
        <div class="delete-icon">
          <el-icon><WarningFilled /></el-icon>
        </div>
        <p class="delete-text">确定删除用户「{{ deleteTarget?.name }}」吗？</p>
        <p class="warning-text">此操作不可恢复，删除后该用户的所有数据将被清除</p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deleteDialogVisible = false" round>取消</el-button>
          <el-button type="danger" @click="confirmDelete" round>
            <el-icon><Delete /></el-icon>
            确认删除
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Plus, Search, User, Edit, Delete, Lock, EditPen,
  OfficeBuilding, Avatar, Check, WarningFilled
} from '@element-plus/icons-vue'
import UserFormContent from '@/components/UserFormContent.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import api, { createUserWithoutLogin, getCurrentUser } from '../supabase'

const users = ref([])
const loading = ref(false)
const isMobile = ref(false)
const currentUser = ref({})
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const isEdit = ref(false)
const searchKeyword = ref('')
const filterRole = ref('')
const filterStatus = ref('')
const deleteTarget = ref(null)

const form = reactive({
  id: null,
  username: '',
  password: '',
  name: '',
  department: '',
  role: 'employee',
  permissions: {
    viewSelf: true,
    viewPeer: false,
    viewLeader: false,
    viewSummary: false
  }
})

const filteredUsers = computed(() => {
  let result = users.value
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(u =>
      u.name?.toLowerCase().includes(keyword) ||
      u.username?.toLowerCase().includes(keyword) ||
      u.department?.toLowerCase().includes(keyword)
    )
  }
  if (filterRole.value) {
    result = result.filter(u => u.role === filterRole.value)
  }
  if (filterStatus.value) {
    result = result.filter(u => u.status === filterStatus.value)
  }
  return result
})

const handleSearch = () => {
}

const isGuest = computed(() => currentUser.value?.role === 'guest')

const roleName = (role) => {
  const map = { admin: '管理员', leader: '领导', employee: '员工', guest: '访客' }
  return map[role] || role
}

const getAvatarColor = (name, role) => {
  if (role === 'admin') {
    return 'linear-gradient(135deg, #2b5fec, #1e4ad4)'
  } else if (role === 'employee') {
    return 'linear-gradient(135deg, #52c41a, #389e0d)'
  } else if (role === 'leader') {
    return 'linear-gradient(135deg, #fa8c16, #d46b08)'
  } else if (role === 'guest') {
    return 'linear-gradient(135deg, #8c8c8c, #595959)'
  }
  const colors = [
    'linear-gradient(135deg, #2b5fec, #1e4ad4)',
    'linear-gradient(135deg, #52c41a, #389e0d)',
    'linear-gradient(135deg, #67c23a, #529b2e)',
    'linear-gradient(135deg, #e6a23c, #c77c11)',
    'linear-gradient(135deg, #f56c6c, #c44d4d)',
    'linear-gradient(135deg, #909399, #606266)'
  ]
  const index = name ? name.charCodeAt(0) % colors.length : 0
  return colors[index]
}

const roleTagType = (role) => {
  const map = { admin: 'danger', leader: 'warning', employee: 'success' }
  return map[role] || 'info'
}

const getAvatarClass = (role) => {
  const map = { admin: 'avatar-admin', leader: 'avatar-leader', employee: 'avatar-employee' }
  return map[role] || 'avatar-default'
}

const parsePermissions = (permStr) => {
  if (!permStr) return null
  if (typeof permStr === 'object') return permStr
  try {
    return JSON.parse(permStr)
  } catch {
    return null
  }
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

const loadUsers = async () => {
  loading.value = true
  try {
    users.value = await api.getUsers()
  } catch (err) {
    ElMessage.error('加载用户失败：' + err.message)
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, {
    id: null,
    username: '',
    password: '',
    name: '',
    department: '',
    role: 'employee',
    permissions: { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
  })
  dialogVisible.value = true
}

const handleEdit = (user) => {
  isEdit.value = true
  const perms = parsePermissions(user.permissions)
  Object.assign(form, {
    id: user.id,
    username: user.username,
    password: '',
    name: user.name,
    department: user.department || '',
    role: user.role || 'employee',
    permissions: perms || { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (!form.username || !form.name) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (!isEdit.value && !form.password) {
    ElMessage.warning('请输入密码')
    return
  }

  if (!isEdit.value && form.password && form.password.length < 6) {
    ElMessage.warning('密码长度不能少于6位')
    return
  }

  try {
    if (isEdit.value) {
      const updateData = {
        name: form.name,
        department: form.department,
        role: form.role,
        permissions: JSON.stringify(form.permissions)
      }
      if (form.password) {
        updateData.password_hash = btoa(unescape(encodeURIComponent(form.password + '_360eval')))
      }
      await api.updateUser(form.id, updateData)
      ElMessage.success('更新成功')
    } else {
      await createUserWithoutLogin(form.username, form.password, {
        name: form.name,
        department: form.department,
        role: form.role,
        permissions: JSON.stringify(form.permissions)
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadUsers()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleDelete = (user) => {
  deleteTarget.value = user
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  try {
    await api.deleteUser(deleteTarget.value.id)
    ElMessage.success('删除成功')
    deleteDialogVisible.value = false
    deleteTarget.value = null
    await loadUsers()
  } catch (err) {
    ElMessage.error('删除失败：' + err.message)
  }
}

onMounted(async () => {
  currentUser.value = await getCurrentUser()
  loadUsers()
  handleResize()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.user-manage {
  margin: 0 auto;
  padding: var(--padding-md);
  padding-bottom: calc(var(--bottom-nav-height) + var(--padding-xl));
  width: 100%;
  max-width: 1400px;
  box-sizing: border-box;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  margin-bottom: 12px;
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
  width: 220px;
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
  width: 100px;
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
  height: 36px;
  line-height: 36px;
  font-size: var(--font-size-xs);
  color: var(--text-primary);
}

.filter-select :deep(.el-input__wrapper:hover) {
  border-color: var(--accent);
}

.filter-select :deep(.el-select__caret) {
  color: var(--text-tertiary);
}

.toolbar-right {
  display: flex;
  gap: var(--padding-sm);
}

.btn-primary {
  height: 36px;
  padding: 0 16px;
  background: var(--primary);
  border: none;
  border-radius: var(--border-radius-sm);
  color: var(--accent);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--accent);
  color: var(--primary);
}

.btn-primary .el-icon {
  margin-right: 4px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  height: 52px;
  background: linear-gradient(90deg, #f5f5f5 25%, #e8e8e8 50%, #f5f5f5 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: var(--card-bg);
  border-radius: var(--border-radius);
}

.empty-illustration {
  margin: 0 auto 16px;
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  margin: 0 0 8px;
}

.empty-hint {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.table-wrapper {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  overflow-x: auto;
  box-shadow: var(--shadow-sm);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

.data-table thead th {
  background: var(--info-bg);
  padding: 0 16px;
  height: 44px;
  text-align: left;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.06em;
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

.td-name-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.td-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.td-username,
.td-dept {
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
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tag-employee {
  background: var(--success-bg);
  color: var(--success);
}

.tag-employee .status-dot {
  background: var(--success);
}

.tag-leader {
  background: var(--warning-bg);
  color: var(--accent);
}

.tag-leader .status-dot {
  background: var(--accent);
}

.tag-admin {
  background: var(--danger-bg);
  color: var(--danger);
}

.tag-admin .status-dot {
  background: var(--danger);
}

.dot-employee {
  background: var(--success);
}

.dot-leader {
  background: var(--accent);
}

.dot-admin {
  background: var(--danger);
}

.role-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.role-employee {
  background: var(--success-bg);
  color: var(--success);
}

.role-leader {
  background: var(--warning-bg);
  color: var(--accent);
}

.role-admin {
  background: var(--danger-bg);
  color: var(--danger);
}

.td-actions {
  position: sticky;
  right: 0;
  background: var(--card-bg);
  text-align: center;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  z-index: 1;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-edit {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  min-width: 28px !important;
  background: var(--success-bg) !important;
  border: none !important;
  color: var(--success) !important;
}

.btn-edit:hover {
  background: rgba(74, 158, 140, 0.2) !important;
}

.btn-delete {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  min-width: 28px !important;
  background: transparent !important;
  border: none !important;
  color: var(--text-tertiary) !important;
}

.btn-delete:hover {
  color: var(--danger) !important;
  background: var(--danger-bg) !important;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--padding-md) 0;
}

.pagination-info {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 32px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--accent);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn-prev,
.page-btn-next {
  padding: 0 12px;
}

.user-dialog :deep(.el-dialog__body) {
  padding: var(--padding-md) var(--padding-lg);
}

.user-form :deep(.el-form-item__label) {
  font-weight: 500;
  padding-bottom: var(--padding-xs);
}

.role-option {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  padding: var(--padding-xs) 0;
}

.permissions-item :deep(.el-form-item__content) {
  line-height: normal;
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--padding-sm);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--padding-sm);
}

.dialog-footer .el-button {
  min-width: 100px;
}

.delete-dialog .delete-confirm {
  text-align: center;
  padding: var(--padding-md);
}

.delete-icon {
  width: 64px;
  height: 64px;
  background: rgba(192, 80, 77, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--padding-md);
  color: #c0504d;
  font-size: 32px;
}

.delete-text {
  font-size: var(--font-md);
  color: var(--color-text-primary);
  margin: 0 0 var(--padding-xs);
  font-weight: 500;
}

.warning-text {
  color: var(--color-danger);
  font-size: var(--font-sm) !important;
  margin: 0;
  opacity: 0.8;
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
  .user-manage {
    padding: var(--padding-sm);
    padding-bottom: calc(var(--bottom-nav-height) + var(--padding-md));
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    height: auto;
    gap: var(--padding-sm);
  }

  .toolbar-left {
    flex-wrap: wrap;
  }

  .search-box {
    width: 100%;
  }

  .filter-group {
    width: 100%;
  }

  .filter-select {
    flex: 1;
  }

  .toolbar-right {
    justify-content: flex-end;
  }

  .pagination {
    flex-direction: column;
    gap: var(--padding-sm);
  }

  .fab {
    bottom: calc(var(--bottom-nav-height) + var(--padding-md));
    right: var(--padding-md);
    width: 50px;
    height: 50px;
  }
}

@media screen and (max-width: 480px) {
  .permission-grid {
    grid-template-columns: 1fr;
  }

  .dialog-footer {
    flex-direction: column;
  }

  .dialog-footer .el-button {
    width: 100%;
  }

  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .data-table {
    min-width: 500px;
  }

  .user-card-list {
    display: flex;
    flex-direction: column;
    gap: var(--padding-sm);
    padding-bottom: var(--padding-md);
  }

  .user-item-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--padding-md);
    background: var(--card-bg);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-sm);
  }

  .user-item-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .user-item-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-md);
    font-weight: 600;
    flex-shrink: 0;
  }

  .user-item-info {
    min-width: 0;
  }

  .user-item-name {
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-item-account {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin-top: 2px;
  }

  .user-item-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .user-role-tag {
    font-size: 11px;
  }

  .user-item-actions {
    display: flex;
    gap: 4px;
  }

  .btn-icon-edit, .btn-icon-delete {
    width: 28px;
    height: 28px;
    padding: 0;
  }

  .toolbar-left {
    flex-direction: column;
    gap: 8px;
  }

  .filter-group {
    width: 100%;
    display: flex;
    gap: 8px;
  }

  .filter-select {
    flex: 1;
  }
}
</style>