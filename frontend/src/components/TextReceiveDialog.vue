<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { convertText } from '../lib/textReceive'
import { textReceiveConfig } from '../lib/settingsStore'
import { ctxMenu } from '../lib/contextMenuState'

const props = defineProps<{
  visible: boolean
  playerName: string | null
}>()

const emit = defineEmits<{
  close: []
  record: [lines: string]
}>()

const title = computed(() => {
  return props.playerName
    ? `文本接收—${props.playerName}`
    : '文本接收—未选中玩家'
})

// ========== 文本内容 ==========
const upperText = ref('')
const lowerText = ref('')

// ========== 下拉选择 ==========
const betType = ref('特码')
const region = ref('澳门')

// ========== 配置（共享状态） ==========
const separators = textReceiveConfig.separators
const prefixes = textReceiveConfig.prefixes
const suffixes = textReceiveConfig.suffixes
const showSettings = ref(false)
const newSep = ref('')
const newPrefix = ref('')
const newSuffix = ref('')

const addSeparator = () => {
  const v = newSep.value.trim()
  if (v && !separators.includes(v)) {
    separators.push(v)
    newSep.value = ''
  }
}
const removeSeparator = (i: number) => separators.splice(i, 1)
const addPrefix = () => {
  const v = newPrefix.value.trim()
  if (v && !prefixes.includes(v)) {
    prefixes.push(v)
    newPrefix.value = ''
  }
}
const removePrefix = (i: number) => prefixes.splice(i, 1)
const addSuffix = () => {
  const v = newSuffix.value.trim()
  if (v && !suffixes.includes(v)) {
    suffixes.push(v)
    newSuffix.value = ''
  }
}
const removeSuffix = (i: number) => suffixes.splice(i, 1)

// ========== 识别：格式转换 ==========
const onRecognize = () => {
  const result = convertText(upperText.value, {
    separators: separators,
    prefixes: prefixes,
    suffixes: suffixes,
    betType: betType.value,
    region: region.value === '澳门' ? '澳' : region.value === '香港' ? '港' : '',
  })
  lowerText.value = result
}

// ========== 校验：是否有错误 ==========
const hasError = computed(() => /^# 错误：/m.test(lowerText.value))

// ========== 录入 ==========
const onRecord = () => {
  if (!lowerText.value.trim()) return
  emit('record', lowerText.value)
  lowerText.value = ''
  upperText.value = ''
}

const clearAll = () => {
  upperText.value = ''
  lowerText.value = ''
}

// ========== 自动识别（防抖 300ms）==========
let autoTimer: ReturnType<typeof setTimeout> | null = null
watch(upperText, () => {
  if (autoTimer) clearTimeout(autoTimer)
  autoTimer = setTimeout(() => onRecognize(), 300)
})

// 投注类型或地区变化时立即重新识别
watch([betType, region], () => {
  if (upperText.value.trim()) onRecognize()
})

// ========== 拖动 ==========
const panelStyle = ref<Record<string, string>>({})
let dragging = false
let startX = 0
let startY = 0
let offsetX = 0
let offsetY = 0

const onDragStart = (e: MouseEvent) => {
  // 只在标题栏按下时拖动
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
          <span class="dialog-title">{{ title }}</span>
          <button class="dialog-close" @click="emit('close')" title="关闭">&times;</button>
        </div>

        <!-- 内容：两个长文本框 -->
        <div class="dialog-body">
          <div class="select-row">
            <select v-model="betType" class="dialog-select">
              <option value="特码">特码</option>
              <option value="二连肖">二连肖</option>
              <option value="三连肖">三连肖</option>
              <option value="四连肖">四连肖</option>
              <option value="五连肖">五连肖</option>
              <option value="平特">平特</option>
              <option value="平码">平码</option>
            </select>
            <select v-model="region" class="dialog-select">
              <option value="澳门">澳门</option>
              <option value="香港">香港</option>
            </select>
          </div>
          <div class="config-row">
            <span class="config-label">数字间隔符：<em>{{ separators.join(' ') }}</em></span>
            <span class="config-label">投注额前缀词：<em>{{ prefixes.join(' ') }}</em></span>
            <span class="config-label">投注额后缀词：<em>{{ suffixes.join(' ') }}</em></span>
            <button class="settings-btn" @click="showSettings = true" title="设置">&#9881;</button>
          </div>
          <textarea
            v-model="upperText"
            class="text-area"
            placeholder=" "
            spellcheck="false"
            @contextmenu="ctxMenu.show"
          ></textarea>
          <div class="btn-row">
            <button class="action-btn" @click="onRecognize">识别</button>
            <button class="action-btn primary" :disabled="hasError" @click="onRecord">录入</button>
            <div class="btn-spacer"></div>
            <button class="action-btn clear-btn" @click="clearAll">清除所有文本</button>
          </div>
          <textarea
            v-model="lowerText"
            class="text-area"
            placeholder=" "
            spellcheck="false"
            @contextmenu="ctxMenu.show"
          ></textarea>
        </div>

        <!-- 设置弹窗 -->
        <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
          <div class="settings-panel">
            <div class="settings-header">
              <span class="settings-title">格式设置</span>
              <button class="dialog-close" @click="showSettings = false" title="关闭">&times;</button>
            </div>
            <div class="settings-body">
              <div class="settings-group">
                <span class="settings-label">数字间隔符</span>
                <div class="tag-list">
                  <span v-for="(s, i) in separators" :key="i" class="tag">
                    {{ s }}<button class="tag-del" @click="removeSeparator(i)">&times;</button>
                  </span>
                </div>
                <div class="add-row">
                  <input v-model="newSep" type="text" class="settings-input" placeholder="输入新值" @keydown.enter="addSeparator" />
                  <button class="add-btn-sm" @click="addSeparator">+</button>
                </div>
              </div>
              <div class="settings-group">
                <span class="settings-label">投注额前缀词</span>
                <div class="tag-list">
                  <span v-for="(p, i) in prefixes" :key="i" class="tag">
                    {{ p }}<button class="tag-del" @click="removePrefix(i)">&times;</button>
                  </span>
                </div>
                <div class="add-row">
                  <input v-model="newPrefix" type="text" class="settings-input" placeholder="输入新值" @keydown.enter="addPrefix" />
                  <button class="add-btn-sm" @click="addPrefix">+</button>
                </div>
              </div>
              <div class="settings-group">
                <span class="settings-label">投注额后缀词</span>
                <div class="tag-list">
                  <span v-for="(s, i) in suffixes" :key="i" class="tag">
                    {{ s }}<button class="tag-del" @click="removeSuffix(i)">&times;</button>
                  </span>
                </div>
                <div class="add-row">
                  <input v-model="newSuffix" type="text" class="settings-input" placeholder="输入新值" @keydown.enter="addSuffix" />
                  <button class="add-btn-sm" @click="addSuffix">+</button>
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
/* ── 遮罩层（透明，不阻挡底层交互）── */
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
  width: min(53em, 90vw);
  height: min(48em, 88vh);
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  pointer-events: auto;
  font-size: clamp(11px, 0.85vw, 14px);
}

/* ── 标题栏 ── */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35em 1em;
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
  font-size: 1.05em;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.dialog-close {
  width: 1.7em;
  height: 1.7em;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: #fff;
  color: var(--text-muted);
  font-size: 1.1em;
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
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  padding: 0.7em 1em;
  min-height: 0;
}

.text-area {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 0.85em 1em;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 0.95em;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
  transition: border-color var(--ease-out), box-shadow var(--ease-out);
}

.text-area:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 0.2em rgba(37, 99, 235, 0.10);
}

.text-area::placeholder {
  color: var(--text-muted);
}

/* ── 选择框行 ── */
.select-row {
  display: flex;
  gap: 0.75em;
  flex-shrink: 0;
}

.dialog-select {
  flex: 1;
  padding: 0.4em 0.7em;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 0.9em;
  outline: none;
  cursor: pointer;
  transition: border-color var(--ease-out), box-shadow var(--ease-out);
}

.dialog-select:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 0.2em rgba(37, 99, 235, 0.10);
}

/* ── 配置行 ── */
.config-row {
  display: flex;
  align-items: center;
  gap: 1em;
  flex-shrink: 0;
}

.config-label {
  font-size: 0.8em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.config-label em {
  font-style: normal;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-btn {
  margin-left: auto;
  width: 1.7em;
  height: 1.7em;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-muted);
  font-size: 1em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--ease-out);
}

.settings-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

/* ── 设置弹窗 ── */
.settings-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.30);
  border-radius: var(--radius-xl);
}

.settings-panel {
  width: 26em;
  background: #fff;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  font-size: 0.85em;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35em 1em;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-card);
}

.settings-title {
  font-size: 1em;
  font-weight: 700;
  color: var(--text-primary);
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding: 0.9em;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.settings-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
  min-height: 2em;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
  padding: 0.15em 0.4em;
  background: #eff6ff;
  border: 1px solid rgba(37, 99, 235, 0.20);
  border-radius: var(--radius-sm);
  font-size: 0.85em;
  color: var(--accent-blue);
  font-weight: 500;
}

.tag-del {
  width: 0.85em;
  height: 0.85em;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--accent-blue);
  font-size: 0.75em;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity var(--ease-out);
}

.tag-del:hover {
  opacity: 1;
  background: rgba(37, 99, 235, 0.10);
}

.add-row {
  display: flex;
  gap: 0.25em;
}

.settings-input {
  flex: 1;
  padding: 0.35em 0.5em;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 0.9em;
  outline: none;
  transition: border-color var(--ease-out);
}

.settings-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 0.2em rgba(37, 99, 235, 0.10);
}

.add-btn-sm {
  width: 1.6em;
  height: 1.6em;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
  font-size: 0.9em;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--ease-out);
}

.add-btn-sm:hover {
  transform: translateY(-1px);
}

/* ── 按钮行 ── */
.btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 0.55em;
  flex-shrink: 0;
}

.action-btn {
  padding: 0.4em 1.4em;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-primary);
  font-size: 0.9em;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--ease-out), box-shadow var(--ease-out);
}

.action-btn:hover {
  background: var(--surface-hover);
  transform: translateY(-1px);
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
  border-color: transparent;
}

.action-btn.primary:hover {
  box-shadow: 0 0.3em 0.9em rgba(37, 99, 235, 0.25);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.clear-btn {
  color: var(--text-muted);
}

.clear-btn:hover {
  color: var(--accent-red);
  border-color: rgba(185, 28, 28, 0.25);
  background: #fef2f2;
}

.btn-spacer {
  flex: 1;
}
</style>
