<template>
  <div class="batch-evaluation">
    <div class="header">
      <h2>批量互评 - {{ period.year }}年第{{ period.quarter }}季度</h2>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      加载中...
    </div>

    <div v-else-if="tasks.length === 0" class="empty-state">
      <el-empty description="暂无待填写的互评任务" />
      <el-button type="primary" @click="router.push('/tasks')">返回任务列表</el-button>
    </div>

    <div v-else class="content">
      <!-- 按维度分组 -->
      <div v-for="(dim, dimIdx) in dimensionGroups" :key="dimIdx" class="dimension-section">
        <h3 class="dimension-title">{{ dim.name }}</h3>

        <!-- 每道题一个卡片 -->
        <div v-for="q in dim.questions" :key="q.id" class="question-card">
          <div class="question-info">
            <span class="question-num">{{ q.sort_order + 1 }}.</span>
            <span class="question-text">{{ q.content }}</span>
          </div>

          <div class="scoring-criteria" v-if="q.scoring_criteria">
            <span class="criteria-label">评分标准：</span>
            <span class="criteria-text">{{ q.scoring_criteria }}</span>
          </div>

          <!-- 评分列表 -->
          <div class="score-list">
            <div v-for="task in tasks" :key="task.id" class="score-row">
              <span class="person-name">{{ task.target_name }}</span>
              <div class="score-buttons">
                <button
                  v-for="n in 10"
                  :key="n"
                  class="score-btn"
                  :class="{ active: getScore(task.id, q.id) === n }"
                  @click="setScore(task.id, q.id, n)"
                >{{ n }}</button>
              </div>
              <span class="score-value">{{ getScore(task.id, q.id) || '-' }}分</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部固定操作栏 -->
    <div v-if="tasks.length > 0" class="bottom-bar">
      <div class="bottom-bar-info">
        <el-progress :percentage="progressPercent" :status="progressPercent === 100 ? 'success' : ''" :stroke-width="8" />
        <span class="bottom-bar-text">已填写 {{ answeredCount }} / {{ totalCount }} 题</span>
      </div>
      <div class="bottom-bar-actions">
        <el-button size="large" @click="handleSave" :loading="saving">暂存</el-button>
        <el-button type="primary" size="large" @click="handleSubmit" :loading="submitting">提交评价</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import api, { getCurrentUser } from '../supabase'

const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const saving = ref(false)

const questions = ref([])
const tasks = ref([])
const answers = reactive({})
const period = ref({ year: 2026, quarter: 1 })

const loadData = async () => {
  try {
    const data = await api.getPendingPeerTasks()

    questions.value = data.questions
    tasks.value = data.tasks
    period.value = data.period || period.value

    // 初始化 answers 结构
    tasks.value.forEach(task => {
      answers[task.id] = {}
      questions.value.forEach(q => {
        const existing = data.answersMap[task.id]?.[q.id]
        answers[task.id][q.id] = {
          score: existing?.score || 0,
          reason: existing?.reason || ''
        }
      })
    })
  } catch (err) {
    ElMessage.error(err.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

const dimensionGroups = computed(() => {
  const groups = {}
  questions.value.forEach(q => {
    if (!groups[q.dimension_name]) {
      groups[q.dimension_name] = { name: q.dimension_name, questions: [] }
    }
    groups[q.dimension_name].questions.push(q)
  })
  return Object.values(groups)
})

const getScore = (taskId, questionId) => {
  return answers[taskId]?.[questionId]?.score || 0
}

const setScore = (taskId, questionId, score) => {
  if (answers[taskId]?.[questionId]) {
    answers[taskId][questionId].score = score
  }
}

const answeredCount = computed(() => {
  let count = 0
  tasks.value.forEach(task => {
    count += Object.values(answers[task.id] || {}).filter(a => a.score > 0).length
  })
  return count
})

const totalCount = computed(() => {
  return tasks.value.length * questions.value.length
})

const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((answeredCount.value / totalCount.value) * 100)
})

const buildTaskAnswersList = () => {
  return tasks.value.map(task => ({
    taskId: task.id,
    answers: questions.value.map(q => ({
      questionId: q.id,
      score: answers[task.id][q.id].score,
      reason: answers[task.id][q.id].reason
    }))
  }))
}

const handleSubmit = async () => {
  const unanswered = []
  tasks.value.forEach(task => {
    const unansweredQuestions = questions.value.filter(q => !answers[task.id][q.id].score)
    if (unansweredQuestions.length > 0) {
      unanswered.push(`${task.target_name}（${unansweredQuestions.length}题未填）`)
    }
  })

  if (unanswered.length > 0) {
    try {
      await ElMessageBox.confirm(
        `以下被评价人有未填写的题目：\n${unanswered.join('\n')}\n\n确定要提交吗？未评分的题目将不计分。`,
        '提示',
        { confirmButtonText: '继续提交', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }

  submitting.value = true
  try {
    const taskAnswersList = buildTaskAnswersList()
    await api.submitBatchAnswers(taskAnswersList)
    ElMessage.success('批量提交成功')
    router.push('/tasks')
  } catch (err) {
    ElMessage.error(err.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const taskAnswersList = buildTaskAnswersList()
    await api.saveBatchAnswers(taskAnswersList)
    ElMessage.success('批量暂存成功')
    router.push('/tasks')
  } catch (err) {
    ElMessage.error(err.message || '暂存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.batch-evaluation {
  background: white;
  padding: var(--padding-md);
  padding-bottom: 80px;
  border-radius: var(--border-radius-base);
  max-width: 100%;
  overflow-x: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--margin-md);
  flex-wrap: wrap;
  gap: var(--margin-sm);
}

.header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-tertiary);
}

.empty-state {
  text-align: center;
  padding: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--margin-md);
}

/* ============================================
   维度区块
   ============================================ */
.dimension-section {
  margin-bottom: var(--margin-lg);
  padding: var(--padding-md);
  background: var(--info-bg);
  border-radius: var(--border-radius);
}

.dimension-title {
  margin: 0 0 var(--margin-md) 0;
  color: #303133;
  font-size: var(--font-size-md);
  border-left: 4px solid #409eff;
  padding-left: var(--padding-base);
}

/* ============================================
   题目卡片
   ============================================ */
.question-card {
  background: white;
  padding: var(--padding-md);
  margin-bottom: var(--margin-md);
  border-radius: var(--border-radius-sm);
  border: 1px solid #ebeef5;
}

.question-card:last-child {
  margin-bottom: 0;
}

.question-info {
  display: flex;
  margin-bottom: var(--margin-sm);
}

.question-num {
  color: #409eff;
  font-weight: bold;
  margin-right: var(--padding-xs);
  flex-shrink: 0;
}

.question-text {
  color: #303133;
  line-height: 1.6;
  font-size: var(--font-size-sm);
}

.scoring-criteria {
  background: #f5f7fa;
  border-radius: 8px;
  padding: var(--padding-sm) var(--padding-md);
  margin-bottom: var(--margin-sm);
  border-left: 3px solid var(--primary);
}

.criteria-label {
  font-weight: 600;
  color: #606266;
  font-size: 12px;
}

.criteria-text {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* ============================================
   评分列表
   ============================================ */
.score-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: var(--margin-sm);
  padding: 6px 0;
  flex-wrap: wrap;
}

.person-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  min-width: 60px;
}

.score-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.score-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.score-btn:hover:not(.active) {
  border-color: #409eff;
  color: #409eff;
}

.score-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.score-value {
  color: #409eff;
  font-weight: bold;
  min-width: 40px;
  font-size: var(--font-size-sm);
}

/* ============================================
   底部固定操作栏
   ============================================ */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width);
  right: 0;
  z-index: 100;
  background: white;
  border-top: 1px solid #ebeef5;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--padding-md);
  gap: var(--margin-md);
}

.bottom-bar-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--margin-sm);
  min-width: 0;
}

.bottom-bar-info .el-progress {
  flex: 1;
  min-width: 100px;
  max-width: 300px;
}

.bottom-bar-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  white-space: nowrap;
}

.bottom-bar-actions {
  display: flex;
  gap: var(--margin-sm);
  flex-shrink: 0;
}

/* ============================================
   响应式
   ============================================ */
@media screen and (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .score-btn {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .bottom-bar {
    left: 0;
    padding: 10px var(--padding-base);
    bottom: var(--bottom-nav-height, 0);
  }

  .bottom-bar-info .el-progress {
    max-width: 150px;
  }

  .batch-evaluation {
    padding-bottom: 90px;
  }
}

@media screen and (max-width: 480px) {
  .batch-evaluation {
    padding: var(--padding-base);
  }

  .header h2 {
    font-size: var(--font-size-md);
  }

  .dimension-section {
    padding: var(--padding-base);
  }

  .question-card {
    padding: var(--padding-base);
  }
}
</style>
