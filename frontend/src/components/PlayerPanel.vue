<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { loadState, saveState } from '../lib/persistence'

const players = ref<string[]>(loadState('players', ['张三', '李四']))
const selectedIndex = ref<number | null>(0)
const newName = ref('')

const emit = defineEmits<{
  select: [name: string | null]
}>()

onMounted(() => {
  emit('select', players.value[0])
})

watch(players, (v) => saveState('players', v), { deep: true })

const selectPlayer = (index: number) => {
  if (selectedIndex.value === index) {
    // 取消选中
    selectedIndex.value = null
    emit('select', null)
  } else {
    selectedIndex.value = index
    emit('select', players.value[index])
  }
}

const addPlayer = () => {
  const name = newName.value.trim()
  if (!name) return
  // 避免重复
  if (players.value.includes(name)) {
    newName.value = ''
    return
  }
  players.value.push(name)
  newName.value = ''
}

const removePlayer = (index: number) => {
  players.value.splice(index, 1)
}

const onInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') addPlayer()
}
</script>

<template>
  <div class="player-panel">
    <!-- 标题 -->
    <div class="panel-header">玩家</div>

    <!-- 列表 -->
    <div class="player-list">
      <div
        v-for="(p, i) in players"
        :key="i"
        :class="['player-item', { selected: selectedIndex === i }]"
        @click="selectPlayer(i)"
      >
        <span class="player-index">{{ i + 1 }}</span>
        <span class="player-name">{{ p }}</span>
        <button class="del-btn" @click="removePlayer(i)" :title="`删除「${p}」`">&times;</button>
      </div>
      <div v-if="players.length === 0" class="empty-hint">暂无玩家</div>
    </div>

    <!-- 底部输入 -->
    <div class="panel-input">
      <input
        v-model="newName"
        type="text"
        placeholder="输入名称"
        class="name-input"
        @keydown="onInputKeydown"
      />
      <button class="add-btn" @click="addPlayer" title="新增玩家">+</button>
    </div>
  </div>
</template>

<style scoped>
.player-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  color: var(--text-primary);
  user-select: none;
}

/* 标题 */
.panel-header {
  padding: 10px 10px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  text-align: center;
  color: var(--text-secondary);
  text-transform: uppercase;
}

/* 列表 */
.player-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
  min-height: 0;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  margin-bottom: 3px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform var(--ease-out), box-shadow var(--ease-out), background-color var(--ease-out);
  font-size: 11px;
}

.player-item:hover {
  background: #fff;
  border-color: var(--glass-border);
  box-shadow: var(--shadow-xs);
  transform: translateY(-1px);
}

.player-item.selected {
  background: #eff6ff;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.del-btn {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: #fff;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  opacity: 0;
  transition: all var(--ease-out);
}

.player-item:hover .del-btn {
  opacity: 1;
}

.del-btn:hover {
  background: #fee2e2;
  border-color: rgba(185, 28, 28, 0.25);
  color: var(--accent-red);
}

.player-index {
  font-size: 9px;
  color: var(--text-muted);
  min-width: 8px;
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.player-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  text-align: left;
  flex: 1;
}

.empty-hint {
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
  padding-top: 24px;
}

/* 底部输入 */
.panel-input {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  flex-shrink: 0;
  border-top: 1px solid var(--border-subtle);
}

.name-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 11px;
  outline: none;
  transition: border-color var(--ease-out), box-shadow var(--ease-out);
}

.name-input::placeholder {
  color: var(--text-muted);
}

.name-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
}

.add-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: transform var(--ease-out), box-shadow var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}
</style>
