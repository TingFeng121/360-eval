<template>
  <div class="weight-config">
    <h2>权重配置</h2>
    
    <el-form :model="form" label-width="120px" class="weight-form">
      <el-form-item label="评分制度">
        <el-radio-group v-model="form.score_type" :disabled="!isAdmin">
          <el-radio value="10">10分制 (1-10分)</el-radio>
          <el-radio value="100">百分制 (1-100分)</el-radio>
        </el-radio-group>
      </el-form-item>
      
      <el-form-item label="自评权重">
        <el-slider v-model="form.self_weight" :min="0" :max="1" :step="0.05" :format-tooltip="formatPercent" :disabled="!isAdmin" />
        <span class="weight-value">{{ (form.self_weight * 100).toFixed(0) }}%</span>
      </el-form-item>
      
      <el-form-item label="他评权重">
        <el-slider v-model="form.peer_weight" :min="0" :max="1" :step="0.05" :format-tooltip="formatPercent" :disabled="!isAdmin" />
        <span class="weight-value">{{ (form.peer_weight * 100).toFixed(0) }}%</span>
      </el-form-item>
      
      <el-form-item label="领导评权重">
        <el-slider v-model="form.leader_weight" :min="0" :max="1" :step="0.05" :format-tooltip="formatPercent" :disabled="!isAdmin" />
        <span class="weight-value">{{ (form.leader_weight * 100).toFixed(0) }}%</span>
      </el-form-item>
      
      <el-form-item label="权重合计">
        <el-tag :type="totalWeight === 1 ? 'success' : 'danger'">
          {{ (totalWeight * 100).toFixed(0) }}% {{ totalWeight === 1 ? '✓' : '(需为100%)' }}
        </el-tag>
      </el-form-item>
      
      <el-form-item v-if="isAdmin">
        <el-button type="primary" @click="handleSave" :disabled="totalWeight !== 1">保存配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api, { getCurrentUser } from '../supabase'

const isAdmin = computed(() => {
  const user = getCurrentUser() || {}
  return user.role === 'admin'
})

const isGuest = computed(() => {
  const user = getCurrentUser() || {}
  return user.role === 'guest'
})

const form = reactive({
  self_weight: 0.3,
  peer_weight: 0.3,
  leader_weight: 0.4,
  score_type: '10'
})

const totalWeight = computed(() => {
  return form.self_weight + form.peer_weight + form.leader_weight
})

const formatPercent = (val) => `${(val * 100).toFixed(0)}%`

const loadConfig = async () => {
  const config = await api.getWeight()
  Object.assign(form, config)
}

const handleSave = async () => {
  if (isGuest.value) return ElMessage.warning('访客无权操作')
  if (totalWeight.value !== 1) {
    return ElMessage.warning('权重合计需为100%')
  }
  try {
    await api.updateWeight(form)
    ElMessage.success('配置保存成功')
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  }
}

onMounted(loadConfig)
</script>

<style scoped>
/* ============================================
   页面容器
   ============================================ */
.weight-config {
  background: white;
  padding: var(--padding-lg);
  border-radius: var(--border-radius-base);
  max-width: 600px;
  max-width: 100%;
  overflow-x: hidden;
}

.weight-config h2 {
  margin: 0 0 var(--margin-lg) 0;
  font-size: var(--font-size-xl);
}

/* ============================================
   表单样式
   ============================================ */
.weight-form {
  margin-top: var(--margin-md);
  max-width: 100%;
}

.weight-form :deep(.el-form-item) {
  margin-bottom: var(--margin-md);
}

.weight-form :deep(.el-slider) {
  flex: 1;
  min-width: 150px;
}

.weight-value {
  display: inline-block;
  width: 60px;
  text-align: right;
  color: #409eff;
  font-weight: bold;
  font-size: var(--font-size-sm);
}

/* ============================================
   响应式 - 平板 (769px - 1024px)
   ============================================ */
@media screen and (max-width: 1024px) {
  .weight-config h2 {
    font-size: var(--font-size-lg);
  }
}

/* ============================================
   响应式 - 移动端 (≤768px)
   ============================================ */
@media screen and (max-width: 768px) {
  .weight-config {
    padding: var(--padding-md);
  }

  .weight-config h2 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--margin-md);
  }

  .weight-form :deep(.el-form-item__label) {
    float: none;
    text-align: left;
    padding: 0 0 var(--padding-sm) 0;
  }

  .weight-form :deep(.el-form-item__content) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--padding-sm);
  }

  .weight-value {
    text-align: left;
    width: auto;
  }
}

/* ============================================
   响应式 - 超小屏幕 (≤480px)
   ============================================ */
@media screen and (max-width: 480px) {
  .weight-config {
    padding: var(--padding-base);
  }

  .weight-config h2 {
    font-size: var(--font-size-md);
    margin-bottom: var(--margin-base);
  }
}
</style>
