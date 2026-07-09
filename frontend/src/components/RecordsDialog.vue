<script setup lang="ts">
import { ref, computed, watch, toRef, nextTick } from 'vue'
import { useVirtualScroll } from '../lib/virtualScroll'

interface RecordEntry {
  time: string
  totalStake: number
  region: string
  betType: string
  playerName: string
  numbers: string
  stake: number
  deltas: Record<number, number>
  undo?: boolean
}

const props = defineProps<{
  visible: boolean
  records: RecordEntry[]
}>()

const emit = defineEmits<{
  close: []
  undoSelected: [indices: number[]]
}>()

// ========== 多选状态 ==========
const selectedSet = ref<Set<number>>(new Set())

// 弹窗打开/records变化时清空选中
watch(() => props.visible, (v) => {
  if (v) {
    selectedSet.value = new Set()
    // v-if="visible" 刚创建 DOM，nextTick 后 containerRef 才可用
    nextTick(() => onRecDialogScroll())
  }
})
watch(() => props.records, () => {
  selectedSet.value = new Set()
})

// ========== 虚拟滚动 ==========
const recordsRef = toRef(props, 'records')
const {
  containerRef: recDialogContainerRef,
  wrapperStyle: recDialogWrapperStyle,
  visibleItems: recDialogVisibleItems,
  visibleStart: recDialogVisibleStart,
  onScroll: onRecDialogScroll,
  offsetY: recDialogOffsetY,
} = useVirtualScroll<RecordEntry>({ items: recordsRef, itemHeight: 26, overscan: 8 })

const toggleSelect = (index: number) => {
  const next = new Set(selectedSet.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  selectedSet.value = next
}

const allSelected = computed(() => {
  const candidates = props.records.filter(r => !r.undo)
  return candidates.length > 0 && candidates.every((_, i) => {
    const realIndex = props.records.indexOf(candidates[i])
    return selectedSet.value.has(realIndex)
  })
})

const toggleAll = () => {
  if (allSelected.value) {
    selectedSet.value = new Set()
  } else {
    const next = new Set<number>()
    props.records.forEach((r, i) => {
      if (!r.undo) next.add(i)
    })
    selectedSet.value = next
  }
}

const selectedCount = computed(() => {
  let count = 0
  for (const i of selectedSet.value) {
    if (i < props.records.length && !props.records[i].undo) count++
  }
  return count
})

const onBatchUndo = () => {
  const indices: number[] = []
  for (const i of selectedSet.value) {
    if (i < props.records.length && !props.records[i].undo) {
      indices.push(i)
    }
  }
  if (indices.length === 0) return
  // 按索引降序排列，方便父组件从后往前 splice
  indices.sort((a, b) => b - a)
  emit('undoSelected', indices)
  selectedSet.value = new Set()
}

// ========== 拖动 ==========
const panelStyle = ref<Record<string, string>>({})
let dragging = false
let startX = 0
let startY = 0
let offsetX = 0
let offsetY = 0

const onDragStart = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.dialog-close')) return
  dragging = true
  startX = e.clientX
  startY = e.clientY
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

const onDragMove = (e: MouseEvent) => {
  if (!dragging) return
  offsetX += e.clientX - startX
  offsetY += e.clientY - startY
  startX = e.clientX
  startY = e.clientY
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
          <span class="dialog-title">操作记录</span>
          <button class="dialog-close" @click="emit('close')" title="关闭">&times;</button>
        </div>

        <!-- 工具栏 -->
        <div class="dialog-toolbar">
          <label class="select-all-label">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            <span>全选</span>
          </label>
          <span class="selected-count" v-if="selectedCount > 0">已选 {{ selectedCount }} 条</span>
          <button
            class="undo-btn"
            :disabled="selectedCount === 0"
            @click="onBatchUndo"
          >
            &#8634; 撤销选中
          </button>
        </div>

        <!-- 记录列表 -->
        <div class="dialog-body">
          <div v-if="records.length === 0" class="empty-hint">暂无记录</div>
          <div v-else ref="recDialogContainerRef" class="record-list" @scroll="onRecDialogScroll">
            <div :style="recDialogWrapperStyle">
              <div :style="{ transform: `translateY(${recDialogOffsetY}px)` }">
                <div
                  v-for="(r, vi) in recDialogVisibleItems"
                  :key="recDialogVisibleStart + vi"
                  :class="['record-item', { 'record-undo': r.undo, 'record-selected': selectedSet.has(recDialogVisibleStart + vi) }]"
                  @click="!r.undo && toggleSelect(recDialogVisibleStart + vi)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedSet.has(recDialogVisibleStart + vi)"
                    :disabled="r.undo"
                    @click.stop
                    @change="toggleSelect(recDialogVisibleStart + vi)"
                    class="record-checkbox"
                  />
                  <template v-if="r.undo">
                    <span class="rec-content">[{{ r.time }}]{撤销}[{{ r.totalStake }}][{{ r.region === '澳' ? '澳门' : '香港' }}][{{ r.betType }}]{{ r.playerName }} {{ r.numbers }}<template v-if="r.stake > 0"> 各{{ r.stake }}</template><template v-else-if="r.stake < 0">&nbsp;{{ r.stake }}</template></span>
                  </template>
                  <template v-else-if="r.stake < 0">
                    <span class="rec-time">[{{ r.time }}]</span>
                    <span class="rec-reduce">&lt;减额&gt;</span>
                    <span class="rec-stake">[{{ r.totalStake }}]</span>
                    <span :class="['rec-region', r.region === '澳' ? 'rec-macau' : 'rec-hk']">[{{ r.region === '澳' ? '澳门' : '香港' }}]</span>
                    <span :class="['rec-type', 'rec-type-' + r.betType]">[{{ r.betType }}]</span>
                    <span class="rec-player">{{ r.playerName }}</span>
                    <span class="rec-content">{{ r.numbers }} {{ r.stake }}</span>
                  </template>
                  <template v-else>
                    <span class="rec-time">[{{ r.time }}]</span>
                    <span class="rec-stake">[{{ r.totalStake }}]</span>
                    <span :class="['rec-region', r.region === '澳' ? 'rec-macau' : 'rec-hk']">[{{ r.region === '澳' ? '澳门' : '香港' }}]</span>
                    <span :class="['rec-type', 'rec-type-' + r.betType]">[{{ r.betType }}]</span>
                    <span class="rec-player">{{ r.playerName }}</span>
                    <span class="rec-content">{{ r.numbers }} <template v-if="r.stake > 0">各{{ r.stake }}</template></span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── 遮罩层 ── */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* ── 弹窗面板 ── */
.dialog-panel {
  width: min(700px, 90vw);
  height: min(520px, 80vh);
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  pointer-events: auto;
}

/* ── 标题栏 ── */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 14px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-card);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}

.dialog-header:active {
  cursor: grabbing;
}

.dialog-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.dialog-close {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: #fff;
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--ease-out);
}

.dialog-close:hover {
  background: #fee2e2;
  border-color: rgba(185, 28, 28, 0.25);
  color: var(--accent-red);
}

/* ── 工具栏 ── */
.dialog-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(18, 32, 51, 0.02);
  flex-shrink: 0;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.select-all-label input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--accent-blue);
  cursor: pointer;
}

.selected-count {
  font-size: 11px;
  color: var(--accent-blue);
  font-weight: 600;
  margin-left: auto;
}

.undo-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform var(--ease-out), box-shadow var(--ease-out), opacity var(--ease-out);
}

.undo-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.30);
}

.undo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── 内容区 ── */
.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 14px;
  min-height: 0;
}

.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  user-select: none;
}

/* ── 记录列表 ── */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--text-primary);
  font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  white-space: nowrap;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background var(--ease-out);
}

.record-item:not(.record-undo):hover {
  background: rgba(37, 99, 235, 0.04);
}

.record-item.record-undo {
  color: #9ca3af;
  cursor: default;
}

.record-item.record-selected {
  background: rgba(37, 99, 235, 0.07);
}

.record-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-blue);
  cursor: pointer;
  flex-shrink: 0;
}

.record-checkbox:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.rec-time { color: var(--text-secondary); flex-shrink: 0; }
.rec-stake { color: #dc2626; font-weight: 700; flex-shrink: 0; }
.rec-reduce { color: #b45309; font-weight: 700; flex-shrink: 0; }
.rec-region { font-weight: 600; flex-shrink: 0; }
.rec-macau { color: #059669; }
.rec-hk { color: #dc2626; }
.rec-player { color: var(--accent-blue); font-weight: 600; flex-shrink: 0; }

.rec-type-特码 { color: #d97706; font-weight: 600; }
.rec-type-二连肖, .rec-type-三连肖, .rec-type-四连肖, .rec-type-五连肖 { color: #7c3aed; font-weight: 600; }
.rec-type-平特 { color: #059669; font-weight: 600; }
.rec-type-平码 { color: #0284c7; font-weight: 600; }

.rec-content { flex-shrink: 0; }
</style>
