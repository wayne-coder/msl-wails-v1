<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { settings } from '../lib/settingsStore'
import { ZODIAC, ZODIAC_NUMBER_MAP } from '../lib/zodiacMap'
import { ctxMenu } from '../lib/contextMenuState'

const props = defineProps<{
  visible: boolean
  macauAmounts: Record<string, Record<number, number>>
  hkAmounts: Record<string, Record<number, number>>
  selectedPlayer: string | null
}>()

const emit = defineEmits<{
  close: []
  apply: [region: '澳' | '港', betType: string, reductions: Record<number, number>, detail: string]
}>()

// ========== 数字→生肖映射 ==========
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

// ========== 地区选择 ==========
const selectedRegion = ref<'澳' | '港'>('澳')

// ========== Tab 状态 ==========
type TabKey = 'specialNumber' | 'lianXiao' | 'flatSpecial' | 'flatNumber'
const activeTab = ref<TabKey>('specialNumber')

const tabs: { key: TabKey; label: string }[] = [
  { key: 'specialNumber', label: '特码' },
  { key: 'lianXiao', label: '连肖' },
  { key: 'flatSpecial', label: '平特' },
  { key: 'flatNumber', label: '平码' },
]

// ========== 计算模式 ==========
type CalcMode = 'risk' | 'amount'
const calcMode = ref<CalcMode>('risk')

// ========== 风险阈值 ==========
const riskThreshold = ref(-10000)

// ========== 下注额上限 ==========
const amountLimit = ref(5000)

// ========== 当前地区的金额数据 ==========
const regionAmounts = computed(() => {
  return selectedRegion.value === '澳' ? props.macauAmounts : props.hkAmounts
})

// ========== 当前 tab 的金额 & 赔率 & 回水 ==========
const currentOdds = computed(() => {
  const o = settings.odds
  switch (activeTab.value) {
    case 'specialNumber': return o.specialNumber
    case 'flatNumber': return o.flatNumber
    case 'flatSpecial': return o.flatSpecial4
    case 'lianXiao': return o.lianXiao2
  }
})

const currentRebate = computed(() => {
  const r = settings.rebate
  switch (activeTab.value) {
    case 'specialNumber': return r.specialNumber
    case 'flatNumber': return r.flatNumber
    case 'flatSpecial': return r.flatSpecial4
    case 'lianXiao': return r.lianXiao
  }
})

// ========== 行数据 ==========
interface ReportRow {
  id: number
  label: string      // 显示标签（号码+生肖等）
  amount: number     // 当前下注额
}

// 生成行数据（特码/平码是 1-49，平特是生肖+尾数，连肖暂不支持）
const allRows = computed<ReportRow[]>(() => {
  if (activeTab.value === 'specialNumber' || activeTab.value === 'flatNumber') {
    return Array.from({ length: 49 }, (_, i) => {
      const num = i + 1
      return { id: num, label: `${num}${NUM_ZODIAC[num]}`, amount: 0 }
    })
  }
  // 平特和连肖暂返回空，后续实现
  return []
})

// 填充金额
const rows = computed<ReportRow[]>(() => {
  const typeAmounts = regionAmounts.value[activeTab.value] ?? {}
  return allRows.value.map(r => ({
    ...r,
    amount: typeAmounts[r.id] ?? 0,
  }))
})

// 总金额
const totalAmount = computed(() => {
  return rows.value.reduce((sum, r) => sum + r.amount, 0)
})

// 每行的风险 = 总金额 - 总金额 × 回水% - 金额 × 赔率
interface ReportRowEx extends ReportRow {
  risk: number
  needReduce: number   // 需要吃码的金额（自动计算建议值）
  reduceAmount: number  // 用户输入的吃码金额
  riskAfter: number     // 吃码后风险
}

// ========== 吃码金额输入（按行存储） ==========
const reduceInputs = reactive<Record<number, number>>({})

// 重置所有吃码输入
function resetReduceInputs() {
  for (const key of Object.keys(reduceInputs)) {
    delete reduceInputs[Number(key)]
  }
}

watch([activeTab, selectedRegion], () => {
  resetReduceInputs()
})

// 对话框每次打开时清空上次的输入
watch(() => props.visible, (v) => {
  if (v) resetReduceInputs()
})

// 计算扩展行数据
const extendedRows = computed<ReportRowEx[]>(() => {
  const odds = currentOdds.value
  const rebate = currentRebate.value
  const total = totalAmount.value

  // 汇总所有吃码金额，用于计算吃码后的总金额
  const totalReduce = Object.values(reduceInputs).reduce((s, v) => s + (v || 0), 0)
  const newTotal = total - totalReduce

  return rows.value.map(r => {
    const risk = total - total * (rebate / 100) - r.amount * odds
    const reduceAmt = reduceInputs[r.id] || 0

    // 吃码后风险：用新的总金额 + 减少后的金额
    const newAmount = r.amount - reduceAmt
    const riskAfter = newTotal - newTotal * (rebate / 100) - newAmount * odds

    // 需要吃码的金额：按当前计算模式
    let needReduce = 0
    if (calcMode.value === 'risk') {
      // 风险下限模式：使 risk >= threshold 的最小减额
      const threshold = riskThreshold.value
      const denom = odds + (rebate / 100) - 1
      if (risk < threshold && denom > 0 && r.amount > 0) {
        needReduce = Math.ceil((threshold - risk) / denom)
        if (needReduce > r.amount) needReduce = r.amount
      }
    } else {
      // 下注额上限模式：使 amount <= limit 的减额
      const limit = amountLimit.value
      if (r.amount > limit) {
        needReduce = r.amount - limit
      }
    }

    return {
      ...r,
      risk: Math.round(risk),
      needReduce,
      reduceAmount: reduceAmt,
      riskAfter: Math.round(riskAfter),
    }
  }).sort((a, b) => calcMode.value === 'risk' ? (a.risk - b.risk) : (b.amount - a.amount))
})

// ========== 一键填充建议值 ==========
function fillSuggested() {
  resetReduceInputs()
  for (const row of extendedRows.value) {
    if (row.needReduce > 0) {
      reduceInputs[row.id] = row.needReduce
    }
  }
}

// ========== 生成上报格式 & 复制 ==========
const copyFeedback = ref('')

/**
 * 格式化同一减额金额的一组号码：
 * - 优先将完整生肖的号码合并为生肖名
 * - 生肖在前（按 ZODIAC 顺序），号码在后（数值升序），中间以 . 分隔
 * - 例：马蛇兔.8.9各91
 */
function formatAmountGroup(nums: number[], amt: number): string {
  const numSet = new Set(nums)
  const consumed = new Set<number>()
  const zodiacParts: string[] = []

  // 按 ZODIAC 顺序检测可合并的完整生肖
  for (const z of ZODIAC) {
    const zNums = ZODIAC_NUMBER_MAP[z]
    if (zNums && zNums.every(n => numSet.has(n))) {
      zodiacParts.push(z)
      for (const n of zNums) consumed.add(n)
    }
  }

  // 未被合并的号码，升序排列
  const remaining = nums.filter(n => !consumed.has(n)).sort((a, b) => a - b)

  // 拼接
  let result = ''
  if (zodiacParts.length > 0) {
    result += zodiacParts.join('')
  }
  if (remaining.length > 0) {
    if (zodiacParts.length > 0) result += '.'
    result += remaining.join('.')
  }
  result += `各${amt}`

  return result
}

// 仅详情（不含首行），用于 emit 和记录面板
const reportDetail = computed(() => {
  const byAmount = new Map<number, number[]>()
  for (const row of extendedRows.value) {
    if (row.reduceAmount > 0) {
      const amt = row.reduceAmount
      if (!byAmount.has(amt)) byAmount.set(amt, [])
      byAmount.get(amt)!.push(row.id)
    }
  }
  if (byAmount.size === 0) return ''

  const lines: string[] = []
  for (const [amt, nums] of byAmount) {
    lines.push(formatAmountGroup(nums, amt))
  }
  return lines.join('\n')
})

const reportFormat = computed(() => {
  if (!reportDetail.value) return ''
  const regionLabel = selectedRegion.value === '澳' ? '澳' : '港'
  const typeLabel = tabs.find(t => t.key === activeTab.value)?.label ?? activeTab.value
  return `${regionLabel} ${typeLabel}\n${reportDetail.value}`
})

async function copyFormat() {
  const text = reportFormat.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copyFeedback.value = '已复制'
    setTimeout(() => { copyFeedback.value = '' }, 1500)
  } catch {
    copyFeedback.value = '复制失败'
    setTimeout(() => { copyFeedback.value = '' }, 1500)
  }
}

// ========== 确认 ==========
function onApply() {
  if (!props.selectedPlayer) return

  const reductions: Record<number, number> = {}
  for (const row of extendedRows.value) {
    if (row.reduceAmount > 0) {
      reductions[row.id] = row.reduceAmount
    }
  }
  if (Object.keys(reductions).length === 0) return

  emit('apply', selectedRegion.value, activeTab.value, reductions, reportDetail.value)
  resetReduceInputs()
  emit('close')
}

// ========== 拖动 ==========
const panelStyle = ref<Record<string, string>>({})
let dragging = false
let startX = 0, startY = 0, offsetX = 0, offsetY = 0

const onDragStart = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.dialog-close')) return
  dragging = true
  startX = e.clientX; startY = e.clientY
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}
const onDragMove = (e: MouseEvent) => {
  if (!dragging) return
  offsetX += e.clientX - startX
  offsetY += e.clientY - startY
  startX = e.clientX; startY = e.clientY
  panelStyle.value = { transform: `translate(${offsetX}px, ${offsetY}px)` }
}
const onDragEnd = () => {
  dragging = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay">
      <div class="dialog-panel" :style="panelStyle">
        <!-- 标题栏 -->
        <div class="dialog-header" @mousedown="onDragStart">
          <span class="dialog-title">吃码上报</span>
          <button class="dialog-close" @click="emit('close')" title="关闭">&times;</button>
        </div>

        <!-- 内容：左侧 Tab + 右侧面板 -->
        <div class="dialog-body">
          <div class="tab-bar">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              :class="['tab-btn', { active: activeTab === tab.key }]"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
          <div class="tab-content">
            <!-- 顶部：地区切换 + 阈值设置 -->
            <div class="toolbar-row">
              <div class="region-switch">
                <button
                  :class="['switch-btn', { active: selectedRegion === '澳' }]"
                  @click="selectedRegion = '澳'"
                >澳</button>
                <button
                  :class="['switch-btn', { active: selectedRegion === '港' }]"
                  @click="selectedRegion = '港'"
                >港</button>
              </div>
              <div class="mode-switch">
                <button :class="['mode-btn', { active: calcMode === 'risk' }]" @click="calcMode = 'risk'">风险下限</button>
                <button :class="['mode-btn', { active: calcMode === 'amount' }]" @click="calcMode = 'amount'">下注额上限</button>
              </div>
              <input
                v-if="calcMode === 'risk'"
                v-model.number="riskThreshold"
                type="number"
                class="param-input"
              />
              <input
                v-else
                v-model.number="amountLimit"
                type="number"
                class="param-input"
                min="0"
              />
              <button class="suggest-btn" @click="fillSuggested">一键建议</button>
              <button class="copy-btn" @click="copyFormat" :disabled="!reportFormat">
                {{ copyFeedback || '复制格式' }}
              </button>
              <div class="spacer"></div>
              <span class="total-label">总金额：</span>
              <span class="total-value">{{ totalAmount || '-' }}</span>
            </div>

            <!-- 格式预览 -->
            <div v-if="reportFormat" class="format-preview" @contextmenu="ctxMenu.show">
              <pre><code>{{ reportFormat }}</code></pre>
            </div>

            <!-- 特码 / 平码：49 号码表格 -->
            <div
              v-if="activeTab === 'specialNumber' || activeTab === 'flatNumber'"
              class="report-table-wrap"
            >
              <div class="report-header">
                <span class="col-num">号码</span>
                <span class="col-zodiac">生肖</span>
                <span class="col-amount">下注额</span>
                <span class="col-risk">{{ calcMode === 'risk' ? '风险' : '超出' }}</span>
                <span class="col-eat">吃码金额</span>
                <span class="col-after">吃码后风险</span>
              </div>
              <div class="report-body">
                <div
                  v-for="row in extendedRows"
                  :key="row.id"
                  :class="['report-row', {
                    'row-danger': calcMode === 'risk'
                      ? (row.risk < riskThreshold && row.amount > 0)
                      : (row.amount > amountLimit),
                    'row-empty': row.amount === 0,
                  }]"
                >
                  <span class="col-num">{{ row.id }}</span>
                  <span class="col-zodiac">{{ NUM_ZODIAC[row.id] }}</span>
                  <span class="col-amount">{{ row.amount || '-' }}</span>
                  <span v-if="calcMode === 'risk'" :class="['col-risk', { 'risk-warn': row.risk < riskThreshold }]">
                    {{ row.amount ? row.risk : '-' }}
                  </span>
                  <span v-else :class="['col-risk', { 'risk-warn': row.amount > amountLimit }]">
                    {{ row.amount > amountLimit ? row.amount - amountLimit : '-' }}
                  </span>
                  <span class="col-eat">
                    <input
                      v-model.number="reduceInputs[row.id]"
                      type="number"
                      min="0"
                      :max="row.amount"
                      class="eat-input"
                      :class="{ 'has-suggest': row.needReduce > 0 }"
                      :placeholder="row.needReduce > 0 ? String(row.needReduce) : ''"
                    />
                  </span>
                  <span :class="['col-after', {
                    'after-ok': row.reduceAmount > 0 && row.riskAfter >= riskThreshold,
                    'after-warn': row.reduceAmount > 0 && row.riskAfter < riskThreshold,
                  }]">
                    {{ row.reduceAmount > 0 ? row.riskAfter : '-' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 连肖 / 平特（暂未实现） -->
            <div v-else class="placeholder-text">该类型暂未实现，敬请期待</div>

            <!-- 底部按钮 -->
            <div class="footer-row">
              <span v-if="!selectedPlayer" class="no-player-warn">请先在左侧选择一位玩家</span>
              <div class="spacer"></div>
              <button class="btn-cancel" @click="emit('close')">取消</button>
              <button
                class="btn-confirm"
                :disabled="!selectedPlayer"
                @click="onApply"
              >确认上报</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── 遮罩 ── */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.dialog-panel {
  width: min(780px, 92vw);
  height: min(560px, 82vh);
  display: flex; flex-direction: column;
  background: #fff;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  pointer-events: auto;
}

/* ── 标题栏 ── */
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 14px; border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-card); flex-shrink: 0;
  cursor: grab; user-select: none;
}
.dialog-header:active { cursor: grabbing; }
.dialog-title { font-size: 13px; font-weight: 700; color: var(--text-primary); letter-spacing: 0.3px; }
.dialog-close {
  width: 24px; height: 24px; border: 1px solid var(--border-subtle);
  border-radius: 50%; background: #fff; color: var(--text-muted);
  font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--ease-out);
}
.dialog-close:hover { background: #fee2e2; border-color: rgba(185,28,28,0.25); color: var(--accent-red); }

/* ── 内容 ── */
.dialog-body { flex: 1; display: flex; min-height: 0; }

/* ── 左侧 Tab ── */
.tab-bar {
  width: 100px; display: flex; flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  background: rgba(18,32,51,0.02); flex-shrink: 0; padding: 8px 0; gap: 2px;
}
.tab-btn {
  padding: 10px 16px; border: none; background: transparent;
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; text-align: left; transition: all var(--ease-out);
  border-left: 3px solid transparent;
}
.tab-btn:hover { background: rgba(37,99,235,0.05); color: var(--text-primary); }
.tab-btn.active { background: rgba(37,99,235,0.08); color: var(--accent-blue); font-weight: 700; border-left-color: var(--accent-blue); }

/* ── 右侧内容 ── */
.tab-content {
  flex: 1; display: flex; flex-direction: column;
  padding: 12px 16px 8px; overflow-y: auto; min-width: 0; gap: 8px;
}

/* ── 工具栏行 ── */
.toolbar-row {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.region-switch { display: flex; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-normal); }
.switch-btn {
  padding: 3px 12px; border: none; background: #fff;
  color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all var(--ease-out);
}
.switch-btn:first-child.active { background: #059669; color: #fff; }
.switch-btn:last-child.active { background: #dc2626; color: #fff; }
.mode-switch { display: flex; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-normal); }
.mode-btn {
  padding: 3px 10px; border: none; background: #fff;
  color: var(--text-muted); font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all var(--ease-out); white-space: nowrap;
}
.mode-btn.active { background: var(--accent-blue); color: #fff; }
.mode-btn:not(.active):hover { background: var(--surface-hover); }

.threshold-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
.param-input {
  width: 80px; padding: 3px 6px; border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm); background: var(--surface-input);
  color: var(--text-primary); font-size: 12px; text-align: center; outline: none;
}
.param-input:focus { border-color: var(--accent-blue); }
.suggest-btn {
  padding: 4px 10px; border: 1px solid var(--accent-blue);
  border-radius: var(--radius-sm); background: #eff6ff;
  color: var(--accent-blue); font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all var(--ease-out);
}
.suggest-btn:hover { background: #dbeafe; }
.copy-btn {
  padding: 4px 10px; border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm); background: #fff;
  color: var(--text-secondary); font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all var(--ease-out);
}
.copy-btn:hover:not(:disabled) { background: var(--surface-hover); border-color: var(--border-strong); }
.copy-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.total-label { font-size: 11px; color: var(--text-secondary); }
.total-value { font-size: 12px; font-weight: 800; color: var(--accent-blue); }

/* ── 格式预览 ── */
.format-preview {
  padding: 6px 10px; background: #f8fafc;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm); flex-shrink: 0;
  max-height: 96px; overflow-y: auto;
}
.format-preview pre {
  margin: 0; white-space: pre; overflow: hidden;
}
.format-preview code {
  font-size: 11px; font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  color: var(--text-primary); line-height: 1.6;
}

/* ── 表格 ── */
.report-table-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.report-header {
  display: flex; align-items: center; padding: 6px 8px;
  font-size: 10px; font-weight: 700; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(18,32,51,0.02); flex-shrink: 0; gap: 4px;
}
.report-body { flex: 1; overflow-y: auto; }
.report-row {
  display: flex; align-items: center; padding: 0 8px;
  font-size: 12px; transition: background var(--ease-out);
}
.report-row:nth-child(even) { background: rgba(18,32,51,0.015); }
.report-row:hover { background: rgba(37,99,235,0.04); }
.report-row.row-danger { background: rgba(220,38,38,0.06); }
.report-row.row-empty { opacity: 0.4; }

.col-num     { flex: 0.5; text-align: center; font-weight: 700; }
.col-zodiac  { flex: 0.5; text-align: center; color: var(--text-muted); font-size: 11px; }
.col-amount  { flex: 0.8; text-align: right; font-variant-numeric: tabular-nums; }
.col-risk    { flex: 1; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.col-eat     { flex: 1; text-align: center; }
.col-after   { flex: 1; text-align: right; font-variant-numeric: tabular-nums; }

.risk-warn { color: #dc2626; }
.after-ok  { color: #16a34a; font-weight: 700; }
.after-warn { color: #d97706; }

.eat-input {
  width: 72px; padding: 2px 6px; border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm); background: var(--surface-input);
  color: var(--text-primary); font-size: 11px; text-align: center; outline: none;
  transition: border-color var(--ease-out);
}
.eat-input:focus { border-color: var(--accent-blue); }
.eat-input.has-suggest { border-color: rgba(217,119,6,0.4); background: #fffdf5; }
.eat-input::placeholder { color: var(--text-muted); font-size: 10px; }

/* ── 底部按钮行 ── */
.footer-row {
  display: flex; align-items: center; gap: 10px;
  padding-top: 6px; border-top: 1px solid var(--border-subtle); flex-shrink: 0;
}
.spacer { flex: 1; }
.no-player-warn { font-size: 11px; color: var(--accent-red); font-weight: 600; }
.btn-cancel {
  padding: 6px 20px; border: 1px solid var(--border-normal);
  border-radius: var(--radius-md); background: #fff;
  color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all var(--ease-out);
}
.btn-cancel:hover { background: var(--surface-hover); }
.btn-confirm {
  padding: 6px 20px; border: none; border-radius: var(--radius-md);
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
  transition: all var(--ease-out);
}
.btn-confirm:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220,38,38,0.3); }
.btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.placeholder-text {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); font-size: 14px;
}
</style>
