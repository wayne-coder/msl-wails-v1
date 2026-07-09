<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { settings } from '../lib/settingsStore'
import {
  ZODIAC,
  TAIL_KEYS,
} from '../lib/zodiacMap'

const props = defineProps<{
  amounts: Record<string, Record<number, number>>  // betType → num → amount
  region: string
  winningNums?: Record<string, Set<number>>  // betType → Set<中奖 num>
}>()

// ========== Tab: 投注类型 ==========
type BetTab = 'specialNumber' | 'lianXiao' | 'flatSpecial' | 'flatNumber'
type LianXiaoSubTab = 'lianXiao2' | 'lianXiao3' | 'lianXiao4' | 'lianXiao5'
const activeTab = ref<BetTab>('specialNumber')
const lianXiaoSubTab = ref<LianXiaoSubTab>('lianXiao2')

const tabs: { key: BetTab; label: string }[] = [
  { key: 'specialNumber', label: '特码' },
  { key: 'lianXiao', label: '连肖' },
  { key: 'flatSpecial', label: '平特' },
  { key: 'flatNumber', label: '平码' },
]

const lianXiaoSubTabs: { key: LianXiaoSubTab; label: string }[] = [
  { key: 'lianXiao2', label: '二连肖' },
  { key: 'lianXiao3', label: '三连肖' },
  { key: 'lianXiao4', label: '四连肖' },
  { key: 'lianXiao5', label: '五连肖' },
]

// 连肖子 tab → 赔率（不含马 / 含马）
const lianXiaoOdds: Record<LianXiaoSubTab, number> = {
  lianXiao2: settings.odds.lianXiao2,
  lianXiao3: settings.odds.lianXiao3,
  lianXiao4: settings.odds.lianXiao4,
  lianXiao5: settings.odds.lianXiao5,
}
const lianXiaoMaOdds: Record<LianXiaoSubTab, number> = {
  lianXiao2: settings.odds.lianXiaoMa2,
  lianXiao3: settings.odds.lianXiaoMa3,
  lianXiao4: settings.odds.lianXiaoMa4,
  lianXiao5: settings.odds.lianXiaoMa5,
}

// 当前 tab 对应的金额
const activeAmounts = computed<Record<number, number>>(() => {
  const merged: Record<number, number> = {}
  const keys = activeTab.value === 'lianXiao'
    ? [lianXiaoSubTab.value]
    : activeTab.value === 'flatSpecial' ? ['flatSpecial']
    : activeTab.value === 'flatNumber' ? ['flatNumber']
    : ['specialNumber']
  for (const key of keys) {
    const sub = props.amounts[key]
    if (sub) {
      for (const [num, amt] of Object.entries(sub)) {
        merged[Number(num)] = (merged[Number(num)] ?? 0) + amt
      }
    }
  }
  return merged
})

const tabOddsRebate = computed(() => {
  const o = settings.odds
  const r = settings.rebate
  switch (activeTab.value) {
    case 'specialNumber': return { odds: o.specialNumber, rebate: r.specialNumber }
    case 'lianXiao':     return { odds: lianXiaoOdds[lianXiaoSubTab.value], rebate: r.lianXiao }
    case 'flatSpecial':  return { odds: o.flatSpecial,   rebate: r.flatSpecial4 }
    case 'flatNumber':   return { odds: o.flatNumber,    rebate: r.flatNumber }
  }
})

// 数字→颜色映射
const NUM_COLOR: Record<number, string> = {}

// 绿色
;[32, 21, 33, 16, 27, 28, 44, 39, 11, 22, 17, 6, 5, 43, 38, 49].forEach(n => { NUM_COLOR[n] = '#16a34a' })
// 红色
;[30, 12, 45, 34, 8, 46, 35, 18, 40, 24, 19, 23, 29, 7, 2, 13, 1].forEach(n => { NUM_COLOR[n] = '#dc2626' })
// 蓝色
;[10, 9, 36, 20, 47, 48, 4, 42, 3, 15, 41, 31, 37, 14, 26, 25].forEach(n => { NUM_COLOR[n] = '#2563eb' })

// 数字→生肖映射（1-49）
const NUM_ZODIAC: Record<number, string> = {
  1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
  7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊',
  13: '马', 14: '蛇', 15: '龙', 16: '兔', 17: '虎', 18: '牛',
  19: '鼠', 20: '猪', 21: '狗', 22: '鸡', 23: '猴', 24: '羊',
  25: '马', 26: '蛇', 27: '龙', 28: '兔', 29: '虎', 30: '牛',
  31: '鼠', 32: '猪', 33: '狗', 34: '鸡', 35: '猴', 36: '羊',
  37: '马', 38: '蛇', 39: '龙', 40: '兔', 41: '虎', 42: '牛',
  43: '鼠', 44: '猪', 45: '狗', 46: '鸡', 47: '猴', 48: '羊',
  49: '马',
}

interface RowItem {
  id: number
  project: string   // "数字+生肖" 如 "32猪"
  amount: number
  risk: number
}

// ========== 总金额 ==========
const totalAmount = computed(() => {
  return Object.values(activeAmounts.value).reduce((sum, v) => sum + v, 0)
})

// 生成49行数据（金额来自父组件，风险按公式计算）
const rows = computed<RowItem[]>(() =>
  Array.from({ length: 49 }, (_, i) => {
    const num = i + 1
    const amount = activeAmounts.value[num] ?? 0
    // 风险 = 总金额 - 总金额 * 回水 - 金额 * 赔率
    const { odds, rebate } = tabOddsRebate.value
    const risk = totalAmount.value - totalAmount.value * (rebate / 100) - amount * odds
    return {
      id: num,
      project: `${num}${NUM_ZODIAC[num]}`,
      amount,
      risk: Math.round(risk),
    }
  })
)

// 生肖颜色
const ZODIAC_COLOR: Record<string, string> = {
  鼠: '#4f46e5', 牛: '#b45309', 虎: '#ea580c', 兔: '#db2777',
  龙: '#059669', 蛇: '#15803d', 马: '#e11d48', 羊: '#4d7c0f',
  猴: '#7c3aed', 鸡: '#dc2626', 狗: '#0284c7', 猪: '#c026d3',
}

// 平特行：生肖（按十二生肖顺序）+ 尾数（0-9）
// 金额直接按 item ID 读取（1-12 生肖, 13-22 尾数）
// 4码组/5码组赔率回水不同，回水按各项分别计算后汇总
const flatSpecialRows = computed<RowItem[]>(() => {
  const result: RowItem[] = []
  const o = settings.odds
  const r = settings.rebate

  // 先算出总回水：Σ(各项金额 × 各项回水率)
  let totalRebate = 0
  for (let i = 0; i < ZODIAC.length; i++) {
    const amt = activeAmounts.value[i + 1] ?? 0
    if (amt === 0) continue
    const rebatePct = ZODIAC[i] === '马' ? r.flatSpecial5 : r.flatSpecial4
    totalRebate += amt * (rebatePct / 100)
  }
  for (let i = 0; i < TAIL_KEYS.length; i++) {
    const amt = activeAmounts.value[13 + i] ?? 0
    if (amt === 0) continue
    const rebatePct = TAIL_KEYS[i] === '0' ? r.flatSpecial4 : r.flatSpecial5
    totalRebate += amt * (rebatePct / 100)
  }

  // 各行风险 = 总金额 - 总回水 - 该项金额 × 该项赔率
  for (let i = 0; i < ZODIAC.length; i++) {
    const zodiac = ZODIAC[i]
    const id = i + 1
    const amount = activeAmounts.value[id] ?? 0
    const is5 = zodiac === '马'
    const odds = is5 ? o.flatSpecial5 : o.flatSpecial4
    const risk = totalAmount.value - totalRebate - amount * odds
    result.push({ id, project: zodiac, amount, risk: Math.round(risk) })
  }

  for (let i = 0; i < TAIL_KEYS.length; i++) {
    const tail = TAIL_KEYS[i]
    const id = 13 + i
    const amount = activeAmounts.value[id] ?? 0
    const is4 = tail === '0'
    const odds = is4 ? o.flatSpecial4 : o.flatSpecial5
    const risk = totalAmount.value - totalRebate - amount * odds
    result.push({ id, project: `${tail}尾`, amount, risk: Math.round(risk) })
  }

  return result
})

// 连肖行：从位图编码解码为生肖组合字符串
// 含"马"的组合使用马赔率，其余使用普通赔率
const lianXiaoRows = computed<RowItem[]>(() => {
  const result: RowItem[] = []
  const rebate = settings.rebate.lianXiao
  for (const [key, amount] of Object.entries(activeAmounts.value)) {
    const bits = Number(key)
    if (bits === 0 || amount === 0) continue
    let project = ''
    for (let i = 0; i < ZODIAC.length; i++) {
      if (bits & (1 << i)) project += ZODIAC[i]
    }
    if (!project) continue
    const hasMa = project.includes('马')
    const odds = hasMa ? lianXiaoMaOdds[lianXiaoSubTab.value] : lianXiaoOdds[lianXiaoSubTab.value]
    const risk = totalAmount.value - totalAmount.value * (rebate / 100) - amount * odds
    result.push({ id: bits, project, amount, risk: Math.round(risk) })
  }
  return result
})

// ========== 连肖分页 (行数 > 200 时启用) ==========
const LIANXIAO_PAGE_SIZE = 200
const lianXiaoPage = ref(1)
const lianXiaoTotalPages = computed(() =>
  Math.max(1, Math.ceil(lianXiaoRows.value.length / LIANXIAO_PAGE_SIZE))
)

// 切换 tab 时重置分页
watch(activeTab, () => { lianXiaoPage.value = 1 })
watch(lianXiaoSubTab, () => { lianXiaoPage.value = 1 })

const paginatedLianXiaoRows = computed(() => {
  if (lianXiaoRows.value.length <= LIANXIAO_PAGE_SIZE) return lianXiaoRows.value
  const start = (lianXiaoPage.value - 1) * LIANXIAO_PAGE_SIZE
  return lianXiaoRows.value.slice(start, start + LIANXIAO_PAGE_SIZE)
})

// ========== 排序 ==========
type SortKey = 'amount' | 'risk'
const sortKey = ref<SortKey | null>('risk')
const sortAsc = ref(true)

const sortedRows = computed(() => {
  const source = activeTab.value === 'flatSpecial' ? flatSpecialRows.value
    : activeTab.value === 'lianXiao' ? paginatedLianXiaoRows.value
    : rows.value
  const list = [...source]
  if (sortKey.value) {
    list.sort((a, b) => {
      const d = a[sortKey.value!] - b[sortKey.value!]
      return sortAsc.value ? d : -d
    })
  }
  return list
})

const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

const sortIndicator = (key: SortKey): string => {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' ▲' : ' ▼'
}

const TAIL_COLORS: Record<number, string> = {
  0: '#6b7280', 1: '#b45309', 2: '#ea580c', 3: '#dc2626', 4: '#e11d48',
  5: '#059669', 6: '#2563eb', 7: '#7c3aed', 8: '#db2777', 9: '#0284c7',
}

const getItemColor = (row: RowItem): string => {
  if (activeTab.value === 'flatSpecial') {
    if (row.id <= 12) return ZODIAC_COLOR[row.project] || '#374151'
    return TAIL_COLORS[row.id - 13] || '#374151'
  }
  if (activeTab.value === 'lianXiao') {
    return ZODIAC_COLOR[row.project[0]] || '#7c3aed'
  }
  return NUM_COLOR[row.id] || '#374151'
}

/** 为每行生成唯一 key，避免与排序后的位置耦合 */
const rowKey = (row: RowItem): string => {
  const prefix = activeTab.value === 'lianXiao'
    ? lianXiaoSubTab.value
    : activeTab.value
  return `${prefix}-${row.id}`
}

// ========== 中奖高亮 ==========
const currentWinSet = computed<Set<number>>(() => {
  if (!props.winningNums) return new Set()
  const key = activeTab.value === 'lianXiao'
    ? lianXiaoSubTab.value
    : activeTab.value
  return props.winningNums[key] ?? new Set()
})

const isWinningRow = (row: RowItem): boolean => {
  return currentWinSet.value.has(row.id)
}
</script>

<template>
  <div class="bet-wrapper">
    <!-- 左侧边栏 -->
    <div :class="['bet-sidebar', props.region === '澳门' ? 'region-macau' : 'region-hk']">
      <div class="region-header">{{ props.region }}</div>
      <div class="bet-total">
        <span class="total-label">总金额</span>
        <span class="total-value">{{ totalAmount || '-' }}</span>
      </div>
      <div class="bet-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['bet-tab', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </div>
    </div>
    <!-- 右侧列表 -->
    <div class="bet-content">
      <!-- 连肖子 tab -->
      <div v-if="activeTab === 'lianXiao'" class="lianxiao-subtabs">
        <button
          v-for="st in lianXiaoSubTabs"
          :key="st.key"
          :class="['lianxiao-subtab', { active: lianXiaoSubTab === st.key }]"
          @click="lianXiaoSubTab = st.key"
        >{{ st.label }}</button>
      </div>
      <div class="bet-list">
    <!-- 表头 -->
    <div class="list-header">
      <span class="col-project">项目</span>
      <span class="col-amount sortable" @click="toggleSort('amount')">
        金额{{ sortIndicator('amount') }}
      </span>
      <span class="col-risk sortable" @click="toggleSort('risk')">
        风险{{ sortIndicator('risk') }}
      </span>
      <span class="col-id">ID</span>
    </div>

    <!-- 列表 -->
    <div :class="['list-body', { 'list-body-fixed': activeTab === 'lianXiao' }]">
      <div
        v-for="(row, index) in sortedRows"
        :key="rowKey(row)"
        :class="['list-row', { 'row-winning': isWinningRow(row) }]"
      >
        <span class="col-project" :style="{ color: getItemColor(row) }">{{ row.project }}</span>
        <span class="col-amount" :style="{ color: row.amount ? getItemColor(row) : '' }">{{ row.amount }}</span>
        <span class="col-risk" :style="{ color: row.risk < 0 ? '#dc2626' : row.risk > 0 ? '#16a34a' : '' }">{{ row.risk }}</span>
        <span class="col-id">{{ index + 1 }}</span>
      </div>
    </div>
    <!-- 连肖分页控件 -->
    <div v-if="activeTab === 'lianXiao' && lianXiaoTotalPages > 1" class="lianxiao-pagination">
      <button class="page-btn" :disabled="lianXiaoPage <= 1" @click="lianXiaoPage--">‹</button>
      <span class="page-info">{{ lianXiaoPage }} / {{ lianXiaoTotalPages }}</span>
      <button class="page-btn" :disabled="lianXiaoPage >= lianXiaoTotalPages" @click="lianXiaoPage++">›</button>
    </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.bet-list {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  font-size: 11px;
  user-select: none;
}

/* 表头 */
.list-header {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  font-weight: 700;
  font-size: 10px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  gap: 2px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  background: rgba(18, 32, 51, 0.02);
}

/* 行 */
.list-row {
  display: flex;
  align-items: center;
  padding: 0 10px;
  transition: background var(--ease-out);
}

.list-row:nth-child(even) {
  background: rgba(18, 32, 51, 0.02);
}

.list-row:hover {
  background: rgba(37, 99, 235, 0.05);
}

.list-row.row-winning {
  background: rgba(220, 38, 38, 0.10);
}

.list-row.row-winning:nth-child(even) {
  background: rgba(220, 38, 38, 0.12);
}

.list-row.row-winning:hover {
  background: rgba(220, 38, 38, 0.18);
}

/* 列宽 */
.col-project { flex: 0.8; min-width: 0; font-weight: 600; letter-spacing: 0.2px; }
.col-amount  { flex: 1; text-align: right; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.col-risk    { flex: 1; text-align: right; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.col-id      { flex: 0.6; text-align: center; color: var(--text-muted); font-size: 10px; }

/* 排序 */
.sortable {
  cursor: pointer;
  user-select: none;
  transition: color var(--ease-out);
  font-size: 10px;
  color: var(--text-secondary);
}

.sortable:hover {
  color: var(--accent-blue);
}

/* 列表体：49行均匀填满，窗口过小时自动滚动 */
.list-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.list-body > .list-row {
  flex: 1 0 auto;
}

.list-body-fixed > .list-row {
  flex: 0 0 auto;
  min-height: 22px;
}

/* ── 外层包装 ── */
.bet-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}

/* ── 左侧边栏 ── */
.bet-sidebar {
  width: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  border-right: 1px solid;
  padding: 6px 0;
  gap: 4px;
}

.bet-sidebar.region-macau {
  border-color: rgba(5, 150, 105, 0.2);
  background: rgba(5, 150, 105, 0.03);
}

.bet-sidebar.region-hk {
  border-color: rgba(220, 38, 38, 0.2);
  background: rgba(220, 38, 38, 0.03);
}

/* ── 地区标题 ── */
.region-header {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  writing-mode: vertical-rl;
  padding: 4px 0;
}

.region-macau .region-header { color: #059669; }
.region-hk .region-header { color: #dc2626; }

/* ── 竖排 Tab ── */
.bet-tabs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 0 4px;
}

.bet-tab {
  padding: 4px 2px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(18, 32, 51, 0.03);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all var(--ease-out);
}

.bet-tab:hover {
  background: rgba(37, 99, 235, 0.05);
  color: var(--text-secondary);
}

.bet-tab.active {
  background: #fff;
  color: var(--accent-blue);
  border-color: var(--accent-blue);
  font-weight: 700;
}

/* ── 总金额 ── */
.bet-total {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px 10px 4px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 6px;
}

.total-label {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
}

.total-value {
  font-size: 12px;
  font-weight: 800;
  color: var(--accent-blue);
  font-variant-numeric: tabular-nums;
  writing-mode: horizontal-tb;
}

/* ── 内容区（v-if 容器）── */
.bet-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 空状态 ── */
/* ── 连肖子 tab ── */
.lianxiao-subtabs {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.lianxiao-subtab {
  padding: 3px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(18, 32, 51, 0.03);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ease-out);
}

.lianxiao-subtab:hover {
  background: rgba(139, 92, 246, 0.06);
  color: var(--text-secondary);
}

.lianxiao-subtab.active {
  background: #fff;
  color: var(--accent-purple);
  border-color: var(--accent-purple);
  font-weight: 700;
}

/* ── 连肖分页 ── */
.lianxiao-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: rgba(18, 32, 51, 0.01);
}

.page-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--ease-out);
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 50px;
  text-align: center;
}
</style>
