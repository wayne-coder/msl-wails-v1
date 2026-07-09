<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getLicenseStatus } from '@/services/desktop'
import type { LicenseStatus } from '@/types/desktop'

const status = ref<LicenseStatus | null>(null)
const dismissed = ref(false)

const visible = computed(() => {
  if (dismissed.value || !status.value) return false
  if (status.value.status === 'expired' || status.value.status === 'unactivated') return true
  return status.value.status === 'active' && (status.value.daysLeft ?? 999) <= 7
})

const tone = computed(() => {
  if (!status.value) return 'info'
  if (status.value.status === 'expired') return 'danger'
  if (status.value.status === 'unactivated') return 'info'
  if ((status.value.daysLeft ?? 0) <= 3) return 'warning'
  return 'soft'
})

onMounted(async () => {
  status.value = await getLicenseStatus()
})
</script>

<template>
  <div v-if="visible" class="license-banner" :class="`banner-${tone}`">
    <div>
      <strong>授权提醒</strong>
      <p>{{ status?.message }}</p>
    </div>
    <div class="banner-actions">
      <button class="secondary-btn" type="button" @click="dismissed = true">关闭</button>
    </div>
  </div>
</template>

<style scoped>
.license-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: 12px;
  gap: 12px;
  margin-bottom: 4px;
  flex-shrink: 0;
}
.license-banner strong {
  font-size: 13px;
}
.license-banner p {
  font-size: 11px;
  margin: 2px 0 0;
}
.banner-info {
  background: #eff6ff;
  border: 1px solid rgba(37, 99, 235, 0.15);
  color: var(--text-primary);
}
.banner-warning {
  background: #fffbeb;
  border: 1px solid rgba(217, 119, 6, 0.2);
  color: #92400e;
}
.banner-danger {
  background: #fef2f2;
  border: 1px solid rgba(185, 28, 28, 0.2);
  color: var(--accent-red);
}
.banner-soft {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
}
.banner-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
</style>
