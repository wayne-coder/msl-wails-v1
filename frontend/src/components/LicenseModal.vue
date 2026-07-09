<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { activateLicense, getDriveTypeInfo, getLicenseStatus, getMachineCode } from '@/services/desktop'
import type { DriveTypeInfo, LicenseStatus } from '@/types/desktop'

const props = withDefaults(defineProps<{
  open: boolean
  closable?: boolean
}>(), {
  closable: true,
})

const emit = defineEmits<{
  close: []
  activated: []
}>()

const status = ref<LicenseStatus | null>(null)
const driveTypeInfo = ref<DriveTypeInfo | null>(null)
const machineCode = ref('')
const activationCode = ref('')
const loading = ref(false)
const message = ref('')
const messageTone = ref<'info' | 'success' | 'error'>('info')

const statusLabel = computed(() => {
  switch (status.value?.status) {
    case 'active':
      return '已激活'
    case 'expired':
      return '已过期'
    case 'unactivated':
      return '未激活'
    default:
      return '未知'
  }
})

async function refresh() {
  status.value = await getLicenseStatus()
  machineCode.value = await getMachineCode()
  driveTypeInfo.value = await getDriveTypeInfo()
}

async function submitActivation() {
  const code = activationCode.value.trim()
  if (!code) {
    message.value = '请先输入激活码。'
    messageTone.value = 'error'
    return
  }

  loading.value = true
  const result = await activateLicense(code)
  loading.value = false

  message.value = result.reason
  messageTone.value = result.success ? 'success' : 'error'

  if (result.success) {
    activationCode.value = ''
    await refresh()
    emit('activated')
  }
}

onMounted(async () => {
  await refresh()
})

watch(() => props.open, async (val) => {
  if (val) await refresh()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="license-backdrop" @click.self="props.closable && emit('close')">
      <div class="license-panel">
        <div class="license-header">
          <h3>授权管理</h3>
          <div class="license-header-actions">
            <button class="secondary-btn" type="button" @click="refresh">刷新</button>
            <button v-if="props.closable" class="text-button" type="button" @click="emit('close')" style="font-size:18px; line-height:1; padding:4px">&times;</button>
          </div>
        </div>

        <div class="license-stats">
          <div class="license-stat">
            <span>状态</span>
            <strong>{{ statusLabel }}</strong>
          </div>
          <div class="license-stat">
            <span>剩余期限</span>
            <strong>{{ status?.remainingText ?? (status?.daysLeft ?? 0) + '天' }}</strong>
          </div>
          <div class="license-stat">
            <span>运行环境</span>
            <strong>{{ driveTypeInfo?.displayName ?? '...' }}</strong>
          </div>
        </div>

        <p class="license-hint">
          U盘与电脑需要分别激活。当前运行在<strong>{{ driveTypeInfo?.displayName ?? '未知设备' }}</strong>环境，请使用对应的激活码。
        </p>

        <label class="license-field">
          <span>机器码（{{ driveTypeInfo?.displayName ?? '...' }}）</span>
          <input :value="machineCode || status?.displayId || ''" type="text" readonly />
        </label>

        <label class="license-field">
          <span>授权信息</span>
          <textarea :value="status?.message ?? '暂无信息。'" readonly rows="2" />
        </label>

        <label class="license-field">
          <span>激活码</span>
          <textarea v-model="activationCode" placeholder="请输入激活码" rows="2" />
        </label>

        <div class="license-footer">
          <span v-if="message" class="license-msg" :class="`msg-${messageTone}`">{{ message }}</span>
          <button class="primary-btn" type="button" :disabled="loading" @click="submitActivation">
            {{ loading ? '处理中' : '激活' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.license-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}
.license-panel {
  width: min(480px, 92vw);
  background: #fff;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.license-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.license-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.license-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.license-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.license-stat {
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  text-align: center;
}
.license-stat span {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 2px;
}
.license-stat strong {
  font-size: 13px;
  color: var(--text-primary);
}
.license-hint {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.license-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.license-field span {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
.license-field input,
.license-field textarea {
  padding: 7px 10px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  outline: none;
  resize: none;
  background: var(--surface-input);
  color: var(--text-primary);
}
.license-field input:focus,
.license-field textarea:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
}
.license-field input[readonly] {
  background: var(--surface-secondary);
  color: var(--text-muted);
}
.license-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.license-msg {
  font-size: 12px;
  font-weight: 600;
}
.msg-info { color: var(--text-secondary); }
.msg-success { color: var(--accent-green); }
.msg-error { color: var(--accent-red); }
.text-button {
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.text-button:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}
</style>
