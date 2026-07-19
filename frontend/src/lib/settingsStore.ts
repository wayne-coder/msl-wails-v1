import { reactive, watch } from 'vue'
import { saveStateDebounced } from './persistence'
import { readFile, writeFile } from '@/services/fileStorage'

/** 投注类型关键词配置 */
export interface TypeKeywords {
  specialNumber: string[]
  lianXiao2: string[]
  lianXiao3: string[]
  lianXiao4: string[]
  lianXiao5: string[]
  flatSpecial: string[]
  flatNumber: string[]
}

/** 赔率配置 */
export interface OddsSettings {
  specialNumber: number
  flatNumber: number
  flatSpecial: number
  flatSpecial4: number
  flatSpecial5: number
  lianXiao2: number
  lianXiao3: number
  lianXiao4: number
  lianXiao5: number
  lianXiaoMa2: number
  lianXiaoMa3: number
  lianXiaoMa4: number
  lianXiaoMa5: number
}

/** 回水配置 */
export interface RebateSettings {
  general: number
  specialNumber: number
  flatNumber: number
  flatSpecial4: number
  flatSpecial5: number
  lianXiao: number
}

/** 地区关键词配置 */
export interface RegionKeywords {
  hk: string[]
  mc: string[]
}

export interface SettingsState {
  typeKeywords: TypeKeywords
  odds: OddsSettings
  rebate: RebateSettings
  regionKeywords: RegionKeywords
}

/** 持久化到 settings.json 的完整设置结构 */
interface PersistedSettings {
  typeKeywords: TypeKeywords
  odds: OddsSettings
  rebate: RebateSettings
  regionKeywords: RegionKeywords
  textReceiveConfig: TextReceiveConfig
}

// ========== 默认值 ==========

const DEFAULT_TYPE_KEYWORDS: TypeKeywords = {
  specialNumber: ['特码', '特'],
  lianXiao2: ['二连肖', '2连肖', '二冲', '2冲', '二冲关', '2冲关', '二肖', '2肖'],
  lianXiao3: ['三连肖', '3连肖', '三冲', '3冲', '三冲关', '3冲关', '三肖', '3肖'],
  lianXiao4: ['四连肖', '4连肖', '四冲', '4冲', '四冲关', '4冲关', '四肖', '4肖'],
  lianXiao5: ['五连肖', '5连肖', '五冲', '5冲', '五冲关', '5冲关', '五肖', '5肖'],
  flatSpecial: ['平特'],
  flatNumber: ['平码'],
}

const DEFAULT_ODDS: OddsSettings = {
  specialNumber: 47,
  flatNumber: 8,
  flatSpecial: 2,
  flatSpecial4: 2,
  flatSpecial5: 1.8,
  lianXiao2: 4.5,
  lianXiao3: 11,
  lianXiao4: 33,
  lianXiao5: 110,
  lianXiaoMa2: 4,
  lianXiaoMa3: 10,
  lianXiaoMa4: 30,
  lianXiaoMa5: 90,
}

const DEFAULT_REBATE: RebateSettings = {
  general: 15,
  specialNumber: 4,
  flatNumber: 0,
  flatSpecial4: 4,
  flatSpecial5: 0,
  lianXiao: 4,
}

const DEFAULT_REGION_KEYWORDS: RegionKeywords = {
  hk: ['香港', '香', '港'],
  mc: ['澳门', '澳', '门', '新'],
}

const DEFAULT_TEXT_RECEIVE_CONFIG: TextReceiveConfig = {
  separators: [' ', ',', '，', '.'],
  prefixes: ['各', '各组', '一组', '每组', '一注', '每注', '买', '='],
  suffixes: ['元', '块', '米'],
}

// ========== 响应式状态 ==========

export const settings = reactive<SettingsState>({
  typeKeywords: { ...DEFAULT_TYPE_KEYWORDS },
  odds: { ...DEFAULT_ODDS },
  rebate: { ...DEFAULT_REBATE },
  regionKeywords: { ...DEFAULT_REGION_KEYWORDS },
})

export const textReceiveConfig = reactive<TextReceiveConfig>({ ...DEFAULT_TEXT_RECEIVE_CONFIG })

// ========== 持久化 ==========

const SETTINGS_FILE = 'settings.json'
const SETTINGS_STORAGE_KEY = 'msl_settings'

function parseSettings(raw: string): PersistedSettings | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>

    const result: PersistedSettings = {
      typeKeywords: {
        specialNumber: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.specialNumber) ? (obj.typeKeywords as any).specialNumber.map(String) : [...DEFAULT_TYPE_KEYWORDS.specialNumber],
        lianXiao2: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.lianXiao2) ? (obj.typeKeywords as any).lianXiao2.map(String) : [...DEFAULT_TYPE_KEYWORDS.lianXiao2],
        lianXiao3: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.lianXiao3) ? (obj.typeKeywords as any).lianXiao3.map(String) : [...DEFAULT_TYPE_KEYWORDS.lianXiao3],
        lianXiao4: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.lianXiao4) ? (obj.typeKeywords as any).lianXiao4.map(String) : [...DEFAULT_TYPE_KEYWORDS.lianXiao4],
        lianXiao5: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.lianXiao5) ? (obj.typeKeywords as any).lianXiao5.map(String) : [...DEFAULT_TYPE_KEYWORDS.lianXiao5],
        flatSpecial: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.flatSpecial) ? (obj.typeKeywords as any).flatSpecial.map(String) : [...DEFAULT_TYPE_KEYWORDS.flatSpecial],
        flatNumber: Array.isArray(obj.typeKeywords) ? [] : Array.isArray((obj.typeKeywords as any)?.flatNumber) ? (obj.typeKeywords as any).flatNumber.map(String) : [...DEFAULT_TYPE_KEYWORDS.flatNumber],
      },
      odds: { ...DEFAULT_ODDS },
      rebate: { ...DEFAULT_REBATE },
      regionKeywords: { ...DEFAULT_REGION_KEYWORDS },
      textReceiveConfig: { ...DEFAULT_TEXT_RECEIVE_CONFIG },
    }

    if (obj.odds && typeof obj.odds === 'object') {
      const o = obj.odds as Record<string, unknown>
      for (const k of Object.keys(result.odds)) {
        if (typeof o[k] === 'number') (result.odds as any)[k] = o[k]
      }
    }

    if (obj.rebate && typeof obj.rebate === 'object') {
      const r = obj.rebate as Record<string, unknown>
      for (const k of Object.keys(result.rebate)) {
        if (typeof r[k] === 'number') (result.rebate as any)[k] = r[k]
      }
    }

    if (obj.regionKeywords && typeof obj.regionKeywords === 'object') {
      const rk = obj.regionKeywords as Record<string, unknown>
      if (Array.isArray(rk.hk)) result.regionKeywords.hk = rk.hk.map(String)
      if (Array.isArray(rk.mc)) result.regionKeywords.mc = rk.mc.map(String)
    }

    if (obj.textReceiveConfig && typeof obj.textReceiveConfig === 'object') {
      const tc = obj.textReceiveConfig as Record<string, unknown>
      if (Array.isArray(tc.separators)) result.textReceiveConfig.separators = tc.separators.map(String)
      if (Array.isArray(tc.prefixes)) result.textReceiveConfig.prefixes = tc.prefixes.map(String)
      if (Array.isArray(tc.suffixes)) result.textReceiveConfig.suffixes = tc.suffixes.map(String)
    }

    return result
  } catch {
    return null
  }
}

function applyLoadedSettings(loaded: PersistedSettings) {
  // Merge into reactive objects (preserve reactivity).
  Object.assign(settings.typeKeywords, loaded.typeKeywords)
  Object.assign(settings.odds, loaded.odds)
  Object.assign(settings.rebate, loaded.rebate)
  Object.assign(settings.regionKeywords, loaded.regionKeywords)
  Object.assign(textReceiveConfig, loaded.textReceiveConfig)
}

/**
 * Async loader — call at startup to load settings from MSL_Data/settings.json.
 * Falls back to localStorage if file doesn't exist yet (pre-migration or browser dev mode).
 */
export async function loadSettingsAsync(): Promise<void> {
  // 1. Try file-based storage (MSL_Data/settings.json).
  const raw = await readFile(SETTINGS_FILE)
  if (raw) {
    const parsed = parseSettings(raw)
    if (parsed) {
      applyLoadedSettings(parsed)
      return
    }
  }

  // 2. Fallback: localStorage (pre-migration data or browser dev mode).
  const localRaw = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (localRaw) {
    const parsed = parseSettings(localRaw)
    if (parsed) {
      applyLoadedSettings(parsed)
      return
    }
  }

  // 3. Nothing found — use defaults (already set on the reactive objects).
}

function persistAllSettings() {
  if (typeof window === 'undefined') return

  const data: PersistedSettings = {
    typeKeywords: JSON.parse(JSON.stringify(settings.typeKeywords)),
    odds: { ...settings.odds },
    rebate: { ...settings.rebate },
    regionKeywords: JSON.parse(JSON.stringify(settings.regionKeywords)),
    textReceiveConfig: JSON.parse(JSON.stringify(textReceiveConfig)),
  }

  const json = JSON.stringify(data)

  // Primary: file storage (fire-and-forget).
  writeFile(SETTINGS_FILE, json).catch(() => {})

  // Fallback: localStorage.
  localStorage.setItem(SETTINGS_STORAGE_KEY, json)
}

// Auto-persist ALL settings on change (debounced).
// We watch each major section individually to batch related changes.
watch(
  () => JSON.parse(JSON.stringify(settings.typeKeywords)),
  () => persistAllSettings(),
  { deep: true },
)
watch(
  () => ({ ...settings.odds }),
  () => persistAllSettings(),
)
watch(
  () => ({ ...settings.rebate }),
  () => persistAllSettings(),
)
watch(
  () => JSON.parse(JSON.stringify(settings.regionKeywords)),
  () => persistAllSettings(),
)

// Note: textReceiveConfig auto-persists via persistence.ts watcher too.
// The persistence.ts watcher still runs for backward compatibility; the
// persistAllSettings here additionally writes the combined settings file.
// We add a short debounce by wrapping in a flag:
let _persistTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [() => [...textReceiveConfig.separators], () => [...textReceiveConfig.prefixes], () => [...textReceiveConfig.suffixes]],
  () => {
    // Also persist via persistence.ts for backward compat.
    saveStateDebounced('textReceiveConfig', {
      separators: [...textReceiveConfig.separators],
      prefixes: [...textReceiveConfig.prefixes],
      suffixes: [...textReceiveConfig.suffixes],
    })
    // Debounce the combined settings write.
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(persistAllSettings, 300)
  },
)

export type BetTypeKey = keyof TypeKeywords

/** 类型 key → 显示名称 */
export function typeToLabel(type: BetTypeKey): string {
  const map: Record<BetTypeKey, string> = {
    specialNumber: '特码',
    lianXiao2: '二连肖',
    lianXiao3: '三连肖',
    lianXiao4: '四连肖',
    lianXiao5: '五连肖',
    flatSpecial: '平特',
    flatNumber: '平码',
  }
  return map[type]
}

/** 显示名称 → 类型 key */
export function labelToType(label: string): BetTypeKey | null {
  const map: Record<string, BetTypeKey> = {
    '特码': 'specialNumber',
    '二连肖': 'lianXiao2',
    '三连肖': 'lianXiao3',
    '四连肖': 'lianXiao4',
    '五连肖': 'lianXiao5',
    '平特': 'flatSpecial',
    '平码': 'flatNumber',
  }
  return map[label] ?? null
}

/** 是否为连肖类型 */
export function isLianXiao(type: BetTypeKey): boolean {
  return type.startsWith('lianXiao')
}

/** 根据文本检测投注类型，返回匹配到的类型 key，未匹配返回 null */
export function detectBetType(text: string): BetTypeKey | null {
  const tk = settings.typeKeywords
  const all: { type: BetTypeKey; kw: string }[] = []
  for (const [type, keywords] of Object.entries(tk)) {
    for (const kw of keywords) {
      all.push({ type: type as BetTypeKey, kw })
    }
  }
  // 按关键词长度降序检测
  all.sort((a, b) => b.kw.length - a.kw.length)
  for (const item of all) {
    if (text.includes(item.kw)) return item.type
  }
  return null
}

/**
 * 检测文本中 ALL 投注类型关键词，按出现顺序返回。
 * 用于"复五肖四肖"这类一行包含多个类型的场景，展开为多行输出。
 * 重叠关键词取最长匹配（如"五连肖"优先于"五肖"）。
 */
export function detectAllBetTypes(text: string): BetTypeKey[] {
  const tk = settings.typeKeywords
  const matches: { type: BetTypeKey; kw: string; index: number }[] = []

  for (const [type, keywords] of Object.entries(tk)) {
    for (const kw of keywords) {
      let startIdx = 0
      while (true) {
        const idx = text.indexOf(kw, startIdx)
        if (idx === -1) break
        matches.push({ type: type as BetTypeKey, kw, index: idx })
        startIdx = idx + kw.length
      }
    }
  }

  // 按位置升序，同位置按关键词长度降序（长词优先）
  matches.sort((a, b) => a.index - b.index || b.kw.length - a.kw.length)

  // 过滤重叠匹配：保留更长（或更先出现）的关键词
  const result: BetTypeKey[] = []
  let occupiedEnd = 0
  for (const m of matches) {
    if (m.index >= occupiedEnd) {
      result.push(m.type)
      occupiedEnd = m.index + m.kw.length
    }
  }

  return result
}

/** 获取所有类型关键词（扁平化） */
export function getAllTypeKeywords(): string[] {
  const all: string[] = []
  for (const keywords of Object.values(settings.typeKeywords)) {
    all.push(...keywords)
  }
  return all
}

/** 获取类型关键词列表（用于 UI 展示，按组排列） */
export interface TypeKeywordGroup {
  key: BetTypeKey
  label: string
}

/** 文本接收配置（共享状态，供 TextReceiveDialog 和 LayoutView 使用） */
export interface TextReceiveConfig {
  separators: string[]
  prefixes: string[]
  suffixes: string[]
}

export const TYPE_KEYWORD_GROUPS: TypeKeywordGroup[] = [
  { key: 'specialNumber', label: '特码' },
  { key: 'lianXiao2', label: '二连肖' },
  { key: 'lianXiao3', label: '三连肖' },
  { key: 'lianXiao4', label: '四连肖' },
  { key: 'lianXiao5', label: '五连肖' },
  { key: 'flatSpecial', label: '平特' },
  { key: 'flatNumber', label: '平码' },
]
