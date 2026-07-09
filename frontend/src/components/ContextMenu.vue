<script setup lang="ts">
import { watch } from 'vue'
import { ctxMenu } from '../lib/contextMenuState'

// 点击菜单外部自动关闭
function onOverlayClick() {
  ctxMenu.hide()
}

// 按 Escape 关闭
watch(() => ctxMenu.visible, (v) => {
  if (v) {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { ctxMenu.hide(); document.removeEventListener('keydown', onKey) }
    }
    document.addEventListener('keydown', onKey)
  }
})
</script>

<template>
  <Teleport to="body">
    <!-- 透明遮罩：点击任意位置关闭菜单 -->
    <div
      v-if="ctxMenu.visible"
      class="ctx-overlay"
      @click="onOverlayClick"
      @contextmenu.prevent="onOverlayClick"
    >
      <div
        class="ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @click.stop
      >
        <button class="ctx-item" @mousedown.prevent="ctxMenu.copy()">
          <span class="ctx-icon">&#128203;</span>复制
        </button>
        <template v-if="ctxMenu.canEdit">
          <button class="ctx-item" @mousedown.prevent="ctxMenu.paste()">
            <span class="ctx-icon">&#128206;</span>粘贴
          </button>
          <button class="ctx-item" @mousedown.prevent="ctxMenu.cut()">
            <span class="ctx-icon">&#9986;</span>剪切
          </button>
        </template>
        <div class="ctx-divider"></div>
        <button class="ctx-item" @mousedown.prevent="ctxMenu.selectAll()">
          <span class="ctx-icon">&#9744;</span>全选
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.ctx-menu {
  position: fixed;
  min-width: 140px;
  padding: 4px 0;
  background: #fff;
  border: 1px solid var(--border-normal, rgba(18, 32, 51, 0.10));
  border-radius: var(--radius-md, 10px);
  box-shadow: 0 8px 28px rgba(18, 32, 51, 0.14);
  overflow: hidden;
  pointer-events: auto;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 14px;
  border: none;
  background: transparent;
  color: var(--text-primary, #132033);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background var(--ease-out, 0.16s ease);
}

.ctx-item:hover {
  background: rgba(37, 99, 235, 0.06);
  color: var(--accent-blue, #2563eb);
}

.ctx-icon {
  width: 18px;
  text-align: center;
  font-size: 13px;
  opacity: 0.6;
  flex-shrink: 0;
}

.ctx-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--border-subtle, rgba(18, 32, 51, 0.06));
}
</style>
