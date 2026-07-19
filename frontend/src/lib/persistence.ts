import { writeFile } from '@/services/fileStorage'

const PREFIX = 'msl_'

const KEYS = {
  macauAmounts: `${PREFIX}macauAmounts`,
  hongkongAmounts: `${PREFIX}hongkongAmounts`,
  records: `${PREFIX}records`,
  macauDrawn: `${PREFIX}macauDrawn`,
  hkDrawn: `${PREFIX}hkDrawn`,
  players: `${PREFIX}players`,
  textReceiveConfig: `${PREFIX}textReceiveConfig`,
} as const

/** Maps each localStorage key to its file name in MSL_Data/. */
const FILE_NAMES: Record<keyof typeof KEYS, string> = {
  macauAmounts: 'macau-amounts.json',
  hongkongAmounts: 'hongkong-amounts.json',
  records: 'records.json',
  macauDrawn: 'macau-drawn.json',
  hkDrawn: 'hk-drawn.json',
  players: 'players.json',
  textReceiveConfig: 'text-receive-config.json',
}

/**
 * Save data to localStorage (sync) and file storage (fire-and-forget).
 * localStorage is the fast sync source; file storage is the durable primary.
 */
export function saveState<T>(key: keyof typeof KEYS, data: T): void {
  // 1. Write to localStorage (sync — serves as fast init cache).
  try {
    localStorage.setItem(KEYS[key], JSON.stringify(data))
  } catch {
    // localStorage 不可用时静默失败（如隐私模式）
  }

  // 2. Write to file storage (fire-and-forget — durable persistence).
  const fileName = FILE_NAMES[key]
  writeFile(fileName, JSON.stringify(data)).catch(() => {})
}

/**
 * Load data from localStorage (sync, fast).
 * File storage is the durable source but requires async Go calls;
 * localStorage serves as the sync-read cache initialized at startup.
 */
export function loadState<T>(key: keyof typeof KEYS, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEYS[key])
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function clearAllState(): void {
  for (const k of Object.values(KEYS)) {
    try {
      localStorage.removeItem(k)
    } catch {
      // ignore
    }
  }
}

// ========== 防抖持久化 ==========
// 避免每次数据变更都同步写 localStorage，减少主线程阻塞

type StateKey = keyof typeof KEYS

/** 每个 key 独立的 debounce timer */
const timers = new Map<StateKey, ReturnType<typeof setTimeout>>()

/** 默认防抖延迟：500ms 内的多次变更合并为一次写入 */
const DEFAULT_DEBOUNCE = 500

/**
 * 防抖保存：在 debounceMs 内的多次调用只执行最后一次写入。
 * 适用于高频变更的数据（如 macauAmounts, records 等 deep watcher）
 */
export function saveStateDebounced<T>(
  key: StateKey,
  data: T,
  debounceMs: number = DEFAULT_DEBOUNCE,
): void {
  // 取消之前的定时器
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)

  timers.set(key, setTimeout(() => {
    timers.delete(key)
    saveState(key, data)
  }, debounceMs))
}

/**
 * 立即刷新指定 key 的待保存数据（取消防抖，立即写入）
 */
export function flushSave(key: StateKey): void {
  const t = timers.get(key)
  if (t) {
    clearTimeout(t)
    timers.delete(key)
  }
}

/**
 * 立即刷新所有待保存数据。
 * 应在页面关闭 / 应用退出前调用，确保数据不丢失。
 */
export function flushAllSaves(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}
