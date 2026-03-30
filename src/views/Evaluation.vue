<template>
  <div class="evaluation">
    <div class="header">
      <h2>{{ evalTypeName }} - {{ task.target_name }}</h2>
      <el-tag :type="task.status === 'completed' ? 'success' : 'info'">
        {{ task.status === 'completed' ? '已完成' : '待填写' }}
      </el-tag>
    </div>

    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      加载中...
    </div>

    <div v-else class="content">
      <div class="progress">
        <el-progress :percentage="progressPercent" :status="progressPercent === 100 ? 'success' : ''" />
        <span>已填写 {{ answeredCount }} / {{ questions.length }} 题</span>
      </div>

      <div v-for="(dim, dimIdx) in dimensionGroups" :key="dimIdx" class="dimension-section">
        <h3 class="dimension-title">{{ dim.name }}</h3>
        
        <div v-for="q in dim.questions" :key="q.id" class="question-item">
          <div class="question-header">
            <span class="question-num">{{ q.sort_order + 1 }}.</span>
            <span class="question-content">{{ q.content }}</span>
          </div>

          <div class="scoring-criteria" v-if="q.scoring_criteria">
            <span class="criteria-label">评分标准：</span>
            <span class="criteria-text">{{ q.scoring_criteria }}</span>
          </div>

          <div class="score-section">
            <span class="score-label">评分：</span>
            <div class="score-buttons">
              <button
                v-for="n in 10"
                :key="n"
                class="score-btn"
                :class="{ active: answers[q.id].score === n, disabled: isViewMode }"
                :disabled="isViewMode"
                @click="answers[q.id].score = n"
              >{{ n }}</button>
            </div>
            <span class="score-value">{{ answers[q.id].score || '-' }}分</span>
          </div>

          <div class="reason-section" v-if="isSelfEval && answers[q.id].score >= 9">
            <span class="reason-label">高分原因（9-10分必填）：</span>
            <el-input 
              v-model="answers[q.id].reason" 
              type="textarea" 
              :rows="2" 
              placeholder="请说明为什么给这么高的分数"
              :disabled="isViewMode"
            />
          </div>

          <div class="reason-section" v-else>
            <span class="reason-label">备注（可选）：</span>
            <el-input 
              v-model="answers[q.id].reason" 
              type="textarea" 
              :rows="2" 
              placeholder="请输入备注"
              :disabled="isViewMode"
            />
          </div>
        </div>
      </div>

      <div class="actions" v-if="!isViewMode">
        <el-button size="large" @click="handleSave" :loading="saving">
          暂存
        </el-button>
        <el-button type="primary" size="large" @click="handleSubmit" :loading="submitting">
          提交评价
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import api, { getCurrentUser } from '../supabase'

const route = useRoute()
const router = useRouter()

const taskId = route.params.taskId
const isViewMode = route.query.view === '1'

const loading = ref(true)
const submitting = ref(false)
const saving = ref(false)
const task = ref({})
const questions = ref([])
const answers = ref({})

const loadTask = async () => {
  try {
    const currentUser = getCurrentUser() || {}
    const data = await api.getTaskDetail(taskId, currentUser)
    task.value = data.task
    questions.value = data.questions

    questions.value.forEach(q => {
      const existing = data.answers[q.id] || {}
      answers.value[q.id] = {
        score: existing.score || 5,
        reason: existing.reason || ''
      }
    })
  } catch (err) {
    ElMessage.error(err.message || '加载失败')
  } finally {
    loading.value = false
  }
}

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

const answeredCount = computed(() => {
  return Object.values(answers.value).filter(a => a.score > 0).length
})

const progressPercent = computed(() => {
  return Math.round((answeredCount.value / questions.value.length) * 100)
})

const evalTypeName = computed(() => {
  const map = { self: '自评', peer: '他评', leader: '领导评价' }
  return map[task.value.eval_type] || '评价'
})

const isSelfEval = computed(() => task.value.eval_type === 'self')

const handleSubmit = async () => {
  if (isSelfEval.value) {
    for (const q of questions.value) {
      const answer = answers.value[q.id]
      if (answer.score >= 9 && !answer.reason.trim()) {
        ElMessage.warning(`题目"${q.content.substring(0, 20)}..."评分9-10分，请填写原因`)
        return
      }
    }
  }

  submitting.value = true
  try {
    const currentUser = getCurrentUser() || {}
    const answerList = Object.entries(answers.value).map(([questionId, data]) => ({
      questionId: parseInt(questionId),
      score: data.score,
      reason: data.reason
    }))

    await api.submitAnswers(parseInt(taskId), answerList, currentUser)
    ElMessage.success('提交成功')
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
    const answerList = Object.entries(answers.value).map(([questionId, data]) => ({
      questionId: parseInt(questionId),
      score: data.score,
      reason: data.reason
    }))

    await api.saveAnswers(parseInt(taskId), answerList)
    ElMessage.success('暂存成功')
    router.push('/tasks')
  } catch (err) {
    ElMessage.error(err.message || '暂存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadTask)
</script>

<style scoped>
/* ============================================
   页面容器
   ============================================ */
.evaluation {
  background: white;
  padding: var(--padding-md);
  border-radius: var(--border-radius-base);
  max-width: 100%;
  overflow-x: hidden;
}

/* ============================================
   页面头部
   ============================================ */
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

/* ============================================
   加载状态
   ============================================ */
.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-tertiary);
}

/* ============================================
   进度条
   ============================================ */
.progress {
  display: flex;
  align-items: center;
  gap: var(--margin-md);
  margin-bottom: var(--margin-lg);
  flex-wrap: wrap;
}

.progress .el-progress {
  flex: 1;
  min-width: 150px;
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
   题目项
   ============================================ */
.question-item {
  background: white;
  padding: var(--padding-md);
  margin-bottom: var(--margin-sm);
  border-radius: var(--border-radius-sm);
  border: 1px solid #ebeef5;
}

.question-header {
  display: flex;
  margin-bottom: var(--margin-sm);
  flex-wrap: wrap;
}

.question-num {
  color: #409eff;
  font-weight: bold;
  margin-right: var(--padding-xs);
}

.question-content {
  color: #303133;
  line-height: 1.6;
  flex: 1;
  min-width: 200px;
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
   评分区域
   ============================================ */
.score-section {
  display: flex;
  align-items: center;
  gap: var(--margin-sm);
  margin-bottom: var(--margin-sm);
  flex-wrap: wrap;
}

.score-label {
  color: #606266;
  min-width: 60px;
  font-size: var(--font-size-sm);
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

.score-btn:hover:not(.disabled):not(.active) {
  border-color: #409eff;
  color: #409eff;
}

.score-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.score-btn.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.score-value {
  color: #409eff;
  font-weight: bold;
  min-width: 40px;
  font-size: var(--font-size-sm);
}

/* ============================================
   备注区域
   ============================================ */
.reason-section {
  margin-top: var(--margin-sm);
}

.reason-label {
  display: block;
  color: #606266;
  margin-bottom: var(--padding-xs);
  font-size: var(--font-size-sm);
}

/* ============================================
   提交按钮
   ============================================ */
.actions {
  text-align: center;
  padding: var(--padding-lg) 0;
}

/* ============================================
   响应式 - 平板 (769px - 1024px)
   ============================================ */
@media screen and (max-width: 1024px) {
  .header h2 {
    font-size: var(--font-size-lg);
  }

  .dimension-title {
    font-size: var(--font-size-sm);
  }
}

/* ============================================
   响应式 - 移动端 (≤768px)
   ============================================ */
@media screen and (max-width: 768px) {
  .header h2 {
    font-size: var(--font-size-lg);
  }

  .dimension-section {
    padding: var(--padding-base);
  }

  .question-item {
    padding: var(--padding-base);
  }

  .progress {
    flex-direction: column;
    align-items: stretch;
  }

  .progress .el-progress {
    width: 100%;
  }
}

/* ============================================
   响应式 - 超小屏幕 (≤480px)
   ============================================ */
@media screen and (max-width: 480px) {
  .evaluation {
    padding: var(--padding-base);
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header h2 {
    font-size: var(--font-size-md);
  }

  .dimension-section {
    padding: var(--padding-sm);
  }

  .question-item {
    padding: var(--padding-sm);
  }

  .score-label {
    min-width: auto;
  }

  .question-content {
    min-width: 150px;
  }

  .scoring-criteria {
    padding: var(--padding-xs) var(--padding-sm);
  }
}
</style>
