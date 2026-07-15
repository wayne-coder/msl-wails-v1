<script setup lang="ts">
import { ref, reactive, nextTick, watch } from 'vue'
import { ctxMenu } from '../lib/contextMenuState'

const props = defineProps<{
  visible: boolean
  initialMacau?: number[]
  initialHk?: number[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [macau: number[], hongkong: number[]]
}>()

// ========== 输入框 refs ==========
const macauInputRefs = ref<(HTMLInputElement | null)[]>([])
const hkInputRefs = ref<(HTMLInputElement | null)[]>([])

// ========== 输入数据 ==========
const macauNums = reactive<string[]>(Array(7).fill(''))
const hkNums = reactive<string[]>(Array(7).fill(''))

// ========== 输入处理 ==========
/** 允许的按键：数字、退格、删除、方向键、Tab、Home/End */
const ALLOWED_KEYS = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'Backspace', 'Delete', 'Tab', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
])

function handleInput(
  value: string,
  region: 'macau' | 'hk',
  index: number,
) {
  const nums = region === 'macau' ? macauNums : hkNums

  // 只保留数字
  const cleaned = value.replace(/\D/g, '')
  if (cleaned.length === 0) {
    nums[index] = ''
    return
  }

  const num = Number(cleaned)

  // 拒绝 0 和超出范围的值
  if (num < 1 || num > 49) {
    // 如果首数字是 0，保留以便用户继续输入第二个数字（如 05→5）
    if (cleaned === '0') {
      nums[index] = '0'
      return
    }
    // 多位数超出范围（如 50+），保留首数字
    const firstDigit = Number(cleaned[0])
    if (firstDigit >= 1 && firstDigit <= 9) {
      nums[index] = String(firstDigit)
    }
    return
  }

  // 合法值 1-49
  nums[index] = String(num)

  // 输入完成（两位数 或 0X 格式的个位数）时自动跳到下一个
  if ((num >= 10 || cleaned.length === 2) && index < 6) {
    nextTick(() => {
      const refs = region === 'macau' ? macauInputRefs : hkInputRefs
      const next = refs.value[index + 1]
      if (next) {
        next.focus()
        next.select()
      }
    })
  }
}

/** 粘贴处理：只提取数字，按合法值截取 */
function handlePaste(
  e: ClipboardEvent,
  region: 'macau' | 'hk',
  index: number,
) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  const cleaned = text.replace(/\D/g, '')
  if (cleaned.length === 0) return

  const num = Number(cleaned)
  const nums = region === 'macau' ? macauNums : hkNums

  if (num >= 1 && num <= 49) {
    nums[index] = String(num)
    if ((num >= 10 || cleaned.length === 2) && index < 6) {
      nextTick(() => {
        const refs = region === 'macau' ? macauInputRefs : hkInputRefs
        const next = refs.value[index + 1]
        if (next) { next.focus(); next.select() }
      })
    }
  } else if (num >= 1) {
    // 超出范围，只取首数字
    const firstDigit = Number(cleaned[0])
    if (firstDigit >= 1 && firstDigit <= 9) {
      nums[index] = String(firstDigit)
    }
  }
}

function handleKeydown(
  e: KeyboardEvent,
  region: 'macau' | 'hk',
  index: number,
) {
  // 阻止所有非法按键
  if (!ALLOWED_KEYS.has(e.key)) {
    e.preventDefault()
    return
  }

  // 防止输入超过 2 位数字
  const nums = region === 'macau' ? macauNums : hkNums
  if (/^\d$/.test(e.key) && nums[index].length >= 2) {
    e.preventDefault()
    return
  }

  const refs = region === 'macau' ? macauInputRefs : hkInputRefs

  if (e.key === 'Backspace' && !nums[index] && index > 0) {
    // 当前为空时回退到上一个输入框
    nums[index - 1] = ''
    refs.value[index - 1]?.focus()
  } else if (e.key === 'ArrowLeft' && index > 0) {
    refs.value[index - 1]?.focus()
  } else if (e.key === 'ArrowRight' && index < 6) {
    refs.value[index + 1]?.focus()
  } else if ((e.key === 'Tab' || e.key === 'Enter') && index < 6 && nums[index]) {
    e.preventDefault()
    refs.value[index + 1]?.focus()
    refs.value[index + 1]?.select()
  }
}


/** 失焦时清空无效值（如残留的 "0"） */
function handleBlur(region: 'macau' | 'hk', index: number) {
  const nums = region === 'macau' ? macauNums : hkNums
  const val = nums[index]
  if (!val) return
  const num = Number(val)
  if (num < 1 || num > 49) {
    nums[index] = ''
  }
}

// ========== 初始化 / 重置 ==========
function fillFromArray(target: string[], source?: number[]) {
  for (let i = 0; i < 7; i++) {
    target[i] = (source && i < source.length) ? String(source[i]) : ''
  }
}

function resetAll() {
  fillFromArray(macauNums, [])
  fillFromArray(hkNums, [])
}

watch(() => props.visible, (val) => {
  if (val) {
    // 打开时回填当前已确认的开奖号码
    fillFromArray(macauNums, props.initialMacau)
    fillFromArray(hkNums, props.initialHk)
  }
})

// ========== 确认 ==========
function onConfirm() {
  const macau = macauNums.map(n => Number(n)).filter(n => n >= 1 && n <= 49)
  const hk = hkNums.map(n => Number(n)).filter(n => n >= 1 && n <= 49)
  emit('confirm', macau, hk)
  emit('close')
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
          <span class="dialog-title">开奖号码录入</span>
          <button class="dialog-close" @click="emit('close')" title="关闭">&times;</button>
        </div>

        <!-- 内容 -->
        <div class="dialog-body">
          <!-- 澳门地区 -->
          <div class="region-section region-macau">
            <div class="region-header">
              <span class="region-badge macau">澳门</span>
            </div>
            <div class="number-row">
              <div
                v-for="i in 7"
                :key="'macau-' + i"
                :class="['num-group', { 'num-special': i === 7 }]"
              >
                <label :class="['num-label', { 'special-label': i === 7 }]">
                  {{ i === 7 ? '特殊号' : `${i}` }}
                </label>
                <input
                  :ref="el => macauInputRefs[i - 1] = el as HTMLInputElement | null"
                  :value="macauNums[i - 1]"
                  type="text"
                  inputmode="numeric"
                  :class="['num-input', { 'input-special': i === 7 }]"
                  maxlength="2"
                  @input="handleInput(($event.target as HTMLInputElement).value, 'macau', i - 1)"
                  @keydown="handleKeydown($event, 'macau', i - 1)"
                  @paste="handlePaste($event, 'macau', i - 1)"
                  @contextmenu="ctxMenu.show"
                  @blur="handleBlur('macau', i - 1)"
                />
              </div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div class="divider"></div>

          <!-- 香港地区 -->
          <div class="region-section region-hk">
            <div class="region-header">
              <span class="region-badge hk">香港</span>
            </div>
            <div class="number-row">
              <div
                v-for="i in 7"
                :key="'hk-' + i"
                :class="['num-group', { 'num-special': i === 7 }]"
              >
                <label :class="['num-label', { 'special-label': i === 7 }]">
                  {{ i === 7 ? '特殊号' : `${i}` }}
                </label>
                <input
                  :ref="el => hkInputRefs[i - 1] = el as HTMLInputElement | null"
                  :value="hkNums[i - 1]"
                  type="text"
                  inputmode="numeric"
                  :class="['num-input', { 'input-special': i === 7 }]"
                  maxlength="2"
                  @input="handleInput(($event.target as HTMLInputElement).value, 'hk', i - 1)"
                  @keydown="handleKeydown($event, 'hk', i - 1)"
                  @paste="handlePaste($event, 'hk', i - 1)"
                  @contextmenu="ctxMenu.show"
                  @blur="handleBlur('hk', i - 1)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="dialog-footer">
          <button class="btn-clear" @click="resetAll">清空</button>
          <div class="footer-spacer"></div>
          <button class="btn-cancel" @click="emit('close')">取消</button>
          <button class="btn-confirm" @click="onConfirm">确认对奖</button>
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
  width: min(580px, 90vw);
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
  padding: 8px 16px;
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
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.dialog-close {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: #fff;
  color: var(--text-muted);
  font-size: 16px;
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

/* ── 内容区 ── */
.dialog-body {
  padding: 24px 28px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 地区区块 ── */
.region-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.region-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.region-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.region-badge.macau {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.region-badge.hk {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.region-hint {
  font-size: 11px;
  color: var(--text-muted);
}

/* ── 号码行 ── */
.number-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.num-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.num-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  user-select: none;
}

.special-label {
  color: #d97706;
  font-weight: 700;
}

.num-input {
  width: 52px;
  height: 52px;
  border: 2px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 700;
  font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  text-align: center;
  outline: none;
  caret-color: var(--accent-blue);
  transition: border-color var(--ease-out), box-shadow var(--ease-out);
}

.num-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  z-index: 1;
}

.num-input::placeholder {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 400;
  opacity: 0.4;
}

/* 特殊号输入框 */
.input-special {
  border-color: rgba(217, 119, 6, 0.35);
  background: #fffbeb;
}

.input-special:focus {
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
}

/* 特殊号整组高亮 */
.num-special .num-input {
  position: relative;
}

/* ── 分隔线 ── */
.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 0 4px;
}

/* ── 底部按钮 ── */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 28px 18px;
}

.btn-clear {
  padding: 7px 16px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ease-out);
}

.btn-clear:hover {
  background: #fef2f2;
  border-color: rgba(185, 28, 28, 0.25);
  color: var(--accent-red);
}

.footer-spacer {
  flex: 1;
}

.btn-cancel {
  padding: 7px 20px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ease-out);
}

.btn-cancel:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.btn-confirm {
  padding: 7px 24px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--ease-out);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.22);
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.32);
}

.btn-confirm:active {
  transform: translateY(0);
}
</style>
