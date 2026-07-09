<script setup lang="ts">
import { ref } from 'vue'
import {
  ZODIAC,
  ZODIAC_NUMBER_MAP,
  TAIL_KEYS,
  TAIL_NUMBER_MAP,
  WUXING_KEYS,
  WUXING_NUMBER_MAP,
  HEAD_KEYS,
  HEAD_NUMBER_MAP,
  COLOR_ODD_MAP,
  COLOR_EVEN_MAP,
  COLOR_BIG_MAP,
  COLOR_SMALL_MAP,
  SIZE_PARITY_MAP,
  SIZE_PARITY_SINGLE_CHAR_KEYS,
} from '../lib/zodiacMap'

const emit = defineEmits<{
  insert: [keyword: string]
  selectionChange: [selected: string[]]
}>()

// ========== 选中状态 ==========
const selected = ref<Set<string>>(new Set())

const toggleSelect = (keyword: string) => {
  if (selected.value.has(keyword)) {
    selected.value.delete(keyword)
  } else {
    selected.value.add(keyword)
  }
  // 触发响应式更新
  selected.value = new Set(selected.value)
  emit('selectionChange', [...selected.value])
}

const isSelected = (keyword: string) => selected.value.has(keyword)

// ========== 颜色映射 ==========
const zodiacColor: Record<string, string> = {
  鼠: '#4f46e5', 牛: '#b45309', 虎: '#ea580c', 兔: '#db2777',
  龙: '#059669', 蛇: '#15803d', 马: '#e11d48', 羊: '#4d7c0f',
  猴: '#7c3aed', 鸡: '#dc2626', 狗: '#0284c7', 猪: '#c026d3',
}

const headColor: Record<string, string> = {
  '0头': '#6b7280', '1头': '#b45309', '2头': '#ea580c', '3头': '#dc2626', '4头': '#e11d48',
}

const wuxingColor: Record<string, string> = {
  金: '#b45309', 木: '#059669', 水: '#2563eb', 火: '#dc2626', 土: '#78716c',
}

const otherColor: Record<string, string> = {
  合大: '#b45309', 合小: '#4d7c0f', 大单: '#ea580c', 小单: '#ca8a04',
  大双: '#0284c7', 小双: '#0d9488', 家禽: '#059669', 野兽: '#78716c',
  大: '#e11d48', 小: '#4f46e5', 单: '#7c3aed', 双: '#06b6d4',
}

// ========== 波色按三行排列 ==========
const waveRows = [
  {
    keys: ['红波', '红单', '红双', '红大', '红小'],
    numbers: (k: string) => (COLOR_ODD_MAP as Record<string, number[]>)[k] || (COLOR_EVEN_MAP as Record<string, number[]>)[k] || (COLOR_BIG_MAP as Record<string, number[]>)[k] || (COLOR_SMALL_MAP as Record<string, number[]>)[k] || waveBase(k),
    color: '#dc2626',
  },
  {
    keys: ['蓝波', '蓝单', '蓝双', '蓝大', '蓝小'],
    numbers: (k: string) => (COLOR_ODD_MAP as Record<string, number[]>)[k] || (COLOR_EVEN_MAP as Record<string, number[]>)[k] || (COLOR_BIG_MAP as Record<string, number[]>)[k] || (COLOR_SMALL_MAP as Record<string, number[]>)[k] || waveBase(k),
    color: '#2563eb',
  },
  {
    keys: ['绿波', '绿单', '绿双', '绿大', '绿小'],
    numbers: (k: string) => (COLOR_ODD_MAP as Record<string, number[]>)[k] || (COLOR_EVEN_MAP as Record<string, number[]>)[k] || (COLOR_BIG_MAP as Record<string, number[]>)[k] || (COLOR_SMALL_MAP as Record<string, number[]>)[k] || waveBase(k),
    color: '#16a34a',
  },
]

function waveBase(k: string): number[] {
  const m: Record<string, number[]> = {
    红波: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    蓝波: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    绿波: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49],
  }
  return m[k] || []
}

// ========== 其他数据 ==========
const otherItems = [
  '大单', '小单', '大双', '小双',
  '合大', '合小', '合单', '合双',
  '家禽', '野兽',
]

const getOtherNumbers = (k: string): number[] => {
  const hm: Record<string, number[]> = {
    合单: [1, 3, 5, 7, 9, 10, 12, 14, 16, 18, 21, 23, 25, 27, 29, 30, 32, 34, 36, 38, 41, 43, 45, 47, 49],
    合双: [2, 4, 6, 8, 11, 13, 15, 17, 19, 20, 22, 24, 26, 28, 31, 33, 35, 37, 39, 40, 42, 44, 46, 48],
  }
  return hm[k] || SIZE_PARITY_MAP[k] || []
}

const tipText = (label: string, numbers: number[]): string =>
  `${label}：${numbers.join(' ')}（${numbers.length}数）`

const clearSelection = () => {
  selected.value = new Set()
}

defineExpose({ clearSelection })

</script>

<template>
  <div class="attr-words">
    <!-- 十二生肖 -->
    <div class="row">
      <button v-for="z in ZODIAC" :key="z" :title="tipText(z, ZODIAC_NUMBER_MAP[z])"
        :class="['btn', { selected: isSelected(z) }]"
        :style="{ color: zodiacColor[z] }" @click="toggleSelect(z)">{{ z }}</button>
    </div>

    <!-- 头数 + 五行 -->
    <div class="row">
      <button v-for="k in HEAD_KEYS" :key="k" :title="tipText(k, HEAD_NUMBER_MAP[k])"
        :class="['btn', { selected: isSelected(k) }]"
        :style="{ color: headColor[k] }" @click="toggleSelect(k)">{{ k }}</button>
      <button v-for="k in WUXING_KEYS" :key="k" :title="tipText(k, WUXING_NUMBER_MAP[k])"
        :class="['btn', { selected: isSelected(k) }]"
        :style="{ color: wuxingColor[k] }" @click="toggleSelect(k)">{{ k }}</button>
    </div>

    <!-- 尾数 -->
    <div class="row">
      <button v-for="k in TAIL_KEYS" :key="k" :title="tipText(k + '尾', TAIL_NUMBER_MAP[k])"
        :class="['btn tail', { selected: isSelected(k + '尾') }]" @click="toggleSelect(k + '尾')">{{ k }}尾</button>
    </div>

    <!-- 波色三行 -->
    <div v-for="(row, ri) in waveRows" :key="'w' + ri" class="row">
      <button v-for="k in row.keys" :key="k"
        :title="tipText(k, row.numbers(k))"
        :class="['btn', { selected: isSelected(k) }]"
        :style="{ color: row.color }" @click="toggleSelect(k)">{{ k }}</button>
    </div>

    <!-- 大小单双 + 其他 -->
    <div class="row">
      <button v-for="k in SIZE_PARITY_SINGLE_CHAR_KEYS" :key="k" :title="tipText(k, SIZE_PARITY_MAP[k])"
        :class="['btn', { selected: isSelected(k) }]"
        :style="{ color: otherColor[k] }" @click="toggleSelect(k)">{{ k }}</button>
      <button v-for="k in otherItems" :key="k" :title="tipText(k, getOtherNumbers(k))"
        :class="['btn', { selected: isSelected(k) }]"
        :style="{ color: otherColor[k] || '#6b7280' }" @click="toggleSelect(k)">{{ k }}</button>
    </div>
  </div>
</template>

<style scoped>
.attr-words {
  width: 100%;
  height: 100%;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  flex: 1;
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 3px;
  min-height: 0;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--ease-out), box-shadow var(--ease-out), background-color var(--ease-out);
  white-space: nowrap;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  padding: 0 2px;
  letter-spacing: 0.2px;
}

.btn:hover {
  background: #fff;
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-xs);
}

.btn:active {
  transform: translateY(0);
}

.btn.selected {
  background: var(--accent-blue);
  color: #fff !important;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
}

.tail {
  background: #eff6ff;
  color: var(--accent-blue);
  border-color: rgba(37, 99, 235, 0.15);
}

.tail:hover {
  background: #dbeafe;
  border-color: rgba(37, 99, 235, 0.25);
}
</style>
