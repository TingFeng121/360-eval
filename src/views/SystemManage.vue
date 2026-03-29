<template>
  <div class="system-manage">
    <div class="page-header">
      <h2>系统管理</h2>
      <p class="subtitle">仅管理员可用的系统初始化和管理功能</p>
    </div>
    
    <el-alert 
      v-if="configError" 
      type="error" 
      :title="configError" 
      :closable="false" 
      style="margin-bottom: 20px;" 
    />

    <div class="system-grid" v-else>
      <div class="danger-zone">
        <div class="danger-zone-header">
          <h3 class="danger-zone-title">
            <el-icon><Warning /></el-icon>
            数据初始化
          </h3>
          <el-tag type="danger" size="small" effect="plain">危险操作</el-tag>
        </div>

        <div class="danger-zone-content">
          <p class="danger-warning">此区域操作会导致数据丢失，请谨慎操作</p>

          <div class="danger-buttons">
            <el-button
              @click="clearAllQuestions"
              :loading="loading.clearQuestions"
              class="danger-btn-outline"
            >
              <el-icon><Delete /></el-icon>
              清空所有题目
            </el-button>

            <el-button
              @click="clearAllTasks"
              :loading="loading.clearTasks"
              class="danger-btn-outline"
            >
              <el-icon><Delete /></el-icon>
              清空所有任务
            </el-button>

            <el-button
              @click="clearAllAnswers"
              :loading="loading.clearAnswers"
              class="danger-btn-outline"
            >
              <el-icon><Delete /></el-icon>
              清空所有答案
            </el-button>

            <el-button
              @click="resetAllData"
              :loading="loading.resetAll"
              class="danger-btn-solid"
            >
              <el-icon><RefreshLeft /></el-icon>
              一键重置
            </el-button>
          </div>

          <div class="reset-info">
            <p class="info-item"><span class="info-label">一键重置将删除：</span>所有题目、任务、答案</p>
            <p class="info-item"><span class="info-label">不会删除：</span>用户账号、权重配置、季度设置</p>
          </div>
        </div>
      </div>

      <el-card class="system-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">⚙️ 权重配置</span>
          </div>
        </template>
        
        <div class="weight-content">
          <div class="weight-item">
            <span class="weight-label">自评权重</span>
            <el-slider v-model="weightForm.self_weight" :min="0" :max="1" :step="0.05" :disabled="!isAdmin" size="small" />
            <span class="weight-value">{{ (weightForm.self_weight * 100).toFixed(0) }}%</span>
          </div>
          
          <div class="weight-item">
            <span class="weight-label">他评权重</span>
            <el-slider v-model="weightForm.peer_weight" :min="0" :max="1" :step="0.05" :disabled="!isAdmin" size="small" />
            <span class="weight-value">{{ (weightForm.peer_weight * 100).toFixed(0) }}%</span>
          </div>
          
          <div class="weight-item">
            <span class="weight-label">领导权重</span>
            <el-slider v-model="weightForm.leader_weight" :min="0" :max="1" :step="0.05" :disabled="!isAdmin" size="small" />
            <span class="weight-value">{{ (weightForm.leader_weight * 100).toFixed(0) }}%</span>
          </div>
          
          <div class="weight-total">
            <span>合计：</span>
            <el-tag :type="totalWeight === 1 ? 'success' : 'danger'" size="small">
              {{ (totalWeight * 100).toFixed(0) }}% {{ totalWeight === 1 ? '✓' : '' }}
            </el-tag>
          </div>
          
          <div class="weight-actions" v-if="isAdmin">
            <el-button type="primary" size="small" @click="handleSaveWeight" :disabled="totalWeight !== 1">保存</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <el-card class="data-manage-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">数据导入导出</span>
        </div>
      </template>
      <div class="data-manage-content">
        <p class="data-manage-desc">导出当前系统数据用于备份，或从备份文件恢复数据</p>
        <div class="data-manage-buttons">
          <el-upload :auto-upload="false" :show-file-list="false" :on-change="handleDataImport" accept=".json">
            <el-button type="default">
              <el-icon><Upload /></el-icon>
              导入数据
            </el-button>
          </el-upload>
          <el-button type="default" @click="handleDataExport">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="system-info-card">
      <div class="system-info-item">
        <span class="info-label">当前季度</span>
        <span class="info-value">{{ currentPeriod ? `${currentPeriod}年第${currentQuarter}季度` : '-' }}</span>
      </div>
      <div class="system-info-item">
        <span class="info-label">系统版本</span>
        <span class="info-value">v1.0.0</span>
      </div>
      <div class="system-info-item">
        <span class="info-label">最后操作</span>
        <span class="info-value">{{ lastActionTime || '-' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElUpload } from 'element-plus'
import { Loading, Warning, Delete, RefreshLeft, Upload, Download } from '@element-plus/icons-vue'
import api, { getCurrentUser, supabase } from '../supabase'

const loading = reactive({
  clearQuestions: false,
  clearTasks: false,
  clearAnswers: false,
  resetAll: false
})

const currentUser = ref(null)
const configError = ref(null)
const lastActionTime = ref(null)
const currentPeriod = ref(null)
const currentQuarter = ref(null)

const isAdmin = computed(() => currentUser.value?.role === 'admin')
const isGuest = computed(() => currentUser.value?.role === 'guest')

const weightForm = reactive({
  self_weight: 0.3,
  peer_weight: 0.3,
  leader_weight: 0.4,
  score_type: '10'
})

const totalWeight = computed(() => {
  return weightForm.self_weight + weightForm.peer_weight + weightForm.leader_weight
})

const loadCurrentUser = async () => {
  try {
    currentUser.value = await getCurrentUser()
    if (currentUser.value?.role !== 'admin') {
      ElMessage.error('权限不足，仅管理员可访问')
    }
  } catch (e) {
    console.error('获取用户失败', e)
    if (e.message.includes('配置')) {
      configError.value = e.message
    }
  }
}

const loadWeightConfig = async () => {
  try {
    const config = await api.getWeight()
    Object.assign(weightForm, config)
  } catch (e) {
    console.error('加载权重配置失败', e)
  }
}

const handleSaveWeight = async () => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (totalWeight.value !== 1) {
    return ElMessage.warning('权重合计需为100%')
  }
  try {
    await api.updateWeight(weightForm)
    ElMessage.success('权重配置保存成功')
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  }
}

const clearAllQuestions = async () => {
  try {
    const actionText = '清空题目'
    const { value: inputValue } = await ElMessageBox.prompt(
      `此操作将清空所有题目，且不可恢复！\n\n请输入"${actionText}"确认：`,
      '危险操作',
      {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        inputPattern: new RegExp(`^${actionText}$`),
        inputErrorMessage: `请输入正确的确认文字：${actionText}`
      }
    )

    if (inputValue !== actionText) return

    loading.clearQuestions = true
    await api.clearAllQuestions()
    ElMessage.success('所有题目已清空')
  } catch (error) {
    if (error !== 'cancel' && !error.message?.includes('pattern')) {
      ElMessage.error(error.message || '清空失败')
    }
  } finally {
    loading.clearQuestions = false
  }
}

const clearAllTasks = async () => {
  try {
    const actionText = '清空任务'
    const { value: inputValue } = await ElMessageBox.prompt(
      `此操作将清空所有任务，且不可恢复！\n\n请输入"${actionText}"确认：`,
      '危险操作',
      {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        inputPattern: new RegExp(`^${actionText}$`),
        inputErrorMessage: `请输入正确的确认文字：${actionText}`
      }
    )

    if (inputValue !== actionText) return

    loading.clearTasks = true
    await api.clearAllTasks()
    ElMessage.success('所有任务已清空')
  } catch (error) {
    if (error !== 'cancel' && !error.message?.includes('pattern')) {
      ElMessage.error(error.message || '清空失败')
    }
  } finally {
    loading.clearTasks = false
  }
}

const clearAllAnswers = async () => {
  try {
    const actionText = '清空答案'
    const { value: inputValue } = await ElMessageBox.prompt(
      `此操作将清空所有答案，且不可恢复！\n\n请输入"${actionText}"确认：`,
      '危险操作',
      {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        inputPattern: new RegExp(`^${actionText}$`),
        inputErrorMessage: `请输入正确的确认文字：${actionText}`
      }
    )

    if (inputValue !== actionText) return

    loading.clearAnswers = true
    await api.clearAllAnswers()
    ElMessage.success('所有答案已清空')
  } catch (error) {
    if (error !== 'cancel' && !error.message?.includes('pattern')) {
      ElMessage.error(error.message || '清空失败')
    }
  } finally {
    loading.clearAnswers = false
  }
}

const resetAllData = async () => {
  try {
    const actionText = '确认重置'
    const { value: inputValue } = await ElMessageBox.prompt(
      `此操作将清空所有题目、任务、答案和维度，且不可恢复！\n\n请输入"${actionText}"确认：`,
      '危险操作',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        inputPattern: new RegExp(`^${actionText}$`),
        inputErrorMessage: `请输入正确的确认文字：${actionText}`
      }
    )

    if (inputValue !== actionText) return

    loading.resetAll = true
    await api.resetAllData()
    ElMessage.success('所有数据已重置，系统已初始化')
  } catch (error) {
    if (error !== 'cancel' && !error.message?.includes('pattern')) {
      ElMessage.error(error.message || '重置失败')
    }
  } finally {
    loading.resetAll = false
  }
}

const handleDataExport = async () => {
  try {
    const json = await api.exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `360评价数据_${currentPeriod.value}Q${currentQuarter.value}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('数据导出成功')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleDataImport = (file) => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      await api.importAllData(e.target.result)
      ElMessage.success('数据导入成功，请刷新页面')
      window.location.reload()
    } catch (err) {
      ElMessage.error(err.message)
    }
  }
  reader.readAsText(file.raw)
}

onMounted(async () => {
  await loadCurrentUser()
  if (!configError.value && currentUser.value?.role === 'admin') {
    await loadWeightConfig()
  }
  const period = await api.getCurrentPeriod()
  if (period) {
    currentPeriod.value = period.year
    currentQuarter.value = period.quarter
  } else {
    currentPeriod.value = new Date().getFullYear()
    currentQuarter.value = Math.ceil((new Date().getMonth() + 1) / 3)
  }
  lastActionTime.value = new Date().toLocaleString('zh-CN')
})
</script>

<style scoped>
/* ============================================
   页面容器
   ============================================ */
.system-manage {
  background: white;
  padding: var(--padding-md);
  border-radius: var(--border-radius-base);
  max-width: 100%;
  overflow-x: hidden;
}

.system-manage h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-family: var(--font-serif);
}

.subtitle {
  color: var(--text-secondary);
  margin: var(--padding-xs) 0 var(--margin-lg) 0;
  font-size: var(--font-size-sm);
}

/* ============================================
   页面头部
   ============================================ */
.page-header {
  margin-bottom: var(--margin-lg);
}

/* ============================================
   危险操作区域
   ============================================ */
.danger-zone {
  background: var(--bg);
  border-left: 3px solid var(--danger);
  border-radius: var(--border-radius-lg);
  padding: var(--padding-md);
  margin-bottom: var(--margin-lg);
}

.danger-zone-header {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  margin-bottom: var(--padding-md);
}

.danger-zone-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: var(--padding-xs);
  font-family: var(--font-serif);
}

.danger-zone-content {
  padding-left: var(--padding-md);
}

.danger-warning {
  color: var(--danger);
  font-size: 12px;
  margin: 0 0 var(--padding-md) 0;
  opacity: 0.8;
}

.danger-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--padding-sm);
  margin-bottom: var(--padding-md);
}

.danger-btn-outline {
  background: white;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 6px 16px;
  font-size: var(--font-size-sm);
  transition: all 0.2s;
}

.danger-btn-outline:hover {
  background: rgba(192, 80, 77, 0.04);
  border-color: var(--danger);
  color: var(--danger);
}

.danger-btn-solid {
  background: var(--danger);
  border: 1px solid var(--danger);
  color: white;
  padding: 6px 16px;
  font-size: var(--font-size-sm);
  transition: all 0.2s;
}

.danger-btn-solid:hover {
  background: #d0605d;
  border-color: #d0605d;
  color: white;
}

.reset-info {
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.info-item {
  margin: 0;
}

.info-label {
  color: var(--text-primary);
  font-weight: 500;
}

/* ============================================
   卡片网格布局
   ============================================ */
.system-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--padding-md);
  align-items: stretch;
}

.system-card {
  height: auto;
  border: 1px solid var(--border-color);
}

.system-card :deep(.el-card__header) {
  border-bottom: 1px solid var(--border-color);
  padding: var(--padding-md);
}

.system-card :deep(.el-card__body) {
  padding: var(--padding-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  font-family: var(--font-serif);
}

/* ============================================
   加载和状态
   ============================================ */
.loading-status {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.status-content {
  padding: var(--padding-xs) 0;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: var(--padding-sm) 0;
  padding: var(--padding-xs) 0;
  border-bottom: 1px solid var(--border-color);
}

.status-item:last-child {
  border-bottom: none;
}

.label {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: var(--font-size-sm);
}

.empty-state {
  color: var(--text-secondary);
  text-align: center;
  padding: var(--padding-md);
}

/* ============================================
   权重配置卡片
   ============================================ */
.weight-content {
  display: flex;
  flex-direction: column;
  gap: var(--padding-sm);
}

.weight-item {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.weight-label {
  width: 70px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.weight-item :deep(.el-slider) {
  flex: 1;
  min-width: 80px;
}

.weight-item :deep(.el-slider__runway) {
  height: 6px;
  background: #e5e6eb;
}

.weight-item :deep(.el-slider__bar) {
  height: 6px;
  background: var(--color-primary);
}

.weight-item :deep(.el-slider__button) {
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border: none;
}

.weight-value {
  width: 40px;
  text-align: right;
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-primary);
  font-family: var(--font-family);
}

.weight-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--padding-xs);
  border-top: 1px solid var(--border-color);
  font-size: var(--font-size-sm);
}

.weight-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--padding-xs);
}

.weight-actions .el-button--primary {
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  color: #ffffff !important;
}

.weight-actions .el-button--primary:hover {
  opacity: 0.9;
}

.data-manage-card {
  margin-top: var(--padding-md);
  border: 1px solid var(--border-color);
}

.data-manage-card :deep(.el-card__header) {
  border-bottom: 1px solid var(--border-color);
  padding: var(--padding-md);
}

.data-manage-card :deep(.el-card__body) {
  padding: var(--padding-md);
}

.data-manage-content {
  display: flex;
  flex-direction: column;
  gap: var(--padding-sm);
}

.data-manage-desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.data-manage-buttons {
  display: flex;
  gap: var(--padding-sm);
}

.system-info-card {
  margin-top: var(--padding-md);
  padding: var(--padding-md);
  background: #f8f9fb;
  border-radius: var(--border-radius-md);
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: var(--padding-sm);
}

.system-info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.system-info-item .info-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.system-info-item .info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ============================================
   响应式 - 平板 (769px - 1024px)
   ============================================ */
@media screen and (max-width: 1024px) {
  .system-grid {
    grid-template-columns: 1fr;
  }
}

/* ============================================
   响应式 - 移动端 (≤768px)
   ============================================ */
@media screen and (max-width: 768px) {
  .system-manage {
    padding: var(--padding-base);
  }

  .system-grid {
    grid-template-columns: 1fr;
  }

  .danger-zone {
    padding: var(--padding-base);
  }

  .danger-buttons {
    flex-direction: column;
  }

  .danger-btn-outline,
  .danger-btn-solid {
    width: 100%;
    justify-content: center;
  }
}

/* ============================================
   响应式 - 超小屏幕 (≤480px)
   ============================================ */
@media screen and (max-width: 480px) {
  .system-manage {
    padding: var(--padding-sm);
  }

  .system-manage h2 {
    font-size: var(--font-size-md);
  }

  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--padding-xs);
  }

  .status-item .el-tag {
    align-self: flex-end;
  }
}
</style>