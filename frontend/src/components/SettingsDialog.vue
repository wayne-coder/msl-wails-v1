<script setup lang="ts">
import { ref } from 'vue'
import { settings, TYPE_KEYWORD_GROUPS, type BetTypeKey } from '../lib/settingsStore'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ========== Tab 状态 ==========
type TabKey = 'typeKeywords' | 'regionKeywords' | 'odds' | 'rebate'
const activeTab = ref<TabKey>('typeKeywords')

const tabs: { key: TabKey; label: string }[] = [
  { key: 'typeKeywords', label: '类型关键词' },
  { key: 'regionKeywords', label: '地区关键词' },
  { key: 'odds', label: '赔率' },
  { key: 'rebate', label: '回水' },
]

// ========== 类型关键词编辑 ==========
const typeGroups = TYPE_KEYWORD_GROUPS
const initKw: Record<string, string> = {}
for (const g of typeGroups) initKw[g.key] = ''
const newKeyword = ref<Record<string, string>>(initKw)

const addKeyword = (type: string) => {
  const k = type as BetTypeKey
  const v = newKeyword.value[type].trim()
  if (v && !settings.typeKeywords[k].includes(v)) {
    settings.typeKeywords[k].push(v)
    newKeyword.value[type] = ''
  }
}
const removeKeyword = (type: string, index: number) => {
  const k = type as BetTypeKey
  settings.typeKeywords[k].splice(index, 1)
}

// ========== 地区关键词编辑 ==========
const newRegionKw = ref({ hk: '', mc: '' })

const addRegionKw = (region: 'hk' | 'mc') => {
  const v = newRegionKw.value[region].trim()
  if (v && !settings.regionKeywords[region].includes(v)) {
    settings.regionKeywords[region].push(v)
    newRegionKw.value[region] = ''
  }
}
const removeRegionKw = (region: 'hk' | 'mc', index: number) => {
  settings.regionKeywords[region].splice(index, 1)
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
          <span class="dialog-title">系统设置</span>
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
            <!-- 类型关键词 -->
            <div v-if="activeTab === 'typeKeywords'" class="tab-panel">
              <div v-for="g in typeGroups" :key="g.key" class="keyword-group">
                <div class="keyword-group-title">{{ g.label }}</div>
                <div class="tag-list">
                  <span v-for="(kw, i) in settings.typeKeywords[g.key]" :key="i" class="tag">
                    {{ kw }}<button class="tag-del" @click="removeKeyword(g.key, i)">&times;</button>
                  </span>
                  <span v-if="settings.typeKeywords[g.key].length === 0" class="empty-hint">暂无关键词</span>
                </div>
                <div class="add-row">
                  <input
                    v-model="newKeyword[g.key]"
                    type="text"
                    class="settings-input"
                    :placeholder="`添加${g.label}关键词`"
                    @keydown.enter="addKeyword(g.key)"
                  />
                  <button class="add-btn-sm" @click="addKeyword(g.key)">+</button>
                </div>
              </div>
            </div>
            <!-- 地区关键词 -->
            <div v-if="activeTab === 'regionKeywords'" class="tab-panel">
              <div class="keyword-group">
                <div class="keyword-group-title">香港 地区关键词</div>
                <div class="tag-list">
                  <span v-for="(kw, i) in settings.regionKeywords.hk" :key="i" class="tag">
                    {{ kw }}<button class="tag-del" @click="removeRegionKw('hk', i)">&times;</button>
                  </span>
                  <span v-if="settings.regionKeywords.hk.length === 0" class="empty-hint">暂无关键词</span>
                </div>
                <div class="add-row">
                  <input
                    v-model="newRegionKw.hk"
                    type="text"
                    class="settings-input"
                    placeholder="添加香港地区关键词"
                    @keydown.enter="addRegionKw('hk')"
                  />
                  <button class="add-btn-sm" @click="addRegionKw('hk')">+</button>
                </div>
              </div>
              <div class="keyword-group">
                <div class="keyword-group-title">澳门 地区关键词</div>
                <div class="tag-list">
                  <span v-for="(kw, i) in settings.regionKeywords.mc" :key="i" class="tag">
                    {{ kw }}<button class="tag-del" @click="removeRegionKw('mc', i)">&times;</button>
                  </span>
                  <span v-if="settings.regionKeywords.mc.length === 0" class="empty-hint">暂无关键词</span>
                </div>
                <div class="add-row">
                  <input
                    v-model="newRegionKw.mc"
                    type="text"
                    class="settings-input"
                    placeholder="添加澳门地区关键词"
                    @keydown.enter="addRegionKw('mc')"
                  />
                  <button class="add-btn-sm" @click="addRegionKw('mc')">+</button>
                </div>
              </div>
            </div>

            <!-- 赔率 -->
            <div v-if="activeTab === 'odds'" class="tab-panel odds-panel">
              <div class="section-title">特码 / 平码</div>
              <div class="odds-grid">
                <div class="odds-item">
                  <label>特码赔率</label>
                  <input type="number" min="1" v-model.number="settings.odds.specialNumber" />
                  <span class="odds-preview">1:{{ settings.odds.specialNumber }}</span>
                </div>
                <div class="odds-item">
                  <label>平码赔率</label>
                  <input type="number" min="1" v-model.number="settings.odds.flatNumber" />
                  <span class="odds-preview">1:{{ settings.odds.flatNumber }}</span>
                </div>
              </div>

              <div class="section-title">平特赔率</div>
              <div class="odds-grid">
                <div class="odds-item">
                  <label>默认赔率</label>
                  <input type="number" min="1" v-model.number="settings.odds.flatSpecial" />
                  <span class="odds-preview">1:{{ settings.odds.flatSpecial }}</span>
                </div>
                <div class="odds-item">
                  <label>4码组赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.flatSpecial4" />
                  <span class="odds-preview">1:{{ settings.odds.flatSpecial4 }}</span>
                </div>
                <div class="odds-item">
                  <label>5码组赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.flatSpecial5" />
                  <span class="odds-preview">1:{{ settings.odds.flatSpecial5 }}</span>
                </div>
              </div>

              <div class="section-title">连肖赔率</div>
              <div class="odds-grid odds-grid-3">
                <div class="odds-item">
                  <label>二连肖赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiao2" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiao2 }}</span>
                </div>
                <div class="odds-item">
                  <label>二连肖 含"马"赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiaoMa2" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiaoMa2 }}</span>
                </div>
                <div class="odds-item">
                  <label>三连肖赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiao3" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiao3 }}</span>
                </div>
                <div class="odds-item">
                  <label>三连肖 含"马"赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiaoMa3" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiaoMa3 }}</span>
                </div>
                <div class="odds-item">
                  <label>四连肖赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiao4" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiao4 }}</span>
                </div>
                <div class="odds-item">
                  <label>四连肖 含"马"赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiaoMa4" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiaoMa4 }}</span>
                </div>
                <div class="odds-item">
                  <label>五连肖赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiao5" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiao5 }}</span>
                </div>
                <div class="odds-item">
                  <label>五连肖 含"马"赔率</label>
                  <input type="number" min="0.1" step="0.1" v-model.number="settings.odds.lianXiaoMa5" />
                  <span class="odds-preview">1:{{ settings.odds.lianXiaoMa5 }}</span>
                </div>
              </div>
            </div>

            <!-- 回水 -->
            <div v-if="activeTab === 'rebate'" class="tab-panel odds-panel">
              <div class="section-title">回水比例</div>
              <div class="odds-grid">
                <div class="odds-item">
                  <label>通用回水</label>
                  <input type="number" min="0" max="100" v-model.number="settings.rebate.general" />
                  <span class="odds-preview">{{ settings.rebate.general }}%</span>
                </div>
                <div class="odds-item">
                  <label>特码回水</label>
                  <input type="number" min="0" max="100" v-model.number="settings.rebate.specialNumber" />
                  <span class="odds-preview">{{ settings.rebate.specialNumber }}%</span>
                </div>
                <div class="odds-item">
                  <label>平码回水</label>
                  <input type="number" min="0" max="100" v-model.number="settings.rebate.flatNumber" />
                  <span class="odds-preview">{{ settings.rebate.flatNumber }}%</span>
                </div>
                <div class="odds-item">
                  <label>平特4码组回水</label>
                  <input type="number" min="0" max="100" v-model.number="settings.rebate.flatSpecial4" />
                  <span class="odds-preview">{{ settings.rebate.flatSpecial4 }}%</span>
                </div>
                <div class="odds-item">
                  <label>平特5码组回水</label>
                  <input type="number" min="0" max="100" v-model.number="settings.rebate.flatSpecial5" />
                  <span class="odds-preview">{{ settings.rebate.flatSpecial5 }}%</span>
                </div>
                <div class="odds-item">
                  <label>连肖回水</label>
                  <input type="number" min="0" max="100" v-model.number="settings.rebate.lianXiao" />
                  <span class="odds-preview">{{ settings.rebate.lianXiao }}%</span>
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
/* ── 遮罩层（透明，不阻挡底层）── */
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

/* ── 内容区 ── */
.dialog-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ── 左侧 Tab 栏 ── */
.tab-bar {
  width: 120px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  background: rgba(18, 32, 51, 0.02);
  flex-shrink: 0;
  padding: 8px 0;
  gap: 2px;
}

.tab-btn {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all var(--ease-out);
  border-left: 3px solid transparent;
}

.tab-btn:hover {
  background: rgba(37, 99, 235, 0.05);
  color: var(--text-primary);
}

.tab-btn.active {
  background: rgba(37, 99, 235, 0.08);
  color: var(--accent-blue);
  font-weight: 700;
  border-left-color: var(--accent-blue);
}

/* ── 右侧内容 ── */
.tab-content {
  flex: 1;
  padding: 16px 20px 16px;
  overflow-y: auto;
  min-width: 0;
}

.tab-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ── 关键词组 ── */
.keyword-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.keyword-group-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 28px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: #eff6ff;
  border: 1px solid rgba(37, 99, 235, 0.20);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--accent-blue);
  font-weight: 500;
}

.tag-del {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--accent-blue);
  font-size: 14px;
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

.empty-hint {
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px 0;
}

.add-row {
  display: flex;
  gap: 4px;
}

.settings-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color var(--ease-out);
}

.settings-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
}

.add-btn-sm {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
  font-size: 16px;
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

/* ── 赔率 / 回水面板 ── */
.odds-panel {
  gap: 14px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-subtle);
}

.odds-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.odds-grid-3 {
  grid-template-columns: repeat(2, 1fr);
}

.odds-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.odds-item label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.odds-item input {
  padding: 5px 8px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  width: 100%;
  transition: border-color var(--ease-out);
}

.odds-item input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
}

.odds-preview {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-blue);
  text-align: right;
}
</style>
