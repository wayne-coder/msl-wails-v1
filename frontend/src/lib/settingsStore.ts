import { reactive, watch } from 'vue'
import { loadState, saveStateDebounced } from './persistence'

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

export const settings = reactive<SettingsState>({
  typeKeywords: {
    specialNumber: ['特码', '特'],
    lianXiao2: ['二连肖', '2连肖', '二冲', '2冲', '二冲关', '2冲关', '二肖', '2肖'],
    lianXiao3: ['三连肖', '3连肖', '三冲', '3冲', '三冲关', '3冲关', '三肖', '3肖'],
    lianXiao4: ['四连肖', '4连肖', '四冲', '4冲', '四冲关', '4冲关', '四肖', '4肖'],
    lianXiao5: ['五连肖', '5连肖', '五冲', '5冲', '五冲关', '5冲关', '五肖', '5肖'],
    flatSpecial: ['平特'],
    flatNumber: ['平码'],
  },
  odds: {
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
  },
  rebate: {
    general: 15,
    specialNumber: 4,
    flatNumber: 0,
    flatSpecial4: 4,
    flatSpecial5: 0,
    lianXiao: 4,
  },
  regionKeywords: {
    hk: ['香港', '香', '港'],
    mc: ['澳门', '澳', '门', '新'],
  },
})

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

const DEFAULT_TEXT_RECEIVE_CONFIG: TextReceiveConfig = {
  separators: [' ', ',', '，', '.'],
  prefixes: ['各', '各组', '一组', '每组', '一注', '每注', '买', '='],
  suffixes: ['元', '块', '米'],
}

function loadTextReceiveConfig(): TextReceiveConfig {
  const saved = loadState('textReceiveConfig', null as TextReceiveConfig | null)
  if (saved && Array.isArray(saved.separators) && Array.isArray(saved.prefixes) && Array.isArray(saved.suffixes)) {
    return saved
  }
  return { ...DEFAULT_TEXT_RECEIVE_CONFIG }
}

export const textReceiveConfig = reactive<TextReceiveConfig>(loadTextReceiveConfig())

// 自动持久化：配置变更时防抖保存到 localStorage
watch(
  [() => [...textReceiveConfig.separators], () => [...textReceiveConfig.prefixes], () => [...textReceiveConfig.suffixes]],
  () => {
    saveStateDebounced('textReceiveConfig', {
      separators: [...textReceiveConfig.separators],
      prefixes: [...textReceiveConfig.prefixes],
      suffixes: [...textReceiveConfig.suffixes],
    })
  },
)

export const TYPE_KEYWORD_GROUPS: TypeKeywordGroup[] = [
  { key: 'specialNumber', label: '特码' },
  { key: 'lianXiao2', label: '二连肖' },
  { key: 'lianXiao3', label: '三连肖' },
  { key: 'lianXiao4', label: '四连肖' },
  { key: 'lianXiao5', label: '五连肖' },
  { key: 'flatSpecial', label: '平特' },
  { key: 'flatNumber', label: '平码' },
]
