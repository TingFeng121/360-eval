<template>
  <div class="summary">
    <div class="header">
      <h2>数据汇总 - {{ period.year }}年第{{ period.quarter }}季度</h2>
      <div class="header-buttons">
        <el-button @click="exportTable">导出表格</el-button>
        <el-button @click="exportRadarPdf">导出雷达图PDF</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="summary-tabs">
      <el-tab-pane label="总分排名" name="ranking"></el-tab-pane>
      <el-tab-pane label="维度明细" name="detail"></el-tab-pane>
      <el-tab-pane label="能力雷达图" name="radar"></el-tab-pane>
    </el-tabs>

    <div v-if="activeTab === 'ranking'">
      <div class="ranking-card-list">
        <div
          v-for="(row, index) in summaryData"
          :key="row.user_id"
          class="ranking-item-card"
          @click="viewRadar(row.user_id)"
        >
          <div class="ranking-left">
            <div class="ranking-badge">{{ index + 1 }}</div>
            <div class="ranking-user-info">
              <div class="ranking-name">{{ row.user_name }}</div>
              <div class="ranking-dept">{{ row.department || '' }}</div>
            </div>
          </div>
          <div class="ranking-right">
            <div class="ranking-score">{{ row.total_score?.toFixed(2) || '-' }}</div>
            <el-button size="small" round class="ranking-btn">查看雷达图</el-button>
          </div>
        </div>
      </div>

      <el-table :data="summaryData" border class="responsive-table summary-table ranking-desktop-table" :scrollbar-always-on="true" :row-class-name="getRowClassName">
        <el-table-column prop="user_name" label="姓名" min-width="160" max-width="160" show-overflow-tooltip />
        <el-table-column prop="department" label="部门" min-width="120" max-width="120" show-overflow-tooltip />
        <el-table-column prop="self_score" label="自评得分" width="100">
          <template #default="{ row }"><span class="score-text" :class="{ 'zero-score': row.self_score === 0 }">{{ row.self_score?.toFixed(2) || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="peer_score" label="他评得分" width="100">
          <template #default="{ row }"><span class="score-text" :class="{ 'zero-score': row.peer_score === 0 }">{{ row.peer_score?.toFixed(2) || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="leader_score" label="领导评得分" width="100">
          <template #default="{ row }"><span class="score-text" :class="{ 'zero-score': row.leader_score === 0 }">{{ row.leader_score?.toFixed(2) || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="total_score" label="综合得分" width="120" class-name="total-score-column">
          <template #default="{ row }"><span class="total-score">{{ row.total_score?.toFixed(2) || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }"><el-button size="small" class="radar-btn" @click="viewRadar(row.user_id)">查看雷达图</el-button></template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="activeTab === 'detail'" class="detail-section">
      <div class="user-select-wrapper">
        <el-select v-model="selectedUser" placeholder="选择员工" @change="loadUserScore" class="user-select" filterable>
          <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
        </el-select>
      </div>

      <div v-if="userScore" class="score-overview">
        <div class="score-cell total">
          <div class="score-label">综合</div>
          <div class="score-value">{{ userScore.scores.total_score?.toFixed(2) || '-' }}</div>
        </div>
        <div class="score-divider"></div>
        <div class="score-cell">
          <div class="score-label">自评</div>
          <div class="score-value">{{ userScore.scores.self_score?.toFixed(2) || '-' }}</div>
        </div>
        <div class="score-divider"></div>
        <div class="score-cell">
          <div class="score-label">他评</div>
          <div class="score-value">{{ userScore.scores.peer_score?.toFixed(2) || '-' }}</div>
        </div>
        <div class="score-divider"></div>
        <div class="score-cell">
          <div class="score-label">领导评</div>
          <div class="score-value">{{ userScore.scores.leader_score?.toFixed(2) || '-' }}</div>
        </div>
      </div>

      <div v-if="userScore" class="detail-table-wrapper">
        <el-table :data="dimensionDetails" border size="small" class="detail-table">
          <el-table-column prop="dimension_name" label="维度" min-width="100" />
          <el-table-column prop="self" label="自评" width="70"><template #default="{ row }">{{ row.self?.toFixed(2) || '-' }}</template></el-table-column>
          <el-table-column prop="peer" label="他评" width="70"><template #default="{ row }">{{ row.peer?.toFixed(2) || '-' }}</template></el-table-column>
          <el-table-column prop="leader" label="领导评" width="70"><template #default="{ row }">{{ row.leader?.toFixed(2) || '-' }}</template></el-table-column>
        </el-table>
      </div>
    </div>

    <div v-if="activeTab === 'radar'" class="radar-section">
      <div class="radar-control">
        <div class="control-left">
          <el-select v-model="selectedUser" placeholder="选择员工" @change="loadRadar" class="user-select">
            <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
        </div>
        <div class="control-center">
          <div class="compare-mode">
            <span class="mode-label">对比模式</span>
            <el-radio-group v-model="compareMode" size="small">
              <el-radio-button label="history">历史对比</el-radio-button>
              <el-radio-button label="person">人员对比</el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <div class="control-right">
          <el-select v-if="compareMode === 'history'" v-model="comparePeriod" placeholder="选择历史季度" @change="loadRadarCompare" class="period-select">
            <el-option v-for="p in availablePeriods" :key="`${p.year}Q${p.quarter}`" :label="`${p.year}年第${p.quarter}季度`" :value="`${p.year}Q${p.quarter}`" />
          </el-select>
          <el-select v-else v-model="compareUser" placeholder="选择对比员工" @change="loadRadarCompare" class="user-select">
            <el-option v-for="u in otherUsers" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
        </div>
      </div>

      <div v-if="radarData" class="radar-charts">
        <div class="radar-card left">
          <div class="radar-title">{{ selectedUserName || '当前员工' }}</div>
          <div class="radar-subtitle">综合得分：{{ rightRadarScore }}</div>
          <v-chart ref="rightChartRef" :option="rightRadarOption" style="height: 400px" autoresize />
        </div>

        <div class="radar-diff" v-if="radarDataCompare">
          <div class="diff-title">维度差值</div>
          <div class="diff-list">
            <div v-for="(diff, idx) in dimensionDiffs" :key="idx" class="diff-item">
              <span class="diff-name">{{ diff.name }}</span>
              <span class="diff-value" :class="diff.class">{{ diff.value }}</span>
            </div>
          </div>
          <div class="diff-summary">
            <span>综合得分差值：</span>
            <span :class="totalDiffClass">{{ totalDiffText }}</span>
          </div>
        </div>

        <div class="radar-card right">
          <div class="radar-title">{{ compareMode === 'history' ? (comparePeriodLabel || '上一季度') : (compareUserName || '对比员工') }}</div>
          <div class="radar-subtitle">综合得分：{{ leftRadarScore }}</div>
          <v-chart ref="leftChartRef" :option="leftRadarOption" style="height: 400px" autoresize />
        </div>
      </div>

      <div v-if="radarData && radarDataCompare" class="compare-table">
        <h4 class="table-title">维度得分对比明细</h4>
        <el-table :data="compareTableData" border size="small">
          <el-table-column prop="dimension" label="维度" min-width="120" />
          <el-table-column :label="compareMode === 'history' ? (comparePeriodLabel || '历史') : (compareUserName || '对比')" width="100">
            <template #default="{ row }">{{ row.left?.toFixed(2) || '-' }}</template>
          </el-table-column>
          <el-table-column :label="selectedUserName || '当前'" width="100">
            <template #default="{ row }">{{ row.right?.toFixed(2) || '-' }}</template>
          </el-table-column>
          <el-table-column label="差值" width="80">
            <template #default="{ row }">
              <span :class="row.diffClass">{{ row.diffText }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import api, { getCurrentUser } from '../supabase'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'

use([CanvasRenderer, RadarChart, TitleComponent, TooltipComponent, LegendComponent])

const activeTab = ref('ranking')
const summaryData = ref([])
const users = ref([])
const selectedUser = ref(null)

watch(activeTab, (newTab) => {
  if (newTab === 'radar' && selectedUser.value && !radarData.value) {
    loadRadar(selectedUser.value)
  }
})

const userScore = ref(null)
const radarData = ref(null)
const radarDataCompare = ref(null)
const period = ref({ year: 0, quarter: 0 })
const compareMode = ref('history')
const comparePeriod = ref(null)
const compareUser = ref(null)
const availablePeriods = ref([])
const rightChartRef = ref(null)
const leftChartRef = ref(null)
const showUserDropdown = ref(false)

const otherUsers = computed(() => users.value.filter(u => u.id !== selectedUser.value))
const selectedUserName = computed(() => users.value.find(u => u.id === selectedUser.value)?.name || '')
const compareUserName = computed(() => users.value.find(u => u.id === compareUser.value)?.name || '')
const comparePeriodLabel = computed(() => {
  if (!comparePeriod.value) return ''
  const [year, quarter] = comparePeriod.value.split('Q')
  return `${year}年第${quarter}季度`
})

const leftRadarScore = computed(() => {
  if (!radarDataCompare.value?.scores) return '-'
  return radarDataCompare.value.scores.total_score?.toFixed(2) || '-'
})

const rightRadarScore = computed(() => {
  if (!radarData.value?.scores) return '-'
  return radarData.value.scores.total_score?.toFixed(2) || '-'
})

const dimensionDiffs = computed(() => {
  if (!radarData.value?.dimensions?.self || !radarDataCompare.value?.dimensions?.self) return []
  const leftDims = radarDataCompare.value.dimensions.self
  const rightDims = radarData.value.dimensions.self
  return leftDims.map((dim, idx) => {
    const left = dim.score
    const right = rightDims[idx]?.score
    const diff = right !== null && left !== null ? right - left : 0
    return {
      name: dim.dimension_name,
      value: diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : '—',
      class: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
    }
  })
})

const totalDiffClass = computed(() => {
  const diff = (radarData.value?.scores?.total_score || 0) - (radarDataCompare.value?.scores?.total_score || 0)
  return diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
})

const totalDiffText = computed(() => {
  const diff = (radarData.value?.scores?.total_score || 0) - (radarDataCompare.value?.scores?.total_score || 0)
  if (Math.abs(diff) < 0.01) return '—'
  return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)
})

const compareTableData = computed(() => {
  if (!radarData.value?.dimensions?.self || !radarDataCompare.value?.dimensions?.self) return []
  const leftDims = radarDataCompare.value.dimensions.self
  const rightDims = radarData.value.dimensions.self
  return leftDims.map((dim, idx) => {
    const left = dim.score
    const right = rightDims[idx]?.score
    const diff = right !== null && left !== null ? right - left : null
    return {
      dimension: dim.dimension_name,
      left,
      right,
      diffClass: diff === null ? 'neutral' : diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
      diffText: diff === null ? '-' : diff > 0 ? `+${diff.toFixed(2)}` : diff === 0 ? '—' : diff.toFixed(2)
    }
  })
})

const leftRadarOption = computed(() => {
  if (!radarDataCompare.value?.dimensions?.self) return {}
  const dims = radarDataCompare.value.dimensions.self
  const values = dims.map(d => d.score !== null ? d.score : 0)
  const indicators = dims.map(d => ({ name: d.dimension_name, max: 10 }))
  return {
    tooltip: {},
    radar: { indicator: indicators, radius: '60%' },
    series: [{ type: 'radar', data: [{ value: values, name: '得分', itemStyle: { color: '#2b5fec' }, areaStyle: { opacity: 0.15 }, lineStyle: { width: 2 } }] }]
  }
})

const rightRadarOption = computed(() => {
  if (!radarData.value?.dimensions?.self) return {}
  const dims = radarData.value.dimensions.self
  const values = dims.map(d => d.score !== null ? d.score : 0)
  const indicators = dims.map(d => ({ name: d.dimension_name, max: 10 }))
  return {
    tooltip: {},
    radar: { indicator: indicators, radius: '60%' },
    series: [{ type: 'radar', data: [{ value: values, name: '得分', itemStyle: { color: '#4a9e8c' }, areaStyle: { opacity: 0.15 }, lineStyle: { width: 2 } }] }]
  }
})

const loadSummary = async () => {
  summaryData.value = await api.getSummary()
}

const getRowClassName = ({ row }) => {
  if (row.self_score === 0 && row.peer_score === 0 && row.leader_score === 0) {
    return 'zero-score-row'
  }
  return ''
}

const loadUsers = async () => {
  users.value = (await api.getUsers()).filter(u => u.role === 'employee').map(u => ({ id: u.id, name: u.name }))
}

const loadUserScore = async (userId) => {
  if (!userId) return
  userScore.value = await api.getScore(userId)
}

const loadRadar = async (userId) => {
  if (!userId) return
  radarData.value = await api.getRadar(userId)
  radarDataCompare.value = null
  if (compareMode.value === 'history' && comparePeriod.value) {
    loadRadarCompare()
  } else if (compareMode.value === 'person' && compareUser.value) {
    loadRadarCompare()
  }
}

const loadRadarCompare = async () => {
  if (!selectedUser.value) return
  if (compareMode.value === 'history') {
    const [year, quarter] = comparePeriod.value.split('Q')
    radarDataCompare.value = await api.getScoreByPeriod(selectedUser.value, parseInt(year), parseInt(quarter))
  } else {
    radarDataCompare.value = await api.getRadar(compareUser.value)
  }
}

const viewRadar = (userId) => { selectedUser.value = userId; activeTab.value = 'radar'; loadRadar(userId) }

const dimensionDetails = computed(() => {
  if (!userScore.value || !userScore.value.dimensions || !userScore.value.dimensions.self) return []
  const selfDims = userScore.value.dimensions.self || []
  const peerDims = userScore.value.dimensions.peer || []
  const leaderDims = userScore.value.dimensions.leader || []
  return selfDims.map((dim, idx) => ({
    dimension_name: dim.dimension_name,
    self: dim.score,
    peer: peerDims[idx]?.score || 0,
    leader: leaderDims[idx]?.score || 0
  }))
})

const radarOption = computed(() => {
  if (!radarData.value) return {}
  const dimensions = radarData.value.radar.map(r => r.dimension)
  const values = radarData.value.radar.map(r => r.total.toFixed(2))
  return {
    title: { text: `${radarData.value.user.name} - 能力雷达图`, left: 'center' },
    tooltip: {},
    radar: { indicator: dimensions.map(name => ({ name, max: 10 })), radius: '60%' },
    series: [{ type: 'radar', data: [{ value: values, name: '综合得分', areaStyle: { opacity: 0.3 }, lineStyle: { width: 2 } }] }]
  }
})

const exportTable = () => {
  const periodStr = `${period.value.year}Q${period.value.quarter}`
  const headers = ['姓名', '部门', '自评得分', '他评得分', '领导评得分', '综合得分']
  const rows = summaryData.value.map(row => [
    row.user_name,
    row.department || '',
    row.self_score?.toFixed(2) || '-',
    row.peer_score?.toFixed(2) || '-',
    row.leader_score?.toFixed(2) || '-',
    row.total_score?.toFixed(2) || '-'
  ])
  const data = [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '评分汇总')
  XLSX.writeFile(workbook, `360评价汇总_${periodStr}.xlsx`)
}

const exportRadarPdf = async () => {
  if (!radarData.value) {
    ElMessage.warning('请先在雷达图页面选择员工')
    return
  }
  await nextTick()
  await nextTick()

  const pdf = new jsPDF('landscape', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const chartContainer = document.querySelector('.radar-charts')
  if (!chartContainer) {
    ElMessage.error('未找到雷达图容器')
    return
  }

  try {
    const canvas = await html2canvas(chartContainer, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    })

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = pageWidth - 40
    const imgHeight = (canvas.height / canvas.width) * imgWidth

    pdf.addImage(imgData, 'PNG', 20, 25, imgWidth, imgHeight)
    pdf.save(`${selectedUserName.value || '员工'}_雷达图_${period.value.year}Q${period.value.quarter}.pdf`)
    ElMessage.success('导出成功')
  } catch (err) {
    console.error('导出失败:', err)
    ElMessage.error('导出失败')
  }
}

onMounted(async () => {
  try {
    const p = await api.getCurrentPeriod()
    period.value = p
    availablePeriods.value = []
    for (let q = p.quarter - 1; q >= 1; q--) {
      availablePeriods.value.push({ year: p.year, quarter: q })
    }
    if (p.quarter > 1) {
      comparePeriod.value = `${p.year}Q${p.quarter - 1}`
    } else {
      comparePeriod.value = null
    }
    await loadSummary()
    await loadUsers()
    if (users.value.length > 0) {
      selectedUser.value = users.value[0].id
      await loadUserScore(selectedUser.value)
    }
  } catch (err) {
    console.error('初始化失败:', err)
  }
})
</script>

<style scoped>
/* ============================================
   页面容器
   ============================================ */
.summary {
  background: white;
  padding: var(--padding-md);
  border-radius: var(--border-radius-base);
  max-width: 100%;
  overflow-x: hidden;
}

/* ============================================
   页面头部 / 工具栏
   ============================================ */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: var(--padding-md);
  height: 48px;
}

.header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-family: var(--font-serif);
  color: var(--text-primary);
  font-weight: 600;
}

.header :deep(.el-button) {
  background: var(--card-bg) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
  border-radius: var(--border-radius-sm);
  height: 36px;
  padding: 0 16px;
  font-weight: 500;
}

.header-buttons {
  display: flex;
  gap: var(--padding-sm);
}

.header :deep(.el-button:hover) {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

/* ============================================
   Tabs 样式
   ============================================ */
.summary-tabs {
  margin-bottom: 16px;
}

.summary-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.summary-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #f0f0f0;
}

.summary-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  color: #9ca3af;
  height: 44px;
  line-height: 44px;
}

.summary-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary);
  font-weight: 600;
}

.summary-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--color-primary);
  height: 3px;
  border-radius: 3px 3px 0 0;
}

/* ============================================
   表格样式
   ============================================ */
.table-wrapper {
  overflow-x: auto;
  background: #fff;
  border-radius: var(--border-radius-lg);
}

.summary-table {
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.summary-table :deep(.el-table__header th) {
  background-color: #f8f9fb !important;
  color: #9ca3af;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0 16px !important;
  height: 44px;
  border-bottom: 1px solid #f0f0f0 !important;
}

.summary-table :deep(.el-table__body td) {
  padding: 0 16px !important;
  height: 52px;
  border-bottom: 1px solid #f5f5f5 !important;
  font-size: var(--font-sm);
  color: var(--color-text-primary);
}

.summary-table :deep(.el-table__row) {
  transition: background 0.15s;
}

.summary-table :deep(.el-table__row:hover > td) {
  background-color: #f5f8ff !important;
}

.summary-table :deep(.el-table__row:last-child > td) {
  border-bottom: none !important;
}

.summary-table :deep(.el-table__body) {
  border-radius: 0;
}
.ranking-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--padding-md);
  background: var(--card-bg);
  border-radius: var(--border-radius);
  margin-bottom: var(--padding-sm);
  box-shadow: var(--shadow-sm);
}

.ranking-card-list {
  display: none;
}

.ranking-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ranking-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2b5fec, #1e4ad4);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.ranking-user-info {
  min-width: 0;
}

.ranking-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.ranking-dept {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.ranking-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ranking-score {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
}

.ranking-btn {
  font-size: 12px;
  padding: 4px 10px;
}

.score-text {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-primary);
}

.total-score {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
}

.total-score-column :deep(.cell) {
  background: var(--color-primary-light);
}

.score-text {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-primary);
}

.score-text.zero-score {
  color: #bbb;
}

.zero-score-row :deep(td) {
  color: #bbb !important;
}

.radar-btn {
  background: none !important;
  border: none !important;
  color: var(--accent) !important;
  padding: 4px 0 !important;
  font-size: 13px;
  position: relative;
  text-decoration: none;
}

.radar-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--accent);
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.radar-btn:hover {
  color: #b8973f !important;
  background: none !important;
}

.radar-btn:hover::after {
  opacity: 1;
}

/* ============================================
   分数展示
   ============================================ */
.detail-cards {
  margin-top: var(--margin-md);
  display: flex;
  flex-wrap: wrap;
  gap: var(--margin-base);
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px 6px 8px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  height: 36px;
}

.user-select-wrapper {
  margin-bottom: 12px;
}

.user-select-wrapper .el-select {
  width: 200px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2b5fec, #1e4ad4);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.user-name {
  font-size: var(--font-sm);
  color: var(--color-text-primary);
  font-weight: 500;
}

.score-overview {
  display: flex;
  background: white;
  border-radius: 12px;
  padding: 14px 0;
  margin-top: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.score-cell {
  flex: 1;
  text-align: center;
}

.score-cell.total {
  background: #faf8f3;
}

.score-label {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.score-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
}

.score-divider {
  width: 1px;
  background: #f0f0f0;
}

.detail-table-wrapper {
  margin-top: 12px;
}

.detail-table {
  font-size: 13px;
}

.score-card {
  display: inline-block;
  width: 200px;
  margin-bottom: var(--margin-base);
  text-align: center;
  min-width: clamp(120px, 30vw, 140px);
  border: 1px solid var(--border-color);
}

.score-card :deep(.el-card__header) {
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  padding: var(--padding-sm) var(--padding-md);
  border-bottom: 1px solid var(--border-color);
}

.big-score {
  font-family: var(--font-sans);
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--accent);
  padding: var(--padding-md);
}

.radar-chart {
  margin-top: var(--margin-md);
}

.radar-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--padding-md);
  padding: var(--padding-md) var(--padding-lg);
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: var(--padding-md);
  flex-wrap: wrap;
}

.control-left, .control-right {
  flex: 1;
}

.control-center {
  flex: 2;
  display: flex;
  justify-content: center;
}

.compare-mode {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.mode-label {
  font-size: 13px;
  color: #666;
}

.radar-charts {
  display: flex;
  gap: var(--padding-md);
  align-items: flex-start;
  margin-bottom: var(--padding-md);
}

.radar-card {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: var(--padding-lg);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.radar-card.left {
  border-top: 3px solid var(--color-primary);
}

.radar-card.right {
  border-top: 3px solid var(--color-success);
}

.radar-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: 4px;
}

.radar-subtitle {
  font-size: 13px;
  color: #8a8796;
  text-align: center;
  margin-bottom: var(--padding-md);
}

.radar-diff {
  width: 120px;
  background: #f8f9fb;
  border-radius: 12px;
  padding: var(--padding-md);
  text-align: center;
}

.diff-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--padding-sm);
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.diff-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.diff-name {
  color: #666;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-value {
  font-weight: 600;
}

.diff-value.up {
  color: #4a9e8c;
}

.diff-value.down {
  color: #c0504d;
}

.diff-value.neutral {
  color: #999;
}

.diff-summary {
  margin-top: var(--padding-sm);
  padding-top: var(--padding-sm);
  border-top: 1px solid #e5e5e5;
  font-size: 13px;
  color: #666;
}

.diff-summary .up {
  color: #4a9e8c;
  font-weight: 600;
}

.diff-summary .down {
  color: #c0504d;
  font-weight: 600;
}

.diff-summary .neutral {
  color: #999;
}

.compare-table {
  background: white;
  border-radius: 12px;
  padding: var(--padding-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 06);
}

.table-title {
  margin: 0 0 var(--padding-sm) 0;
  font-size: var(--font-sm);
  color: var(--color-text-primary);
  font-weight: 600;
}

.up { color: var(--color-success); }
.down { color: var(--color-danger); }
.neutral { color: #999; }

.user-select {
  max-width: clamp(150px, 40vw, 200px);
}

.period-select {
  max-width: clamp(150px, 30vw, 180px);
}

/* ============================================
   响应式 - 平板 (769px - 1024px)
   ============================================ */
@media screen and (max-width: 1024px) {
  .header h2 {
    font-size: var(--font-size-lg);
  }

  .big-score {
    font-size: var(--font-size-xl);
  }
}

/* ============================================
   响应式 - 移动端 (≤768px)
   ============================================ */
@media screen and (max-width: 768px) {
  .header {
    flex-direction: column;
    height: auto;
    gap: var(--padding-sm);
  }

  .summary-tabs {
    margin-bottom: var(--margin-base);
  }

  .score-card {
    width: 48%;
    min-width: unset;
    margin-bottom: var(--padding-sm);
  }

  .big-score {
    font-size: var(--font-size-lg);
    padding: var(--padding-sm);
  }

  .radar-chart :deep(.v-chart) {
    height: 300px !important;
  }

  .radar-control {
    flex-direction: column;
    align-items: stretch;
  }

  .control-center {
    flex: none;
  }

  .radar-charts {
    flex-direction: column;
  }

  .radar-diff {
    width: 100%;
    order: 3;
  }
}

/* ============================================
   响应式 - 超小屏幕 (≤480px)
   ============================================ */
@media screen and (max-width: 480px) {
  .summary {
    padding: var(--padding-base);
  }

  .summary-tabs :deep(.el-tabs__header) {
    margin-bottom: 0;
  }

  .summary-tabs :deep(.el-tabs__item) {
    font-size: 13px;
    height: 40px;
    line-height: 40px;
    padding: 0 12px;
  }

  .summary-tabs :deep(.el-tabs__active-bar) {
    height: 2px;
  }

  .detail-section {
    padding: 0;
  }

  .score-overview {
    border-radius: 10px;
    padding: 12px 0;
  }

  .score-label {
    font-size: 10px;
  }

  .score-value {
    font-size: 18px;
  }

  .detail-table-wrapper {
    margin-top: 10px;
  }

  .detail-table {
    font-size: 12px;
  }

  .detail-table :deep(.el-table__header th) {
    font-size: 11px;
  }

  .detail-table :deep(.el-table__body td) {
    padding: 6px 4px;
  }

  .score-card {
    width: 100%;
  }

  .big-score {
    font-size: var(--font-size-md);
    padding: var(--padding-xs);
  }

  .radar-charts {
    flex-direction: column;
    gap: var(--padding-sm);
  }

  .radar-card {
    width: 100%;
  }

  .radar-card :deep(.v-chart) {
    height: 280px !important;
  }

  .radar-diff {
    display: none;
  }

  .ranking-desktop-table {
    display: none;
  }

  .ranking-card-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 16px;
  }

  .ranking-item-card {
    padding: 12px;
    margin-bottom: 0;
  }

  .ranking-score {
    font-size: 20px;
  }

  .ranking-btn {
    font-size: 11px;
    padding: 3px 8px;
  }
}
</style>
