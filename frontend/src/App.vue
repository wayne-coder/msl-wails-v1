<script setup lang="ts">
import { onMounted } from 'vue'
import LayoutView from './components/LayoutView.vue'
import ContextMenu from './components/ContextMenu.vue'
import { migrateIfNeeded } from './services/migration'
import { loadSettingsAsync } from './lib/settingsStore'
import { readFile } from './services/fileStorage'

// localStorage keys and their corresponding file names for seeding cache.
const CACHE_SEED_MAP: Record<string, string> = {
  'msl_macauAmounts': 'macau-amounts.json',
  'msl_hongkongAmounts': 'hongkong-amounts.json',
  'msl_records': 'records.json',
  'msl_macauDrawn': 'macau-drawn.json',
  'msl_hkDrawn': 'hk-drawn.json',
  'msl_players': 'players.json',
  'msl_textReceiveConfig': 'text-receive-config.json',
}

/** Seed localStorage from file storage, but only for keys that are empty locally. */
async function seedLocalStorageFromFiles() {
  for (const [localKey, fileName] of Object.entries(CACHE_SEED_MAP)) {
    // Only seed if localStorage doesn't already have data for this key.
    if (localStorage.getItem(localKey) !== null) continue

    const content = await readFile(fileName)
    if (content) {
      try {
        localStorage.setItem(localKey, content)
      } catch {
        // ignore
      }
    }
  }
}

onMounted(async () => {
  // Slight delay so the Go runtime is fully initialized, then:
  // 1. Run one-time localStorage → file migration.
  // 2. Pre-warm localStorage cache from files (for fresh installs or data copied from another machine).
  // 3. Load settings from file storage.
  setTimeout(async () => {
    // One-time migration from legacy localStorage to file storage.
    await migrateIfNeeded()

    // Seed localStorage from files so sync loadState() calls work on fresh starts.
    await seedLocalStorageFromFiles()

    // Load settings from file (falls back to localStorage, then defaults).
    await loadSettingsAsync()
  }, 500)
})
</script>

<template>
  <div>
    <LayoutView />
    <ContextMenu />
  </div>
</template>

<style>
:root {
  /* ── XZG design system ── */
  color-scheme: light;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.38;
  font-weight: 400;
  color: #132033;

  /* ── Background ── */
  --bg-gradient-start: #f7f9fc;
  --bg-gradient-end: #eef3f8;
  --bg-warm-glow: rgba(255, 219, 92, 0.18);
  --bg-blue-glow: rgba(37, 99, 235, 0.14);

  /* ── Panel / Glass ── */
  --glass-bg: rgba(255, 255, 255, 0.88);
  --glass-border: rgba(18, 32, 51, 0.08);
  --glass-shadow: 0 12px 28px rgba(18, 32, 51, 0.06);
  --glass-blur: blur(10px);

  /* ── Column tints (subtle over glass) ── */
  --tint-player: rgba(37, 99, 235, 0.06);
  --tint-attrs: rgba(255, 255, 255, 0.92);
  --tint-toolbar: rgba(139, 92, 246, 0.04);
  --tint-aux: rgba(71, 85, 105, 0.05);
  --tint-status: rgba(5, 150, 105, 0.07);
  --tint-list-main: rgba(245, 158, 11, 0.05);
  --tint-list-side: rgba(236, 72, 153, 0.04);
  --tint-taskbar: rgba(185, 28, 28, 0.08);

  /* ── Text ── */
  --text-primary: #132033;
  --text-secondary: #617892;
  --text-muted: #94a3b8;
  --text-inverse: #ffffff;

  /* ── Accent ── */
  --accent-blue: #2563eb;
  --accent-blue-dark: #1d4ed8;
  --accent-green: #047857;
  --accent-red: #b91c1c;
  --accent-amber: #b45309;
  --accent-purple: #7c3aed;
  --accent-rose: #e11d48;
  --accent-sky: #0284c7;

  /* ── Surface ── */
  --surface-card: rgba(255, 255, 255, 0.90);
  --surface-hover: rgba(18, 32, 51, 0.04);
  --surface-input: #ffffff;
  --surface-secondary: #e8eff9;

  /* ── Borders ── */
  --border-subtle: rgba(18, 32, 51, 0.06);
  --border-normal: rgba(18, 32, 51, 0.10);
  --border-strong: rgba(18, 32, 51, 0.15);

  /* ── Radius ── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 16px;
  --radius-pill: 999px;

  /* ── Shadows ── */
  --shadow-xs: 0 1px 2px rgba(18, 32, 51, 0.04);
  --shadow-sm: 0 2px 8px rgba(18, 32, 51, 0.06);
  --shadow-md: 0 8px 24px rgba(18, 32, 51, 0.08);
  --shadow-lg: 0 12px 28px rgba(18, 32, 51, 0.10);

  /* ── Transitions ── */
  --ease-out: 0.16s ease;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100vh;
  min-height: 800px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--bg-warm-glow), transparent 28%),
    radial-gradient(circle at top right, var(--bg-blue-glow), transparent 24%),
    linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
  color: var(--text-primary);
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button, input, textarea, select {
  font: inherit;
}

button {
  cursor: pointer;
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(18, 32, 51, 0.12);
  border-radius: var(--radius-sm);
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(18, 32, 51, 0.22);
}

/* ── Primary / Secondary / Danger button base ── */
.primary-btn, .secondary-btn, .danger-btn {
  transition: transform var(--ease-out), box-shadow var(--ease-out), background-color var(--ease-out);
  border: 0;
  border-radius: var(--radius-md);
  padding: 7px 10px;
  font-size: 12px;
}
.primary-btn {
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
}
.secondary-btn {
  background: var(--surface-secondary);
  color: #17324d;
}
.danger-btn {
  background: #fee2e2;
  color: var(--accent-red);
}
.primary-btn:hover, .secondary-btn:hover, .danger-btn:hover {
  transform: translateY(-1px);
}
</style>
