<template>
  <div class="question-manage">
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="page-title">能力维度与评分题目配置</span>
      </div>
      <div class="toolbar-right">
        <el-button @click="handleExport" :loading="importing">
          <el-icon><Download /></el-icon>导出
        </el-button>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleImportFile"
          :disabled="importing"
          accept=".csv,.xlsx,.xls"
        >
          <el-button type="primary" :loading="importing">
            <el-icon><Upload /></el-icon>{{ importing ? '导入中...' : '导入' }}
          </el-button>
        </el-upload>
      </div>
    </div>

    <div class="main-content">
      <div class="left-panel">
        <div class="panel-header">
          <span>能力维度</span>
          <el-button size="small" type="primary" @click="handleAddDimension">
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>

        <div v-if="loading" class="loading-state">
          <div v-for="i in 4" :key="i" class="skeleton-item"></div>
        </div>

        <div v-else-if="dimensions.length === 0" class="empty-state-small">
          <p>暂无维度</p>
        </div>

        <div v-else class="dimension-list">
          <div
            v-for="dim in dimensions"
            :key="dim.id"
            class="dimension-item"
            :class="{ active: selectedDimension?.id === dim.id }"
            @click="selectDimension(dim)"
          >
            <div class="dimension-info">
              <span class="dimension-name">{{ dim.name }}</span>
              <span class="dimension-count">{{ getQuestionCount(dim.id) }}题</span>
            </div>
            <div class="dimension-actions">
              <el-switch
                v-model="dim.enabled"
                size="small"
                @change="handleToggleEnabled(dim)"
                @click.stop
              />
              <el-button size="small" link @click.stop="handleEditDimension(dim)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" link @click.stop="handleDeleteDimension(dim)" class="btn-delete-icon">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div v-if="!selectedDimension" class="empty-state-large">
          <div class="empty-illustration">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <rect x="16" y="20" width="48" height="40" rx="4" stroke="#d9d9d9" stroke-width="2"/>
              <line x1="16" y1="32" x2="64" y2="32" stroke="#d9d9d9" stroke-width="2"/>
              <line x1="28" y1="44" x2="52" y2="44" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
              <line x1="28" y1="52" x2="48" y2="52" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="empty-text">请选择左侧维度</p>
        </div>

        <div v-else class="question-panel">
          <div class="panel-header">
            <div class="panel-title-info">
              <span class="panel-title">{{ selectedDimension.name }}</span>
              <span class="panel-subtitle">{{ getQuestionCount(selectedDimension.id) }}道评分题</span>
            </div>
            <el-button size="small" type="primary" @click="handleAddQuestion">
              <el-icon><Plus /></el-icon>新增题目
            </el-button>
          </div>

          <div class="type-tabs">
            <div
              v-for="type in questionTypes"
              :key="type.value"
              class="type-tab"
              :class="{ active: selectedType === type.value }"
              @click="selectedType = type.value"
            >
              {{ type.label }}
              <span class="type-count">{{ getQuestionsByType(type.value).length }}</span>
            </div>
          </div>

          <div class="question-list">
            <div
              v-for="(q, index) in getQuestionsByType(selectedType)"
              :key="q.id"
              class="question-item"
            >
              <div class="question-main">
                <div class="question-header">
                  <span class="question-number">{{ index + 1 }}</span>
                  <el-input
                    v-model="q.content"
                    type="textarea"
                    :rows="2"
                    placeholder="请输入题目描述..."
                    @blur="handleSaveQuestion(q)"
                  />
                  <el-button size="small" link @click="handleDeleteQuestion(q)" class="btn-delete-icon">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>

                <div class="scoring-section">
                  <div class="scoring-header">
                    <span class="scoring-title">评分标准</span>
                    <el-popover
                      placement="bottom-start"
                      :width="360"
                      trigger="click"
                      v-model:visible="q.showScoringPopover"
                    >
                      <template #reference>
                        <el-button size="small" link class="scoring-btn">
                          {{ q.scoring_criteria ? '已配置' : '配置评分标准' }}
                        </el-button>
                      </template>
                      <div class="scoring-editor">
                        <el-input
                          v-model="q.scoring_criteria"
                          type="textarea"
                          :rows="6"
                          placeholder="请输入评分标准说明..."
                          @blur="handleSaveQuestion(q)"
                        />
                      </div>
                    </el-popover>
                  </div>

                  <div v-if="q.scoring_criteria" class="scoring-preview-text" :class="{ collapsed: !q.scoringExpanded }">
                    <div class="scoring-text-wrapper">
                      <span class="preview-label">评分标准：</span>
                      <span class="preview-text">{{ q.scoring_criteria }}</span>
                    </div>
                    <span class="scoring-toggle" @click="q.scoringExpanded = !q.scoringExpanded">
                      {{ q.scoringExpanded ? '收起' : '展开' }}
                    </span>
                  </div>
                </div>

                <div class="question-meta">
                  <span class="meta-tag">1-10分</span>
                  <span class="meta-tag required">必填</span>
                </div>
              </div>
            </div>

            <div v-if="getQuestionsByType(selectedType).length === 0" class="empty-questions">
              <p>该类型暂无题目</p>
              <el-button size="small" @click="handleAddQuestion">添加题目</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dimensionDialogVisible"
      :title="isEditingDimension ? '编辑维度' : '新增维度'"
      width="400px"
      destroy-on-close
    >
      <el-form :model="dimensionForm" label-position="top">
        <el-form-item label="维度名称" required>
          <el-input v-model="dimensionForm.name" placeholder="请输入维度名称" />
        </el-form-item>
        <el-form-item label="维度说明">
          <el-input
            v-model="dimensionForm.description"
            type="textarea"
            :rows="2"
            placeholder="请输入维度说明（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dimensionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveDimension">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="questionDialogVisible"
      title="新增题目"
      width="500px"
      destroy-on-close
    >
      <el-form :model="questionForm" label-position="top">
        <el-form-item label="题目类型" required>
          <el-select v-model="questionForm.type" placeholder="请选择题目类型" style="width: 100%">
            <el-option
              v-for="type in questionTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="题目内容" required>
          <el-input
            v-model="questionForm.content"
            type="textarea"
            :rows="3"
            placeholder="请输入题目描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="questionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveNewQuestion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Download, Upload } from '@element-plus/icons-vue'
import api from '../supabase'
import { getCurrentUser } from '../supabase'
import * as XLSX from 'xlsx'

const loading = ref(false)
const importing = ref(false)
const dimensions = ref([])
const questions = ref([])
const selectedDimension = ref(null)
const selectedType = ref('self')
const currentUser = ref({})
const isGuest = computed(() => currentUser.value?.role === 'guest')

const questionTypes = [
  { label: '自评', value: 'self' },
  { label: '他评', value: 'peer' },
  { label: '领导评', value: 'leader' }
]

const dimensionDialogVisible = ref(false)
const isEditingDimension = ref(false)
const dimensionForm = reactive({
  id: null,
  name: '',
  description: ''
})

const questionDialogVisible = ref(false)
const questionForm = reactive({
  type: 'self',
  content: ''
})

const getQuestionsByDimension = (dimensionId) => {
  return questions.value
    .filter(q => q.dimension_id === dimensionId)
    .sort((a, b) => a.sort_order - b.sort_order)
}

const getQuestionsByType = (type) => {
  if (!selectedDimension.value) return []
  return questions.value
    .filter(q => q.dimension_id === selectedDimension.value.id && q.type === type)
    .sort((a, b) => a.sort_order - b.sort_order)
}

const getQuestionCount = (dimensionId) => {
  return questions.value.filter(q => q.dimension_id === dimensionId).length
}

const selectDimension = (dim) => {
  selectedDimension.value = dim
  selectedType.value = 'self'
}

const handleAddDimension = () => {
  isEditingDimension.value = false
  Object.assign(dimensionForm, { id: null, name: '', description: '' })
  dimensionDialogVisible.value = true
}

const handleEditDimension = (dim) => {
  isEditingDimension.value = true
  Object.assign(dimensionForm, {
    id: dim.id,
    name: dim.name,
    description: dim.description || ''
  })
  dimensionDialogVisible.value = true
}

const handleSaveDimension = async () => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (!dimensionForm.name) {
    ElMessage.warning('请输入维度名称')
    return
  }

  try {
    if (isEditingDimension.value) {
      await api.updateDimension(dimensionForm.id, {
        name: dimensionForm.name,
        description: dimensionForm.description
      })
      const dim = dimensions.value.find(d => d.id === dimensionForm.id)
      if (dim) {
        dim.name = dimensionForm.name
        dim.description = dimensionForm.description
      }
      if (selectedDimension.value?.id === dimensionForm.id) {
        selectedDimension.value.name = dimensionForm.name
      }
      ElMessage.success('维度已更新')
    } else {
      const sortOrder = dimensions.value.length
      const newDim = await api.createDimension({
        name: dimensionForm.name,
        description: dimensionForm.description,
        sort_order: sortOrder,
        enabled: true
      })
      dimensions.value.push(newDim)
      ElMessage.success('维度已创建')
    }
    dimensionDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleToggleEnabled = async (dim) => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  try {
    await api.updateDimension(dim.id, { enabled: dim.enabled })
    ElMessage.success(dim.enabled ? '维度已启用' : '维度已禁用')
  } catch (err) {
    ElMessage.error(err.message)
    dim.enabled = !dim.enabled
  }
}

const handleDeleteDimension = async (dim) => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (getQuestionCount(dim.id) > 0) {
    ElMessage.warning('请先删除该维度下的所有题目')
    return
  }

  try {
    await api.deleteDimension(dim.id)
    dimensions.value = dimensions.value.filter(d => d.id !== dim.id)
    if (selectedDimension.value?.id === dim.id) {
      selectedDimension.value = dimensions.value[0] || null
    }
    ElMessage.success('维度已删除')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleAddQuestion = () => {
  if (!selectedDimension.value) {
    ElMessage.warning('请先选择维度')
    return
  }
  questionForm.type = selectedType.value
  questionForm.content = ''
  questionDialogVisible.value = true
}

const handleSaveNewQuestion = async () => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (!questionForm.content) {
    ElMessage.warning('请输入题目内容')
    return
  }

  try {
    const existingQuestions = getQuestionsByDimension(selectedDimension.value.id)
      .filter(q => q.type === questionForm.type)
    const newQ = await api.createQuestion({
      content: questionForm.content,
      dimension_id: selectedDimension.value.id,
      sort_order: existingQuestions.length,
      type: questionForm.type,
      scoring_criteria: ''
    })
    questions.value.push(newQ)
    questionDialogVisible.value = false
    ElMessage.success('题目已创建')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleSaveQuestion = async (q) => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (!q.content) {
    ElMessage.warning('题目内容不能为空')
    return
  }
  try {
    const updates = { content: q.content }
    if (q.scoring_criteria) {
      updates.scoring_criteria = q.scoring_criteria
    }
    await api.updateQuestion(q.id, updates)
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleDeleteQuestion = async (q) => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  try {
    await api.deleteQuestion(q.id)
    questions.value = questions.value.filter(item => item.id !== q.id)
    ElMessage.success('题目已删除')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

const handleExport = async () => {
  try {
    const exportData = []
    for (const dim of dimensions.value) {
      const qs = questions.value
        .filter(q => q.dimension_id === dim.id)
        .sort((a, b) => a.sort_order - b.sort_order)
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i]
        exportData.push({
          '维度': dim.name,
          '维度说明': dim.description || '',
          '题目类型': q.type === 'self' ? '自评' : q.type === 'peer' ? '他评' : '领导评',
          '题目序号': i + 1,
          '题目内容': q.content,
          '评分标准': q.scoring_criteria || ''
        })
      }
    }

    const csvHeader = ['维度', '维度说明', '题目类型', '题目序号', '题目内容', '评分标准']
    const csvRows = exportData.map(row =>
      csvHeader.map(h => {
        const val = row[h] || ''
        return `"${val.toString().replace(/"/g, '""')}"`
      }).join(',')
    )
    const csvContent = [csvHeader.join(','), ...csvRows].join('\n')

    const BOM = '\ufeff'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `能力评估题目_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败：' + err.message)
  }
}

const handleImportFile = async (file) => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  const reader = new FileReader()

  importing.value = true

  if (isExcel) {
    reader.readAsArrayBuffer(file.raw)
  } else {
    reader.readAsText(file.raw)
  }

  reader.onload = async (e) => {
    try {
      let data

      if (isExcel) {
        const workbook = XLSX.read(e.target.result, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
      } else {
        let text = e.target.result
        if (text.charCodeAt(0) === 0xFEFF || text.charCodeAt(0) === 0xFFFE) {
          text = text.slice(1)
        }
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        data = lines.map(line => {
          const values = []
          let current = ''
          let inQuotes = false
          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++
              } else {
                inQuotes = !inQuotes
              }
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          values.push(current.trim())
          return values
        })
      }

      if (data.length < 2) {
        ElMessage.warning('导入文件内容为空')
        return
      }

      const header = (data[0] || []).map(h => String(h).trim())
      const dimNameIdx = header.indexOf('维度')
      const dimDescIdx = header.indexOf('维度说明')
      const typeIdx = header.indexOf('题目类型')
      const contentIdx = header.indexOf('题目内容')
      const scoringIdx = header.indexOf('评分标准')

      const missingCols = []
      if (dimNameIdx === -1) missingCols.push('维度')
      if (contentIdx === -1) missingCols.push('题目内容')

      if (missingCols.length > 0) {
        console.error('Header received:', header)
        ElMessage.warning(`文件格式错误：缺少必要列（${missingCols.join('、')}）。请使用导出的模板文件。`)
        return
      }

      const dimMap = new Map()
      const newQuestions = []

      for (let i = 1; i < data.length; i++) {
        const row = data[i] || []
        const getVal = (idx) => {
          if (idx < 0 || idx >= row.length) return ''
          return String(row[idx] || '').trim()
        }

        const dimName = getVal(dimNameIdx)
        const dimDesc = getVal(dimDescIdx)
        const typeStr = getVal(typeIdx) || '自评'
        const content = getVal(contentIdx)
        const scoring = getVal(scoringIdx)

        if (!dimName || !content) continue

        if (!dimMap.has(dimName)) {
          dimMap.set(dimName, {
            name: dimName,
            description: dimDesc,
            sort_order: dimMap.size
          })
        }

        const type = typeStr === '他评' ? 'peer' : typeStr === '领导评' ? 'leader' : 'self'
        const scoring_criteria = scoring || ''

        const existingInDim = newQuestions.filter(q => q.dimension_name === dimName && q.type === type)
        newQuestions.push({
          dimension_name: dimName,
          content,
          type,
          sort_order: existingInDim.length,
          scoring_criteria
        })
      }

      if (newQuestions.length === 0) {
        ElMessage.warning('未找到有效题目数据')
        importing.value = false
        return
      }

      const confirmImport = await ElMessageBox.confirm(
        `将导入 ${dimMap.size} 个维度，${newQuestions.length} 道题目。是否继续？`,
        '确认导入',
        { confirmButtonText: '确认', cancelButtonText: '取消', type: 'info' }
      ).then(() => true).catch(() => false)

      if (!confirmImport) {
        importing.value = false
        return
      }

      const dimsToInsert = Array.from(dimMap.values())
      for (const dim of dimsToInsert) {
        try {
          const existing = dimensions.value.find(d => d.name === dim.name)
          if (existing) {
            dim.id = existing.id
          } else {
            const newDim = await api.createDimension(dim)
            dim.id = newDim.id
          }
        } catch (err) {
          console.error('维度创建失败:', err)
        }
      }

      let questionCount = 0
      for (const q of newQuestions) {
        const dim = Array.from(dimMap.values()).find(d => d.name === q.dimension_name)
        if (!dim || !dim.id) continue

        try {
          await api.createQuestion({
            content: q.content,
            dimension_id: dim.id,
            sort_order: q.sort_order,
            type: q.type,
            scoring_criteria: q.scoring_criteria
          })
          questionCount++
        } catch (err) {
          console.error('题目创建失败:', err)
        }
      }

      ElMessage.success(`导入成功：${dimsToInsert.length} 个维度，${questionCount} 道题目`)
      await loadData()
    } catch (err) {
      ElMessage.error('导入失败：' + err.message)
    } finally {
      importing.value = false
    }
  }
}

const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

const loadData = async () => {
  loading.value = true
  try {
    const [dims, qs] = await Promise.all([
      api.getDimensions(),
      api.getQuestions()
    ])
    dimensions.value = dims || []
    questions.value = (qs || []).map(q => ({
      ...q,
      scoring_criteria: q.scoring_criteria || '',
      showScoringPopover: false,
      scoringExpanded: false
    }))
    if (dimensions.value.length > 0 && !selectedDimension.value) {
      selectedDimension.value = dimensions.value[0]
    }
  } catch (err) {
    ElMessage.error('加载失败：' + err.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  currentUser.value = await getCurrentUser()
  loadData()
})
</script>

<style scoped>
.question-manage {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--padding-md);
  padding-bottom: calc(var(--bottom-nav-height) + var(--padding-xl));
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  margin-bottom: 16px;
  gap: var(--padding-md);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.page-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-serif);
}

.toolbar-right {
  display: flex;
  gap: var(--padding-sm);
}

.toolbar-right :deep(.el-button) {
  background: var(--card-bg) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
  border-radius: var(--border-radius-sm);
  height: 36px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-right :deep(.el-button:hover) {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

.toolbar-right :deep(.el-button--primary) {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  color: var(--accent) !important;
}

.toolbar-right :deep(.el-button--primary:hover) {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: var(--primary) !important;
}

.main-content {
  display: flex;
  gap: var(--padding-md);
  min-height: 500px;
}

.left-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--info-bg);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.right-panel {
  flex: 1;
  background: var(--card-bg);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--padding-md);
  border-bottom: 1px solid var(--border-color);
}

.panel-header > span {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.panel-header :deep(.el-button) {
  background: var(--warning-bg) !important;
  border: none !important;
  color: var(--accent) !important;
  border-radius: var(--border-radius-sm);
  height: 32px;
  width: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-header :deep(.el-button--primary) {
  width: auto !important;
  padding: 0 12px !important;
}

.panel-title-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.panel-subtitle {
  font-size: 12px;
  color: #9ca3af;
}

.type-tabs {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.type-tab {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  background: #f5f5f5;
  color: #666;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-tab:hover {
  background: #f0f0f0;
}

.type-tab.active {
  background: var(--color-primary);
  color: #ffffff;
}

.type-count {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(0,0,0,0.08);
  border-radius: 10px;
}

.type-tab.active .type-count {
  background: rgba(255, 255, 255, 0.2);
}

.dimension-list {
  padding: 8px;
}

.dimension-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}

.dimension-item:hover {
  background: var(--color-primary-light);
}

.dimension-item.active {
  background: var(--color-primary-light);
  border-left-color: var(--color-primary);
}

.dimension-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dimension-name {
  font-size: var(--font-sm);
  color: var(--color-text-primary);
  font-weight: 500;
}

.dimension-count {
  font-size: 12px;
  color: #9ca3af;
}

.dimension-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dimension-actions :deep(.el-switch) {
  --el-switch-off-color: #e5e6eb;
}

.btn-delete-icon {
  color: #9ca3af !important;
}

.btn-delete-icon:hover {
  color: #c0504d !important;
  background: rgba(192, 80, 77, 0.08) !important;
}

.question-panel {
  height: auto;
  min-height: 100%;
}

.question-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.question-item {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.question-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.question-number {
  width: 24px;
  height: 24px;
  background: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.question-header :deep(.el-textarea) {
  flex: 1;
}

.question-header :deep(.el-textarea__inner) {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  resize: none;
}

.scoring-section {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 12px;
}

.scoring-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.scoring-title {
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--color-text-primary);
}

.scoring-btn {
  font-size: 12px;
}

.scoring-editor {
  max-height: 300px;
  overflow-y: auto;
}

.scoring-preview-text {
  margin-top: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.scoring-preview-text.collapsed .scoring-text-wrapper {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scoring-text-wrapper {
  display: flex;
  gap: 4px;
}

.scoring-toggle {
  color: var(--color-primary);
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
  white-space: nowrap;
}

.scoring-toggle:hover {
  text-decoration: underline;
}

.preview-label {
  color: #666;
  font-weight: 500;
}

.preview-text {
  color: #333;
}

.question-meta {
  display: flex;
  gap: 8px;
}

.meta-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: #f0f0f0;
  color: #9ca3af;
  border-radius: 4px;
}

.meta-tag.required {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.empty-state-small {
  padding: 32px 16px;
  text-align: center;
  color: #9ca3af;
}

.empty-state-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  text-align: center;
  padding: 32px;
}

.empty-illustration {
  margin-bottom: 16px;
}

.empty-text {
  font-size: var(--font-md);
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.empty-questions {
  text-align: center;
  padding: 32px;
  color: #9ca3af;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-state {
  padding: 16px;
}

.skeleton-item {
  height: 60px;
  background: linear-gradient(90deg, #f5f5f5 25%, #e8e8e8 50%, #f5f5f5 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 8px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media screen and (max-width: 768px) {
  .main-content {
    flex-direction: column;
    min-height: auto;
  }

  .left-panel {
    width: 100%;
    max-height: 200px;
  }

  .right-panel {
    width: 100%;
    min-height: 400px;
    overflow: visible;
  }

  .type-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .question-list {
    max-height: none;
    padding: 12px;
    overflow: visible;
  }

  .question-item {
    background: #fafafa;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .question-panel {
    height: auto;
    min-height: 400px;
  }
}

@media screen and (max-width: 480px) {
  .main-content {
    display: flex;
    flex-direction: column;
  }

  .left-panel {
    width: 100%;
    height: auto;
    max-height: 180px;
    flex-shrink: 0;
  }

  .right-panel {
    width: 100%;
    height: auto;
    min-height: 500px;
    overflow: visible;
    flex: 1;
  }

  .question-panel {
    width: 100%;
    height: auto;
    min-height: 500px;
    overflow: visible;
  }

  .question-list {
    width: 100%;
    max-height: none;
    overflow: visible;
    display: flex;
    flex-direction: column;
    padding: 8px;
  }

  .question-item {
    width: 100%;
    display: block;
    overflow: visible;
  }
}
</style>
