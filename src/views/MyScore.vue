<template>
  <div class="my-score-container">
    <div class="page-header">
      <h2>我的评分</h2>
      <el-tag type="primary" v-if="period">Q{{ period.quarter }} {{ period.year }}</el-tag>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton-row" v-for="i in 3" :key="i"></div>
    </div>

    <div v-else-if="error" class="error-box">
      <el-icon><CircleCloseFilled /></el-icon>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="hasData" class="score-content">
      <div class="score-summary">
        <div class="summary-card total">
          <div class="summary-label">综合评分</div>
          <div class="summary-value">{{ displayScores.total_score }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">自评</div>
          <div class="summary-value">{{ displayScores.self_score }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">他评</div>
          <div class="summary-value">{{ displayScores.peer_score }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">领导评</div>
          <div class="summary-value">{{ displayScores.leader_score }}</div>
        </div>
      </div>

      <div class="dimension-tabs">
        <div
          v-for="type in ['self', 'peer', 'leader']"
          :key="type"
          class="dimension-tab"
          :class="{ active: activeTab === type }"
          @click="activeTab = type"
        >
          {{ typeName[type] }}
        </div>
      </div>

      <div class="dimension-list">
        <div
          v-for="(dim, index) in currentDimensions"
          :key="index"
          class="dimension-item"
        >
          <div class="dimension-name">{{ dim.dimension_name }}</div>
          <div class="dimension-score" :class="{ 'has-score': dim.score !== null }">
            {{ dim.score !== null ? dim.score.toFixed(1) : '-' }}
          </div>
        </div>
      </div>

      <div class="radar-section" v-if="radarData">
        <h3 class="section-title">能力雷达图</h3>
        <v-chart :option="radarOption" style="height: 350px" autoresize />
      </div>
    </div>

    <div v-else class="no-data">
      <el-empty description="暂无评分数据" />
      <p class="empty-hint">完成评价任务后将显示您的评分</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { CircleCloseFilled } from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import api from '../supabase'

use([CanvasRenderer, RadarChart, TitleComponent, TooltipComponent])

const loading = ref(true)
const error = ref(null)
const scoreData = ref(null)
const radarData = ref(null)
const period = ref(null)
const activeTab = ref('self')

const typeName = {
  self: '自评',
  peer: '他评',
  leader: '领导评'
}

const displayScores = computed(() => {
  if (!scoreData.value?.scores) {
    return { total_score: '-', self_score: '-', peer_score: '-', leader_score: '-' }
  }
  const s = scoreData.value.scores
  return {
    total_score: s.total_score !== null && s.total_score !== undefined ? s.total_score.toFixed(1) : '-',
    self_score: s.self_score !== null && s.self_score !== undefined ? s.self_score.toFixed(1) : '-',
    peer_score: s.peer_score !== null && s.peer_score !== undefined ? s.peer_score.toFixed(1) : '-',
    leader_score: s.leader_score !== null && s.leader_score !== undefined ? s.leader_score.toFixed(1) : '-'
  }
})

const hasData = computed(() => {
  if (!scoreData.value) return false
  const s = scoreData.value.scores
  return s && (s.self_score !== null || s.peer_score !== null || s.leader_score !== null)
})

const currentDimensions = computed(() => {
  if (!scoreData.value?.dimensions) return []
  return scoreData.value.dimensions[activeTab.value] || []
})

const radarOption = computed(() => {
  if (!radarData.value || !scoreData.value?.dimensions) return {}
  const dims = scoreData.value.dimensions.self || []
  const values = dims.map(d => d.score !== null ? d.score.toFixed(1) : 0)
  const indicators = dims.map(d => ({ name: d.dimension_name, max: 10 }))
  return {
    tooltip: {},
    radar: {
      indicator: indicators,
      radius: '65%'
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '综合得分',
        areaStyle: { opacity: 0.3 },
        lineStyle: { width: 2 }
      }]
    }]
  }
})

const loadData = async () => {
  loading.value = true
  error.value = null
  try {
    period.value = await api.getCurrentPeriod()
    scoreData.value = await api.getScore()
    if (hasData.value) {
      radarData.value = await api.getRadar()
    }
  } catch (err) {
    error.value = err.message || '获取评分失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.my-score-container {
  padding: var(--padding-md);
  background: white;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--margin-md);
}

.page-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-family: var(--font-serif);
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--padding-md);
}

.skeleton-row {
  height: 80px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--border-radius-base);
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.error-box {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  color: #f56c6c;
  padding: var(--padding-lg);
  background: #fef0f0;
  border-radius: var(--border-radius-base);
}

.score-content {
  display: flex;
  flex-direction: column;
  gap: var(--padding-md);
}

.score-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--padding-sm);
}

.summary-card {
  background: #f8f9fb;
  border-radius: var(--border-radius-base);
  padding: var(--padding-sm);
  text-align: center;
}

.summary-card.total {
  background: var(--primary);
  color: white;
}

.summary-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-card.total .summary-label {
  color: rgba(255, 255, 255, 0.7);
}

.summary-value {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.summary-card.total .summary-value {
  color: var(--accent);
}

.dimension-tabs {
  display: flex;
  gap: var(--padding-xs);
  background: var(--info-bg);
  padding: var(--padding-xs);
  border-radius: 20px;
}

.dimension-tab {
  flex: 1;
  padding: var(--padding-xs) var(--padding-sm);
  border-radius: 16px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.dimension-tab:hover {
  background: rgba(0, 0, 0, 0.04);
}

.dimension-tab.active {
  background: var(--primary);
  color: white;
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: var(--padding-xs);
}

.dimension-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--padding-sm) var(--padding-md);
  background: var(--info-bg);
  border-radius: var(--border-radius-sm);
}

.dimension-name {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.dimension-score {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  font-weight: 500;
}

.dimension-score.has-score {
  color: var(--primary);
  font-weight: 600;
}

.radar-section {
  margin-top: var(--padding-md);
  background: var(--info-bg);
  border-radius: var(--border-radius);
  padding: var(--padding-md);
}

.section-title {
  margin: 0 0 var(--padding-sm) 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 600;
}

.no-data {
  padding: var(--padding-xl) 0;
  text-align: center;
}

.empty-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  margin-top: var(--padding-sm);
}

@media screen and (max-width: 768px) {
  .score-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-value {
    font-size: 18px;
  }

  .radar-section :deep(.v-chart) {
    height: 280px !important;
  }
}

@media screen and (max-width: 480px) {
  .my-score-container {
    padding: var(--padding-sm);
  }

  .page-header {
    flex-direction: column;
    gap: var(--padding-xs);
    align-items: flex-start;
  }

  .score-summary {
    gap: 6px;
  }

  .summary-card {
    padding: 8px 4px;
  }

  .summary-label {
    font-size: 10px;
  }

  .summary-value {
    font-size: 18px;
  }

  .dimension-tabs {
    gap: 4px;
    padding: 4px;
    border-radius: 20px;
    height: auto;
    min-height: unset;
  }

  .dimension-tab {
    flex: 1;
    padding: 6px 8px;
    font-size: 12px;
    border-radius: 16px;
    width: auto;
  }

  .dimension-tab.active {
    background: var(--primary);
    color: white;
  }

  .radar-section {
    margin-top: var(--padding-sm);
  }

  .radar-section .section-title {
    font-size: 14px;
    margin-bottom: var(--padding-xs);
  }

  .radar-section :deep(.v-chart) {
    height: 220px !important;
  }
}
</style>
