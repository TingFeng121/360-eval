<template>
  <div class="my-score-container">
    <div class="page-header">
      <h2>我的评分</h2>
      <div class="period-selector">
        <el-select v-model="selectedPeriod" placeholder="选择季度" @change="loadData">
          <el-option
            v-for="p in availablePeriods"
            :key="p.value"
            :label="`Q${p.quarter} ${p.year}`"
            :value="p.value"
          />
        </el-select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton-row" v-for="i in 3" :key="i"></div>
    </div>

    <div v-else-if="error" class="error-box">
      <el-icon><CircleCloseFilled /></el-icon>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="hasData" class="score-content">
      <div class="score-overview">
        <div class="score-cell total">
          <div class="score-label">综合</div>
          <div class="score-value">{{ displayScores.total_score }}</div>
        </div>
        <template v-for="(dim, idx) in scoreData?.dimension_scores" :key="'div-' + dim.dimension_name">
          <div class="score-divider"></div>
          <div class="score-cell">
            <div class="score-label">{{ dim.dimension_name }}</div>
            <div class="score-value">{{ dim.score !== null ? dim.score.toFixed(1) : '-' }}</div>
          </div>
        </template>
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
import { getCurrentUser } from '../supabase'

use([CanvasRenderer, RadarChart, TitleComponent, TooltipComponent])

const loading = ref(true)
const error = ref(null)
const scoreData = ref(null)
const radarData = ref(null)
const period = ref(null)
const activeTab = ref('self')
const selectedPeriod = ref(null)
const availablePeriods = ref([])

const typeName = {
  self: '自评',
  peer: '他评',
  leader: '领导评'
}

const displayScores = computed(() => {
  if (!scoreData.value) {
    return { total_score: '-', self_score: '-', peer_score: '-', leader_score: '-' }
  }
  const s = scoreData.value
  return {
    total_score: s.total_score !== null && s.total_score !== undefined ? s.total_score.toFixed(1) : '-',
    self_score: s.self_score !== null && s.self_score !== undefined ? s.self_score.toFixed(1) : '-',
    peer_score: s.peer_score !== null && s.peer_score !== undefined ? s.peer_score.toFixed(1) : '-',
    leader_score: s.leader_score !== null && s.leader_score !== undefined ? s.leader_score.toFixed(1) : '-'
  }
})

const hasData = computed(() => {
  if (!scoreData.value) return false
  const s = scoreData.value
  return s && (s.self_score !== null || s.peer_score !== null || s.leader_score !== null)
})

const currentDimensions = computed(() => {
  if (!scoreData.value?.dimensions) return []
  return scoreData.value.dimensions[activeTab.value] || []
})

const radarOption = computed(() => {
  if (!scoreData.value?.dimensions?.self) return {}
  const dims = scoreData.value.dimensions.self
  const values = dims.map(d => d.score !== null ? d.score : 0)
  const indicators = dims.map((d, idx) => ({
    name: `{dimName|${d.dimension_name}}\n{score|${d.score !== null ? d.score.toFixed(1) : '-'}}`,
    max: 10,
    axisLabel: {
      show: idx === 0,
      color: '#666',
      fontSize: 10,
      margin: 4
    }
  }))
  return {
    radar: {
      indicator: indicators,
      radius: '60%',
      splitNumber: 5,
      min: 5,
      axisName: {
        color: '#333',
        fontSize: 12,
        rich: {
          dimName: { color: '#333', fontSize: 12 },
          score: { color: '#22c55e', fontSize: 16, fontWeight: 'bold' }
        }
      },
      splitLine: { lineStyle: { color: '#ccc' } },
      splitArea: { show: false }
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '得分',
        itemStyle: { color: '#4a9e8c' },
        areaStyle: { opacity: 0.2 },
        lineStyle: { width: 2 },
        label: { show: false }
      }]
    }]
  }
})

const loadData = async () => {
  loading.value = true
  error.value = null
  try {
    // 获取当前季度作为默认
    const currentPeriod = await api.getCurrentPeriod()
    if (!selectedPeriod.value) {
      selectedPeriod.value = `${currentPeriod.year}-${currentPeriod.quarter}`
    }

    // 生成可用季度列表（当前季度往前6个季度）
    availablePeriods.value = []
    for (let i = 0; i < 6; i++) {
      let year = currentPeriod.year
      let quarter = currentPeriod.quarter - i
      while (quarter <= 0) {
        quarter += 4
        year -= 1
      }
      availablePeriods.value.push({
        year,
        quarter,
        value: `${year}-${quarter}`
      })
    }

    // 解析选中的季度
    const [year, quarter] = selectedPeriod.value.split('-').map(Number)
    period.value = { year, quarter }

    // 根据是否有选择加载数据
    const isCurrentPeriod = year === currentPeriod.year && quarter === currentPeriod.quarter
    if (isCurrentPeriod) {
      scoreData.value = await api.getScore()
    } else {
      scoreData.value = await api.getScoreByPeriod(null, year, quarter)
    }

    radarData.value = scoreData.value
  } catch (err) {
    console.error('获取评分失败:', err)
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
  flex-wrap: wrap;
  gap: var(--padding-sm);
}

.page-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-family: var(--font-serif);
}

.period-selector {
  min-width: 150px;
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

.score-overview {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--border-radius);
  padding: var(--padding-md);
  color: white;
}

.score-cell {
  flex: 1;
  text-align: center;
  padding: 0 var(--padding-sm);
}

.score-cell.total {
  flex: 1.2;
}

.score-label {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: var(--padding-xs);
}

.score-value {
  font-size: 28px;
  font-weight: bold;
  color: white;
}

.score-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
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
  .score-overview {
    flex-wrap: wrap;
    gap: var(--padding-sm);
  }

  .score-cell {
    min-width: calc(33.33% - var(--padding-sm));
  }

  .score-cell.total {
    min-width: 100%;
  }

  .score-divider {
    display: none;
  }

  .score-value {
    font-size: 22px;
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

  .score-overview {
    padding: var(--padding-sm);
  }

  .score-cell {
    min-width: calc(50% - var(--padding-xs));
    padding: 0;
  }

  .score-value {
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
