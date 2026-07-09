/**
 * 文本接收 - 格式转换工具
 * 输入: "1 2 3 4 5" + 特码 + 澳门 → 输出: "澳 特码 1,2,3,4=5"
 * 规则: 最后一个数字为投注金额，前面数字为投注号码，逗号分隔，等号连接金额
 */

import {
  ZODIAC,
  WUXING_KEYS,
  WAVE_COLOR_NUMBER_MAP,
  HESHU_NUMBER_MAP,
  HEAD_NUMBER_MAP,
  COLOR_ODD_MAP,
  COLOR_EVEN_MAP,
  COLOR_BIG_MAP,
  COLOR_SMALL_MAP,
  SIZE_PARITY_MAP,
} from './zodiacMap'
import { detectBetType, typeToLabel, getAllTypeKeywords } from './settingsStore'

export interface ConvertOptions {
  separators: string[]
  prefixes: string[]
  suffixes: string[]
  betType: string
  region: string   // '澳' | '港' | ''
}

// 合法的投注内容关键词白名单（属性词 + 数字之外的无效字符被过滤）
const VALID_KEYWORDS = new Set([
  ...ZODIAC,
  ...WUXING_KEYS,
  ...Object.keys(WAVE_COLOR_NUMBER_MAP),
  ...Object.keys(HESHU_NUMBER_MAP),
  ...Object.keys(HEAD_NUMBER_MAP),
  ...Object.keys(COLOR_ODD_MAP),
  ...Object.keys(COLOR_EVEN_MAP),
  ...Object.keys(COLOR_BIG_MAP),
  ...Object.keys(COLOR_SMALL_MAP),
  ...Object.keys(SIZE_PARITY_MAP),
])

/** 中文数字转阿拉伯数字 */
function chineseToNumber(chinese: string): number | null {
  const charMap: Record<string, number> = {
    '零': 0, '〇': 0,
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  }
  const unitMap: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000, '万': 10000,
  }
  if (chinese.length === 1 && charMap[chinese] !== undefined) return charMap[chinese]
  let result = 0, currentSection = 0, currentNum = 0
  for (let i = 0; i < chinese.length; i++) {
    const ch = chinese[i], num = charMap[ch], unit = unitMap[ch]
    if (num !== undefined) { currentNum = num }
    else if (unit !== undefined) {
      if (unit === 10000) { currentSection = (currentSection + currentNum) * unit; result += currentSection; currentSection = 0; currentNum = 0 }
      else { if (currentNum === 0 && unit === 10 && i === 0) currentNum = 1; currentSection += currentNum * unit; currentNum = 0 }
    } else return null
  }
  result += currentSection + currentNum
  return result
}

const CHINESE_NUM_PATTERN = '[零〇一二两三四五六七八九十百千万]+'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 地区关键词
const HK_KWS = ['香港', '香', '港']
const MC_KWS = ['澳门', '澳']

export function convertText(input: string, options: ConvertOptions): string {
  const { separators, prefixes, suffixes, betType, region } = options

  if (!input.trim()) return ''

  // 标准化（保留换行符作为行分隔）
  let processed = input
  for (const sep of separators) {
    if (sep) processed = processed.split(sep).join(' ')
  }
  processed = processed.replace(/[，。；、·:;]/g, ' ').replace(/[^\S\n]+/g, ' ')

  // 先按显式换行拆分
  const rawLines = processed.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  if (rawLines.length === 0) return ''

  const results: string[] = []

  // 收集所有类型关键词（用于从内容中移除）
  const allTypeKeywords = getAllTypeKeywords()

  for (const rawLine of rawLines) {
    // 0. 检测此行有哪些地区
    const hasHK = HK_KWS.some(kw => rawLine.includes(kw))
    const hasMC = MC_KWS.some(kw => rawLine.includes(kw))
    const targetRegions: string[] = []
    if (hasHK && hasMC) {
      targetRegions.push('港', '澳')
    } else if (hasHK) {
      targetRegions.push('港')
    } else if (hasMC) {
      targetRegions.push('澳')
    } else {
      targetRegions.push(region)
    }

    // 1. 检测行内类型关键词 → 覆盖下拉框默认值
    const detectedType = detectBetType(rawLine)
    const lineBetType = detectedType ? typeToLabel(detectedType) : betType

    // 2. 移除地区关键词和类型关键词
    let cleanLine = rawLine
    for (const kw of [...HK_KWS, ...MC_KWS, ...allTypeKeywords]) {
      cleanLine = cleanLine.replace(kw, ' ')
    }
    cleanLine = cleanLine.replace(/\s+/g, ' ').trim()
    if (!cleanLine) continue

    // 3. 按投注额关键词拆分
    const segments = splitByStakeKeyword(cleanLine, prefixes, suffixes)

    // 4. 每个段 × 每个地区 → 输出行
    for (const seg of segments) {
      for (const r of targetRegions) {
        const result = convertLine(seg, prefixes, suffixes, lineBetType, r)
        if (result) results.push(result)
      }
    }
  }

  return results.join('\n')
}

/** 构建投注金额匹配正则：前缀? + 数字 + 后缀?（至少一端存在） */
function buildStakeRegex(prefixes: string[], suffixes: string[]): RegExp {
  const parts: string[] = []

  if (prefixes.length > 0) {
    const pp = prefixes.map(escapeRegex).join('|')
    // 前缀 + 数字 + 可选后缀
    if (suffixes.length > 0) {
      const sc = suffixes.join('')
      parts.push(`(?:${pp})\\s*\\d+(?:\\.\\d+)?\\s*[${sc}]?`)
      parts.push(`(?:${pp})\\s*${CHINESE_NUM_PATTERN}\\s*[${sc}]?`)
    } else {
      parts.push(`(?:${pp})\\s*\\d+(?:\\.\\d+)?`)
      parts.push(`(?:${pp})\\s*${CHINESE_NUM_PATTERN}`)
    }
  }

  if (suffixes.length > 0) {
    const sc = suffixes.join('')
    // 数字 + 后缀（无前缀）— 用 \b 或空格边界避免误匹配普通数字
    parts.push(`\\d+(?:\\.\\d+)?\\s*[${sc}]`)
    parts.push(`${CHINESE_NUM_PATTERN}\\s*[${sc}]`)
  }

  return new RegExp(parts.join('|'), 'g')
}

/** 按投注金额关键词拆分一行：多个投注金额组时自动换行 */
function splitByStakeKeyword(line: string, prefixes: string[], suffixes: string[]): string[] {
  if (prefixes.length === 0 && suffixes.length === 0) return [line]

  const regex = buildStakeRegex(prefixes, suffixes)

  // 收集所有匹配（去重，取最长匹配优先）
  const matches: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(line)) !== null) {
    // 检查是否与上一个匹配重叠，重叠则保留更长的
    const prev = matches[matches.length - 1]
    if (prev && m.index < prev.end) {
      if (m.index + m[0].length > prev.end) {
        prev.end = m.index + m[0].length
      }
      continue
    }
    matches.push({ start: m.index, end: m.index + m[0].length })
  }

  // 只有0或1个匹配，不拆分
  if (matches.length <= 1) return [line]

  // 有2+个匹配，在每个金额关键词结束位置拆分
  const result: string[] = []
  result.push(line.substring(0, matches[0].end).trim())

  for (let i = 1; i < matches.length; i++) {
    const seg = line.substring(matches[i - 1].end, matches[i].end).trim()
    if (seg) result.push(seg)
  }

  // 最后一个匹配之后的内容：单独作为一段（无显式金额时用最后一个数字作为金额）
  const tail = line.substring(matches[matches.length - 1].end).trim()
  if (tail) {
    result.push(tail)
  }

  return result.filter(s => s.length > 0)
}

function convertLine(
  line: string,
  prefixes: string[],
  suffixes: string[],
  betType: string,
  region: string,
): string | null {
  let content = line
  let stake: number | null = null
  let stakeFound = false

  // 1. 提取前缀词 + 数字 + 可选后缀 (各5, 每10, 各5元)
  if (suffixes.length > 0) {
    const sc = suffixes.join('')
    for (const prefix of prefixes) {
      const re = new RegExp(escapeRegex(prefix) + '\\s*(\\d+(?:\\.\\d+)?)\\s*[' + sc + ']?')
      const m = content.match(re)
      if (m) {
        stake = Number(m[1])
        content = content.replace(re, ' ')
        stakeFound = true
        break
      }
    }
  }
  if (!stakeFound) {
    for (const prefix of prefixes) {
      const re = new RegExp(escapeRegex(prefix) + '\\s*(\\d+(?:\\.\\d+)?)')
      const m = content.match(re)
      if (m) {
        stake = Number(m[1])
        content = content.replace(re, ' ')
        stakeFound = true
        break
      }
    }
  }

  // 2. 提取前缀词 + 中文数字 + 可选后缀 (各五, 各五元)
  if (!stakeFound && suffixes.length > 0) {
    const sc = suffixes.join('')
    for (const prefix of prefixes) {
      const re = new RegExp(escapeRegex(prefix) + '\\s*(' + CHINESE_NUM_PATTERN + ')\\s*[' + sc + ']?')
      const m = content.match(re)
      if (m) {
        const n = chineseToNumber(m[1])
        if (n) { stake = n; content = content.replace(re, ' '); stakeFound = true; break }
      }
    }
  }
  if (!stakeFound) {
    for (const prefix of prefixes) {
      const re = new RegExp(escapeRegex(prefix) + '\\s*(' + CHINESE_NUM_PATTERN + ')')
      const m = content.match(re)
      if (m) {
        const n = chineseToNumber(m[1])
        if (n) { stake = n; content = content.replace(re, ' '); stakeFound = true; break }
      }
    }
  }

  // 3. 提取阿拉伯数字 + 货币后缀 (5元)
  if (!stakeFound && suffixes.length > 0) {
    const suffixChars = suffixes.join('')
    const re = new RegExp('(\\d+(?:\\.\\d+)?)\\s*[' + suffixChars + ']')
    const m = content.match(re)
    if (m) {
      stake = Number(m[1])
      content = content.replace(re, ' ')
      stakeFound = true
    }
  }

  // 4. 提取中文数字 + 货币后缀 (十元)
  if (!stakeFound && suffixes.length > 0) {
    const suffixChars = suffixes.join('')
    const re = new RegExp('(' + CHINESE_NUM_PATTERN + ')\\s*[' + suffixChars + ']')
    const m = content.match(re)
    if (m) {
      const n = chineseToNumber(m[1])
      if (n) { stake = n; content = content.replace(re, ' '); stakeFound = true }
    }
  }

  // 5. 兜底: 最后一个阿拉伯数字作为金额
  if (!stakeFound) {
    const nums = content.match(/\d+(?:\.\d+)?/g)
    if (nums && nums.length > 0) {
      stake = Number(nums[nums.length - 1])
      const lastIdx = content.lastIndexOf(nums[nums.length - 1])
      if (lastIdx >= 0) {
        content = content.substring(0, lastIdx) + ' ' + content.substring(lastIdx + nums[nums.length - 1].length)
      }
    }
  }

  if (stake === null || stake <= 0) return null

  // 清理残留的前缀词和后缀字符
  const prefixPattern = prefixes.map(escapeRegex).join('|')
  if (prefixPattern) content = content.replace(new RegExp(prefixPattern, 'g'), ' ')
  if (suffixes.length > 0) {
    const suffixChars = suffixes.join('')
    content = content.replace(new RegExp('[' + suffixChars + ']', 'g'), ' ')
  }

  content = content.replace(/\s+/g, ' ').trim()

  // 收集所有类型关键词（动态，含用户自定义）
  const allTypeKws = getAllTypeKeywords()
  const typeKwPattern = allTypeKws.map(escapeRegex).join('|')

  // 提取所有token（按原文顺序，保持生肖/尾数/数字的先后关系）
  const tokens: string[] = []
  let remaining = content
    .replace(/[,=]/g, ' ')
  if (typeKwPattern) {
    remaining = remaining.replace(new RegExp(typeKwPattern, 'g'), ' ')
  }

  // 按空白分割成 token，逐个按顺序处理
  const rawTokens = remaining.trim().split(/\s+/).filter(Boolean)
  for (const raw of rawTokens) {
    // 1) 尾数 token
    if (/^\d尾$/.test(raw)) {
      tokens.push(raw)
      continue
    }
    // 2) 纯数字 token
    if (/^\d+$/.test(raw)) {
      tokens.push(raw)
      continue
    }
    // 3) 合法关键词（单个）
    if (VALID_KEYWORDS.has(raw)) {
      tokens.push(raw)
      continue
    }
    // 4) 多字符粘连：用正则提取连续数字、尾数、单字关键词，保持整体
    const parts = raw.match(/\d+尾|\d+|[^\d]/g)
    if (parts) {
      for (const p of parts) {
        if (VALID_KEYWORDS.has(p) || /^\d尾$/.test(p) || /^\d+$/.test(p)) {
          tokens.push(p)
        }
      }
    }
  }

  if (tokens.length === 0) return null

  // 连肖校验：投注内容只能是生肖，且检查最小数量
  const LIANXIAO_MIN: Record<string, number> = {
    '二连肖': 2,
    '三连肖': 3,
    '四连肖': 4,
    '五连肖': 5,
  }
  const minZodiac = LIANXIAO_MIN[betType]
  if (minZodiac !== undefined) {
    const ZODIAC_SET = new Set<string>(ZODIAC)
    const zodiacTokens = tokens.filter(t => ZODIAC_SET.has(t))
    const nonZodiac = tokens.filter(t => !ZODIAC_SET.has(t))
    if (zodiacTokens.length < minZodiac) {
      const errMsg = `# 错误：${betType}至少需要${minZodiac}个生肖`
      const detail = nonZodiac.length > 0
        ? `，非生肖内容已忽略：${nonZodiac.join(' ')}`
        : zodiacTokens.length > 0
          ? `，当前仅有${zodiacTokens.length}个：${zodiacTokens.join(' ')}`
          : '，未识别到任何生肖'
      return errMsg + detail
    }
    // 只保留生肖token，过滤掉数字、尾数、五行等非生肖内容
    tokens.length = 0
    tokens.push(...zodiacTokens)
  }

  // 平特校验：投注内容只能是生肖和尾数
  if (betType === '平特') {
    const ZODIAC_SET = new Set<string>(ZODIAC)
    const validTokens = tokens.filter(t => ZODIAC_SET.has(t) || /^\d尾$/.test(t))
    const invalidTokens = tokens.filter(t => !ZODIAC_SET.has(t) && !/^\d尾$/.test(t))
    if (validTokens.length === 0) {
      return `# 错误：平特仅支持生肖和尾数，非支持内容已忽略：${invalidTokens.join(' ')}`
    }
    tokens.length = 0
    tokens.push(...validTokens)
  }

  // 特码 & 平码校验：数字必须在 1-49 范围内
  if (betType === '特码' || betType === '平码') {
    const invalidNums: string[] = []
    for (const t of tokens) {
      if (/^\d+$/.test(t)) {
        const n = Number(t)
        if (n < 1 || n > 49) invalidNums.push(t)
      }
    }
    if (invalidNums.length > 0) {
      return `# 错误：${betType}仅支持1-49的数字，以下号码不符合：${invalidNums.join('、')}`
    }
  }

  // 平码校验：投注内容只能是数字
  if (betType === '平码') {
    const nonNumeric = tokens.filter(t => !/^\d+$/.test(t))
    if (nonNumeric.length > 0) {
      return `# 错误：平码仅支持数字，以下内容不符合：${nonNumeric.join('、')}`
    }
  }

  const rp = region ? region + ' ' : ''
  return `${rp}${betType} ${tokens.join(',')}=${stake}`
}
