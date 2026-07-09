<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, watch, nextTick } from 'vue'
import { useVirtualScroll } from '../lib/virtualScroll'
import AttributeWords from './AttributeWords.vue'
import PlayerPanel from './PlayerPanel.vue'
import BetList from './BetList.vue'
import TextReceiveDialog from './TextReceiveDialog.vue'
import SettingsDialog from './SettingsDialog.vue'
import RecordsDialog from './RecordsDialog.vue'
import LotteryInputDialog from './LotteryInputDialog.vue'
import CodeReportDialog from './CodeReportDialog.vue'
import LicenseModal from './LicenseModal.vue'
import LicenseReminderBanner from './LicenseReminderBanner.vue'
import {
  ZODIAC,
  ZODIAC_NUMBER_MAP,
  TAIL_NUMBER_MAP,
  WUXING_NUMBER_MAP,
  HEAD_NUMBER_MAP,
  WAVE_COLOR_NUMBER_MAP,
  HESHU_NUMBER_MAP,
  COLOR_ODD_MAP,
  COLOR_EVEN_MAP,
  COLOR_BIG_MAP,
  COLOR_SMALL_MAP,
  SIZE_PARITY_MAP,
} from '../lib/zodiacMap'
import { textReceiveConfig, labelToType, detectBetType, typeToLabel, getAllTypeKeywords } from '../lib/settingsStore'
import { checkWinnings } from '../lib/lotteryCheck'
import { ctxMenu } from '../lib/contextMenuState'
import { getLicenseStatus } from '@/services/desktop'
import { saveStateDebounced, loadState, clearAllState, flushAllSaves } from '../lib/persistence'

/** 将属性词展开为号码数组，如 "金" → [4,5,12,13,...], "红波" → [1,2,7,8,...] */
function expandAttrKeyword(kw: string): number[] {
  // 生肖
  if (kw in ZODIAC_NUMBER_MAP) return [...ZODIAC_NUMBER_MAP[kw as keyof typeof ZODIAC_NUMBER_MAP]]
  // 尾数 (如 "2尾")
  const tailMatch = kw.match(/^(\d)尾$/)
  if (tailMatch && tailMatch[1] in TAIL_NUMBER_MAP) return [...TAIL_NUMBER_MAP[tailMatch[1]]]
  // 五行
  if (kw in WUXING_NUMBER_MAP) return [...WUXING_NUMBER_MAP[kw]]
  // 头数
  if (kw in HEAD_NUMBER_MAP) return [...HEAD_NUMBER_MAP[kw]]
  // 波色
  if (kw in WAVE_COLOR_NUMBER_MAP) return [...WAVE_COLOR_NUMBER_MAP[kw]]
  // 合数单双
  if (kw in HESHU_NUMBER_MAP) return [...HESHU_NUMBER_MAP[kw]]
  // 单色/双色/大色/小色
  const colorMaps: Record<string, number[]> = {
    ...COLOR_ODD_MAP, ...COLOR_EVEN_MAP, ...COLOR_BIG_MAP, ...COLOR_SMALL_MAP,
  }
  if (kw in colorMaps) return [...colorMaps[kw]]
  // 大小单双/家禽野兽等
  if (kw in SIZE_PARITY_MAP) return [...SIZE_PARITY_MAP[kw]]
  // 兜底：如果是纯数字
  const num = Number(kw)
  if (!isNaN(num) && num >= 1 && num <= 49) return [num]
  return []
}

// 码上录 - 主布局组件
// 采用 CSS Grid 实现四竖列 + 底部任务栏布局

// ========== 工具栏状态 ==========
const stakeCount = ref('')
const toolbarInput = ref('')
const defaultRegion = ref<'港' | '澳'>('澳')
const selectedAttrs = ref<string[]>([])
const stakeInputRef = ref<HTMLInputElement | null>(null)
const attrWordsRef = ref<InstanceType<typeof AttributeWords> | null>(null)

const onAttrSelectionChange = (selected: string[]) => {
  selectedAttrs.value = selected
  // 有选中属性词时自动聚焦下注数输入框
  if (selected.length > 0) {
    setTimeout(() => stakeInputRef.value?.focus(), 50)
  }
}

// ========== 玩家选中 & 文本接收弹窗 ==========
const selectedPlayer = ref<string | null>(null)
const showTextReceive = ref(false)
const showSettings = ref(false)
const showRecords = ref(false)
const showLotteryInput = ref(false)
const showCodeReport = ref(false)
const showLicenseModal = ref(false)
const licenseBannerKey = ref(0)
const showCol3 = ref(true)
const showCol4 = ref(true)

// ========== 启动时授权检查 ==========
const licenseActive = ref(false)
onMounted(async () => {
  try {
    const status = await getLicenseStatus()
    if (status.status === 'active') {
      licenseActive.value = true
    } else if (status.status === 'unactivated' || status.status === 'expired') {
      showLicenseModal.value = true
    }
  } catch {
    // 浏览器环境或 Go 后端不可用时忽略
  }
})

// ========== 开奖号码 & 中奖结果 ==========
const macauDrawn = ref<number[]>(loadState('macauDrawn', []))
const hkDrawn = ref<number[]>(loadState('hkDrawn', []))

const macauWinners = computed(() => {
  if (macauDrawn.value.length !== 7) return {}
  return checkWinnings(macauDrawn.value, displayMacauAmounts.value)
})

const hkWinners = computed(() => {
  if (hkDrawn.value.length !== 7) return {}
  return checkWinnings(hkDrawn.value, displayHongkongAmounts.value)
})

const onPlayerSelect = (name: string | null) => {
  selectedPlayer.value = name
}

// ========== 投注数据：按玩家+类型分组 ==========
// playerName → betTypeKey → num → amount
type BetAmountsByType = Record<string, Record<number, number>>
// shallowRef: 仅追踪 .value 替换，避免深度响应式追踪大对象树
// applyBetDeltas / onCodeReportApply 已使用不可变更新 (target.value = { ... })
const macauAmounts = shallowRef<Record<string, BetAmountsByType>>(loadState('macauAmounts', {}))
const hongkongAmounts = shallowRef<Record<string, BetAmountsByType>>(loadState('hongkongAmounts', {}))

// 根据选中玩家计算显示的金额：选中→仅该玩家，未选中→全部汇总
// 返回 betTypeKey → num → amount，供 BetList 各 tab 使用
function mergePlayerAmounts(
  source: Record<string, BetAmountsByType>,
  player: string | null,
): BetAmountsByType {
  const players = player ? [player] : Object.keys(source)
  const merged: BetAmountsByType = {}
  for (const p of players) {
    const betTypes = source[p]
    if (!betTypes) continue
    for (const [btKey, nums] of Object.entries(betTypes)) {
      if (!merged[btKey]) merged[btKey] = {}
      for (const [num, amt] of Object.entries(nums)) {
        merged[btKey][Number(num)] = (merged[btKey][Number(num)] ?? 0) + amt
      }
    }
  }
  return merged
}

const displayMacauAmounts = computed(() =>
  mergePlayerAmounts(macauAmounts.value, selectedPlayer.value),
)

const displayHongkongAmounts = computed(() =>
  mergePlayerAmounts(hongkongAmounts.value, selectedPlayer.value),
)

/** 平特 item（生肖/尾数）→ 对应 ID（与 BetList 平特行 id 一致） */
function encodeFlatSpecialItem(token: string): number | null {
  const zi = ZODIAC.indexOf(token as any)
  if (zi !== -1) return zi + 1           // 生肖 → 1-12
  const tm = token.match(/^(\d)尾$/)
  if (tm) return 13 + Number(tm[1])      // 尾数 → 13-22
  return null
}

/** 生成 arr 中选 k 个的所有组合 */
function combinations(arr: string[], k: number): string[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const result: string[][] = []
  const first = arr[0]
  const rest = arr.slice(1)
  // 包含 first 的组合
  for (const c of combinations(rest, k - 1)) result.push([first, ...c])
  // 不包含 first 的组合
  result.push(...combinations(rest, k))
  return result
}

/** 生肖组合 → 位图编码（每生肖占 1 bit，按 ZODIAC 顺序） */
function encodeZodiacCombo(zodiacs: string[]): number {
  let bits = 0
  for (const z of zodiacs) {
    const idx = ZODIAC.indexOf(z as any)
    if (idx !== -1) bits |= (1 << idx)
  }
  return bits
}

/** 将 targets 格式化为显示用的空格分隔字符串（多字生肖拆开，保留合单/野兽等组合词） */
function formatNumbers(targets: string[]): string {
  const parts: string[] = []
  for (const t of targets) {
    if (/^\d+$/.test(t) || /^\d尾$/.test(t) || expandAttrKeyword(t).length > 0) {
      // 数字、尾数、或可整体展开的组合词 → 保留整体
      parts.push(t)
    } else if (t.length > 1) {
      // 多字连写生肖 → 逐字拆分
      for (const ch of t) {
        if (expandAttrKeyword(ch).length > 0) parts.push(ch)
      }
    } else {
      parts.push(t)
    }
  }
  return parts.join(' ')
}

/** 写入单注金额到指定玩家+类型的账户 */
function applyBetDeltas(
  region: '澳' | '港',
  playerKey: string,
  betTypeKey: string,
  deltas: Record<number, number>,
) {
  const target = region === '澳' ? macauAmounts : hongkongAmounts
  const playerData = { ...(target.value[playerKey] ?? {}) }
  const typeData = { ...(playerData[betTypeKey] ?? {}) }
  for (const [num, add] of Object.entries(deltas)) {
    const n = Number(num)
    typeData[n] = (typeData[n] ?? 0) + add
  }
  target.value = { ...target.value, [playerKey]: { ...playerData, [betTypeKey]: typeData } }
}

// ========== 录入记录 ==========
interface RecordEntry {
  time: string
  totalStake: number
  region: string
  betType: string
  playerName: string
  numbers: string
  stake: number
  deltas: Record<number, number>
  undo?: boolean
  codeReport?: boolean
}
const records = ref<RecordEntry[]>(loadState('records', []))

// ========== 虚拟滚动：records 列表 ==========
const {
  containerRef: recordsContainerRef,
  wrapperStyle: recordsWrapperStyle,
  visibleItems: visibleRecords,
  visibleStart: recordsVisibleStart,
  onScroll: onRecordsScroll,
  offsetY: recordsOffsetY,
} = useVirtualScroll<RecordEntry>({ items: records, itemHeight: 24, overscan: 5 })

// 记录新增时保持在顶部 (最新记录通过 unshift 加在顶部)
// 用 nextTick 确保 v-if→v-else 切换后 DOM 已挂载
watch(() => records.value.length, () => {
  nextTick(() => {
    if (recordsContainerRef.value) {
      recordsContainerRef.value.scrollTop = 0
      onRecordsScroll()
    }
  })
})

const onRecordBets = (lines: string) => {
  if (!selectedPlayer.value) {
    alert('请先在左侧玩家列表中选择一位玩家')
    return
  }

  // ── 批量收集：先将所有行解析为记录，循环结束后一次性 unshift ──
  const batchedRecords: RecordEntry[] = []

  for (const line of lines.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // 解析: "港 特码 1,2,3,4=9" 或 "澳 平特 虎,龙=10"
    const match = trimmed.match(/^(港|澳)\s+(\S+)\s+(.+)=(\d+(?:\.\d+)?)$/)
    if (!match) continue
    const region = match[1]
    const betType = match[2]
    const content = match[3]      // "1,2,3,4" or "虎,龙" or "2尾"
    const stake = Number(match[4])
    const playerKey = selectedPlayer.value || '未选中'
    const betTypeKey = labelToType(betType) || 'specialNumber'
    const tokens = content.split(',').map(t => t.trim()).filter(Boolean)

    // 连肖：按生肖组合位图编码存储，自动生成 C(n,k) 组合
    if (betTypeKey.startsWith('lianXiao')) {
      const k = Number(betTypeKey.slice(-1))  // lianXiao2 → 2, lianXiao3 → 3, ...
      const zodiacTokens = [...new Set(tokens.filter(t => (ZODIAC as readonly string[]).includes(t)))]
      if (zodiacTokens.length >= k) {
        const combos = combinations(zodiacTokens, k)
        const itemDeltas: Record<number, number> = {}
        let totalStake = 0
        for (const combo of combos) {
          const bits = encodeZodiacCombo(combo)
          itemDeltas[bits] = stake
          totalStake += stake
        }
        applyBetDeltas(region as '澳' | '港', playerKey, betTypeKey, itemDeltas)
        const now = new Date()
        const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
        const cleanContent = content.replace(/,/g, ' ')
        const numberStr = cleanContent.replace(/\s+/g, ' ').trim()
        batchedRecords.push({
          time, totalStake, region, betType,
          playerName: playerKey, numbers: numberStr, stake,
          deltas: itemDeltas,
        })
      }
      continue
    }

    // 平特：按 item（生肖/尾数）编码存储，不展开到号码
    if (betTypeKey === 'flatSpecial') {
      const itemDeltas: Record<number, number> = {}
      let totalStake = 0
      for (const token of tokens) {
        const id = encodeFlatSpecialItem(token)
        if (id !== null) {
          itemDeltas[id] = (itemDeltas[id] ?? 0) + stake
          totalStake += stake
        }
      }
      applyBetDeltas(region as '澳' | '港', playerKey, betTypeKey, itemDeltas)

      const now = new Date()
      const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const cleanContent = content.replace(/,/g, ' ')
      const numberStr = cleanContent.replace(/\s+/g, ' ').trim()
      batchedRecords.push({
        time, totalStake, region, betType, playerName: playerKey,
        numbers: numberStr, stake, deltas: itemDeltas,
      })
      continue
    }

    // 特码/连肖/平码：展开属性词到号码
    const numCounts = new Map<number, number>()
    for (const token of tokens) {
      const expanded = expandAttrKeyword(token)
      if (expanded.length > 0) {
        for (const n of expanded) {
          numCounts.set(n, (numCounts.get(n) ?? 0) + 1)
        }
      }
    }

    // 兜底：直接数字（如 "1,2,3" 被 split 后每个都是纯数字）
    if (numCounts.size === 0) {
      const directNums = content.match(/\d+/g)?.map(Number).filter(n => n >= 1 && n <= 49) ?? []
      for (const n of directNums) {
        numCounts.set(n, (numCounts.get(n) ?? 0) + 1)
      }
    }
    let totalStake = 0
    const deltas: Record<number, number> = {}
    for (const [num, count] of numCounts) {
      const add = stake * count
      deltas[num] = add
      totalStake += add
    }
    applyBetDeltas(region as '澳' | '港', playerKey, betTypeKey, deltas)

    // 记录到辅助面板（批量收集，循环结束后一次性 unshift）
    const now = new Date()
    const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    const cleanContent = content.replace(/,/g, ' ')
    const numberStr = cleanContent.replace(/\s+/g, ' ').trim()
    batchedRecords.push({
      time,
      totalStake,
      region,
      betType,
      playerName: playerKey,
      numbers: numberStr,
      stake,
      deltas,
    })
  }

  // 批量写入：一次性 unshift 所有收集的记录，减少响应式更新次数
  if (batchedRecords.length > 0) {
    records.value.unshift(...batchedRecords)
  }
}

const onAttributeInsert = (keyword: string) => {
  console.log('属性词点击:', keyword)
}

const onPerStake = () => {
  if (!selectedPlayer.value) {
    alert('请先在左侧玩家列表中选择一位玩家')
    return
  }
  const stake = Number(stakeCount.value)
  if (!stake || stake <= 0 || selectedAttrs.value.length === 0) return
  const region = defaultRegion.value
  const content = selectedAttrs.value.join(',')
  const line = `${region} 特码 ${content}=${stake}`
  onRecordBets(line)
  // 清空选中和下注数
  attrWordsRef.value?.clearSelection()
  selectedAttrs.value = []
  stakeCount.value = ''
}

const onToolbarEnter = () => {
  if (!selectedPlayer.value) {
    alert('请先在左侧玩家列表中选择一位玩家')
    return
  }
  const input = toolbarInput.value.trim()
  if (!input) return

  // ── 新减额格式解析：内容 -金额 ──
  // 找到最后一个 "-数字" 作为金额分隔点
  const amountMatch = input.match(/-(\d+(?:\.\d+)?)\s*$/)
  let content: string
  let amount: number
  if (amountMatch) {
    amount = -Number(amountMatch[1])  // 减额 = 负数
    content = input.slice(0, amountMatch.index!).trim()
  } else {
    // 兼容旧格式：最后一个数字作为金额
    const nums = input.match(/\d+/g)
    if (!nums || nums.length < 2) return
    amount = Number(nums[nums.length - 1])
    const lastIdx = input.lastIndexOf(nums[nums.length - 1])
    content = input.slice(0, lastIdx).trim()
  }
  if (isNaN(amount) || amount === 0) return

  // 过滤噪音字符：前后缀词、类型关键词、特殊符号
  const noisePattern = [
    ...textReceiveConfig.prefixes,
    ...textReceiveConfig.suffixes,
    ...getAllTypeKeywords(),
  ].map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  let cleaned = content
  if (noisePattern.length > 0) {
    cleaned = cleaned.replace(new RegExp(noisePattern.join('|'), 'g'), ' ')
  }
  // 清除其余特殊符号，保留汉字、字母、数字、-、空格
  cleaned = cleaned.replace(/[^一-鿿\w\- ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return

  // 检测类型关键词
  const detectedType = detectBetType(input)
  const betTypeKey = detectedType || 'specialNumber'
  const betTypeLabel = detectedType ? typeToLabel(detectedType) : '特码'

  // 按分隔符拆分 token
  const sepPattern = textReceiveConfig.separators
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean)
  const splitRe = sepPattern.length > 0 ? new RegExp('[' + sepPattern.join('') + ']+') : / +/
  const rawTargets = cleaned.split(splitRe).filter(Boolean)
  // 过滤无效内容：只保留可展开的属性词/生肖/尾数/数字
  const targets = rawTargets.filter(t => {
    if (/^\d+$/.test(t)) { const n = Number(t); return n >= 1 && n <= 49 }
    if (/^\d尾$/.test(t)) return true
    if (expandAttrKeyword(t).length > 0) return true
    // 多字连写：至少有一个字是合法属性词
    for (const ch of t) {
      if (expandAttrKeyword(ch).length > 0) return true
    }
    return false
  })
  if (targets.length === 0) return

  const region = defaultRegion.value
  const playerKey = selectedPlayer.value || '未选中'

  // 连肖：按生肖组合位图编码存储，自动生成 C(n,k) 组合
  if (betTypeKey.startsWith('lianXiao')) {
    const k = Number(betTypeKey.slice(-1))
    // 多字连写如"虎兔"逐字拆分，再过滤生肖、去重
    const flatZodiacs: string[] = []
    for (const t of targets) {
      if ((ZODIAC as readonly string[]).includes(t)) flatZodiacs.push(t)
      else for (const ch of t) flatZodiacs.push(ch)
    }
    const zodiacTokens = [...new Set(flatZodiacs.filter(t => (ZODIAC as readonly string[]).includes(t)))]
    if (zodiacTokens.length >= k) {
      const combos = combinations(zodiacTokens, k)
      const itemDeltas: Record<number, number> = {}
      let totalStake = 0
      for (const combo of combos) {
        const bits = encodeZodiacCombo(combo)
        itemDeltas[bits] = amount
        totalStake += amount
      }
      applyBetDeltas(region, playerKey, betTypeKey, itemDeltas)
      const now = new Date()
      const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      records.value.unshift({
        time, totalStake, region, betType: betTypeLabel,
        playerName: playerKey, numbers: zodiacTokens.join(' '), stake: amount,
        deltas: itemDeltas,
      })
    }
    toolbarInput.value = ''
    return
  }

  // 平特：按 item 编码存储（多字连写如"鼠兔"逐字拆分）
  if (betTypeKey === 'flatSpecial') {
    const itemDeltas: Record<number, number> = {}
    let totalStake = 0
    const validItems: string[] = []
    for (const t of targets) {
      // 已经是合法 item（如"2尾"、"虎"）直接加入
      if (encodeFlatSpecialItem(t) !== null) {
        validItems.push(t)
      } else {
        // 尝试拆分：先提取尾数，剩余字符按单字拆分
        let rest = t
        const tailMs = rest.match(/\d尾/g)
        if (tailMs) {
          for (const tm of tailMs) {
            if (encodeFlatSpecialItem(tm) !== null) validItems.push(tm)
            rest = rest.replace(tm, '')
          }
        }
        for (const ch of rest) {
          if (encodeFlatSpecialItem(ch) !== null) validItems.push(ch)
        }
      }
    }
    for (const item of validItems) {
      const id = encodeFlatSpecialItem(item)!
      itemDeltas[id] = (itemDeltas[id] ?? 0) + amount
      totalStake += amount
    }
    if (totalStake === 0) { toolbarInput.value = ''; return }
    applyBetDeltas(region, playerKey, betTypeKey, itemDeltas)
    const now = new Date()
    const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    records.value.unshift({
      time, totalStake, region, betType: betTypeLabel,
      playerName: playerKey, numbers: validItems.join(' '), stake: amount,
      deltas: itemDeltas,
    })
    toolbarInput.value = ''
    return
  }

  // 特码/平码：展开目标到号码（多字连写如"牛鸡鼠"逐字拆分）
  const numSet = new Map<number, number>()
  for (const t of targets) {
    const expanded = expandAttrKeyword(t)
    if (expanded.length > 0) {
      for (const n of expanded) {
        numSet.set(n, (numSet.get(n) ?? 0) + 1)
      }
    } else if (!/^\d+$/.test(t) && t.length > 1) {
      // 非纯数字的多字串，逐字拆分后各自展开
      for (const ch of t) {
        const chExpanded = expandAttrKeyword(ch)
        if (chExpanded.length > 0) {
          for (const n of chExpanded) {
            numSet.set(n, (numSet.get(n) ?? 0) + 1)
          }
        }
      }
    }
  }

  // 兜底：纯数字（当 expandAttrKeyword 未收录时用正则提取）
  if (numSet.size === 0) {
    const directNums: number[] = []
    for (const t of targets) {
      const ms = t.match(/\d+/g)
      if (ms) for (const m of ms) directNums.push(Number(m))
    }
    for (const n of directNums.filter(n => n >= 1 && n <= 49)) {
      numSet.set(n, (numSet.get(n) ?? 0) + 1)
    }
  }

  if (numSet.size === 0) { toolbarInput.value = ''; return }

  const deltas: Record<number, number> = {}
  let totalStake = 0
  for (const [num, count] of numSet) {
    const add = amount * count
    deltas[num] = add
    totalStake += add
  }
  applyBetDeltas(region, playerKey, betTypeKey, deltas)

  const now = new Date()
  const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  records.value.unshift({
    time, totalStake, region, betType: betTypeLabel,
    playerName: playerKey, numbers: formatNumbers(targets), stake: amount, deltas,
  })

  toolbarInput.value = ''
}

const onTextReceive = () => {
  showTextReceive.value = !showTextReceive.value
}

const onUndo = () => {
  // 找到第一条非撤销记录
  const idx = records.value.findIndex(r => !r.undo)
  if (idx === -1) return
  const last = records.value[idx]
  const playerKey = last.playerName
  const betTypeKey = labelToType(last.betType) || 'specialNumber'
  // 取反 deltas 以撤销
  const negDeltas: Record<number, number> = {}
  for (const [num, add] of Object.entries(last.deltas)) {
    negDeltas[Number(num)] = -add
  }
  applyBetDeltas(last.region as '澳' | '港', playerKey, betTypeKey, negDeltas)

  // 移除原记录，新增撤销记录
  records.value.splice(idx, 1)
  const now = new Date()
  const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  records.value.unshift({
    time,
    totalStake: last.totalStake,
    region: last.region,
    betType: last.betType,
    playerName: last.playerName,
    numbers: last.numbers,
    stake: last.stake,
    deltas: {},
    undo: true,
  })
}

const onUndoSelected = (indices: number[]) => {
  // indices 已按降序排列
  const now = new Date()
  const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  // Phase 1: 反转所有金额变更，收集撤销标记
  const undoMarkers: RecordEntry[] = []
  for (const idx of indices) {
    const r = records.value[idx]
    if (!r || r.undo) continue
    const playerKey = r.playerName
    const betTypeKey = labelToType(r.betType) || 'specialNumber'
    const negDeltas: Record<number, number> = {}
    for (const [num, add] of Object.entries(r.deltas)) {
      negDeltas[Number(num)] = -add
    }
    applyBetDeltas(r.region as '澳' | '港', playerKey, betTypeKey, negDeltas)
    undoMarkers.push({
      time,
      totalStake: r.totalStake,
      region: r.region,
      betType: r.betType,
      playerName: r.playerName,
      numbers: r.numbers,
      stake: r.stake,
      deltas: {},
      undo: true,
    })
  }

  // Phase 2: 按降序移除原记录（无插入操作，索引不受影响）
  for (const idx of indices) {
    if (records.value[idx] && !records.value[idx].undo) {
      records.value.splice(idx, 1)
    }
  }

  // Phase 3: 批量插入撤销标记到头部
  records.value.unshift(...undoMarkers)
}

const onCodeReportApply = (region: '澳' | '港', betType: string, reductions: Record<number, number>, detail: string) => {
  if (!selectedPlayer.value) return
  const playerKey = selectedPlayer.value
  const target = region === '澳' ? macauAmounts : hongkongAmounts

  // 深拷贝当前玩家数据
  const playerData = { ...(target.value[playerKey] ?? {}) }
  const typeData = { ...(playerData[betType] ?? {}) }

  let totalReduction = 0
  for (const [numStr, reduceAmt] of Object.entries(reductions)) {
    const num = Number(numStr)
    const current = typeData[num] ?? 0
    if (reduceAmt >= current) {
      totalReduction += current
      delete typeData[num]
    } else {
      totalReduction += reduceAmt
      typeData[num] = current - reduceAmt
    }
  }

  // 清理空值后写回
  const cleaned: Record<number, number> = {}
  for (const [n, amt] of Object.entries(typeData)) {
    if (amt !== 0) cleaned[Number(n)] = amt
  }
  target.value = {
    ...target.value,
    [playerKey]: { ...playerData, [betType]: Object.keys(cleaned).length > 0 ? cleaned : undefined as any },
  }

  // 生成记录
  const now = new Date()
  const time = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const typeLabel = typeToLabel(betType as any) || betType
  records.value.unshift({
    time,
    totalStake: -totalReduction,
    region,
    betType: typeLabel,
    playerName: playerKey,
    numbers: detail,
    stake: -totalReduction,
    codeReport: true,
    deltas: (() => {
      const d: Record<number, number> = {}
      for (const [n, amt] of Object.entries(reductions)) d[Number(n)] = -amt
      return d
    })(),
  })
}

const onLotteryConfirm = (macau: number[], hongkong: number[]) => {
  macauDrawn.value = macau
  hkDrawn.value = hongkong
}

const onClearData = () => {
  macauAmounts.value = {}
  hongkongAmounts.value = {}
  macauDrawn.value = []
  hkDrawn.value = []
  records.value = []
  clearAllState()
}

// ========== 自动持久化 (防抖 500ms，减少 localStorage 同步写入) ==========
watch(macauAmounts, (v) => saveStateDebounced('macauAmounts', v), { deep: true })
watch(hongkongAmounts, (v) => saveStateDebounced('hongkongAmounts', v), { deep: true })
watch(records, (v) => saveStateDebounced('records', v), { deep: true })
watch(macauDrawn, (v) => saveStateDebounced('macauDrawn', v), { deep: true })
watch(hkDrawn, (v) => saveStateDebounced('hkDrawn', v), { deep: true })

// 窗口关闭前强制刷新所有待保存数据
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushAllSaves)
}
</script>

<template>
  <div class="app-shell">
    <LicenseReminderBanner :key="licenseBannerKey" />
    <div class="layout-container">
      <!-- ========== 第一竖列：玩家面板 ========== -->
      <aside class="col col-1">
        <PlayerPanel @select="onPlayerSelect" />
      </aside>

      <!-- ========== 第二竖列：上部复合区块 ========== -->
      <section class="col col-2">
        <!-- 上层：属性词区域 -->
        <div class="col-2-top">
          <AttributeWords ref="attrWordsRef" @insert="onAttributeInsert" @selection-change="onAttrSelectionChange" />
        </div>

        <!-- 中层：工具栏（三行） -->
        <div class="col-2-mid">
          <!-- 第一行：下注数 + 每注 -->
          <div class="toolbar-row">
            <div class="region-switch">
              <button :class="['switch-btn', { active: defaultRegion === '澳' }]" @click="defaultRegion = '澳'">澳</button>
              <button :class="['switch-btn', { active: defaultRegion === '港' }]" @click="defaultRegion = '港'">港</button>
            </div>
            <label class="toolbar-label">下注数</label>
            <input ref="stakeInputRef" v-model="stakeCount" type="text" class="toolbar-input" placeholder="0"
              inputmode="numeric" @input="stakeCount = stakeCount.replace(/\D/g, '')" @keydown.enter="onPerStake"
              @contextmenu="ctxMenu.show" />
            <button class="toolbar-btn primary" @click="onPerStake">
              每注
            </button>
          </div>

          <!-- 第二行：文本接收 + 撤销 -->
          <div class="toolbar-row">
            <button class="toolbar-btn" @click="onTextReceive">
              文本接收
            </button>
            <button class="toolbar-btn" @click="onUndo">
              撤销
            </button>
            <label class="col-toggle" style="margin-left: auto;"><input type="checkbox" v-model="showCol3" />澳门</label>
            <label class="col-toggle" style="margin-left: 10px;"><input type="checkbox" v-model="showCol4" />香港</label>
          </div>

          <!-- 第三行：输入框 -->
          <div class="toolbar-row">
            <input v-model="toolbarInput" type="text" class="toolbar-input full" placeholder="减额"
              @keydown.enter="onToolbarEnter" @contextmenu="ctxMenu.show" />
          </div>
        </div>
      </section>

      <!-- ========== 辅助面板（横跨列1-2） ========== -->
      <div class="col-2-bottom">
        <div v-if="records.length === 0" class="placeholder-text">暂无记录</div>
        <div v-else ref="recordsContainerRef" class="record-list" @scroll="onRecordsScroll">
          <div :style="recordsWrapperStyle">
            <div :style="{ transform: `translateY(${recordsOffsetY}px)` }">
              <div v-for="(r, vi) in visibleRecords" :key="recordsVisibleStart + vi" :class="['record-item', { 'record-undo': r.undo }]">
                <template v-if="r.undo">
                  [{{ r.time }}]{撤销}[{{ r.totalStake }}][{{ r.region === '澳' ? '澳门' : '香港' }}][{{ r.betType }}]{{
                    r.playerName }} {{ r.numbers }}<template v-if="r.stake > 0"> 各{{ r.stake }}</template><template
                    v-else-if="r.stake < 0">&nbsp;{{ r.stake }}</template>
                </template>
                <template v-else-if="r.codeReport">
                  <span class="rec-time">[{{ r.time }}]</span>
                  <span class="rec-report">&lt;吃码减额&gt;</span>
                  <span class="rec-stake">[{{ r.totalStake }}]</span>
                  <span :class="['rec-region', r.region === '澳' ? 'rec-macau' : 'rec-hk']">[{{ r.region === '澳' ? '澳门' :
                    '香港' }}]</span>
                  <span :class="['rec-type', 'rec-type-' + r.betType]">[{{ r.betType }}]</span>
                  <span class="rec-player">{{ r.playerName }}</span>
                  &nbsp;{{ r.numbers }}
                </template>
                <template v-else-if="r.stake < 0">
                  <span class="rec-time">[{{ r.time }}]</span>
                  <span class="rec-reduce">&lt;减额&gt;</span>
                  <span class="rec-stake">[{{ r.totalStake }}]</span>
                  <span :class="['rec-region', r.region === '澳' ? 'rec-macau' : 'rec-hk']">[{{ r.region === '澳' ? '澳门' :
                    '香港' }}]</span>
                  <span :class="['rec-type', 'rec-type-' + r.betType]">[{{ r.betType }}]</span>
                  <span class="rec-player">{{ r.playerName }}</span>
                  {{ r.numbers }} {{ r.stake }}
                </template>
                <template v-else>
                  <span class="rec-time">[{{ r.time }}]</span>
                  <span class="rec-stake">[{{ r.totalStake }}]</span>
                  <span :class="['rec-region', r.region === '澳' ? 'rec-macau' : 'rec-hk']">[{{ r.region === '澳' ? '澳门' :
                    '香港' }}]</span>
                  <span :class="['rec-type', 'rec-type-' + r.betType]">[{{ r.betType }}]</span>
                  <span class="rec-player">{{ r.playerName }}</span>
                  {{ r.numbers }}<template v-if="r.stake > 0"> 各{{ r.stake }}</template>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 状态栏按钮（横跨列1-2） ========== -->
      <div class="col-2-footer">
        <button class="status-btn" @click="showLotteryInput = !showLotteryInput">对奖</button>
        <button class="status-btn" @click="showCodeReport = !showCodeReport">吃码上报</button>
        <button class="status-btn" @click="showRecords = !showRecords">操作记录</button>
        <button class="status-btn" @click="showLicenseModal = true">软件激活</button>
        <button class="status-btn" @click="showSettings = !showSettings">系统设置</button>
        <button class="status-btn danger" @click="onClearData">数据清空</button>
      </div>

      <!-- ========== 第三竖列：澳门 ========== -->
      <main v-if="showCol3" :class="['col', 'col-3', { 'col-span': !showCol4 }]">
        <BetList :amounts="displayMacauAmounts" region="澳门" :winning-nums="macauWinners" />
      </main>

      <!-- ========== 第四竖列：香港 ========== -->
      <aside v-if="showCol4" :class="['col', 'col-4', { 'col-span': !showCol3 }]">
        <BetList :amounts="displayHongkongAmounts" region="香港" :winning-nums="hkWinners" />
      </aside>
    </div>

    <!-- ========== 文本接收弹窗 ========== -->
    <TextReceiveDialog :visible="showTextReceive" :player-name="selectedPlayer" @close="showTextReceive = false"
      @record="onRecordBets" />

    <!-- ========== 系统设置弹窗 ========== -->
    <SettingsDialog :visible="showSettings" @close="showSettings = false" />

    <!-- ========== 开奖号码录入弹窗 ========== -->
    <LotteryInputDialog :visible="showLotteryInput" :initial-macau="macauDrawn" :initial-hk="hkDrawn"
      @close="showLotteryInput = false" @confirm="onLotteryConfirm" />

    <!-- ========== 吃码上报弹窗 ========== -->
    <CodeReportDialog :visible="showCodeReport" :macau-amounts="displayMacauAmounts"
      :hk-amounts="displayHongkongAmounts" :selected-player="selectedPlayer" @close="showCodeReport = false"
      @apply="onCodeReportApply" />

    <!-- ========== 操作记录弹窗 ========== -->
    <RecordsDialog :visible="showRecords" :records="records" @close="showRecords = false"
      @undo-selected="onUndoSelected" />


    <!-- ========== 授权管理弹窗 ========== -->
    <LicenseModal :open="showLicenseModal" :closable="licenseActive" @close="showLicenseModal = false"
      @activated="licenseActive = true; licenseBannerKey++" />
    <!-- ========== 底部任务栏：免责声明 ========== -->
    <footer class="taskbar">
      <span class="taskbar-text">本软件系娱乐软件，只能用于娱乐或技术探讨，不得用于赌博或其它非法用途，否则后果自负！</span>
    </footer>
  </div>
</template>

<style scoped>
/* ========== 外层容器 ========== */
.app-shell {
  width: 100%;
  height: 100vh;
  min-height: 800px;
  display: flex;
  flex-direction: column;
  padding: 5px 5px 0px 5px;
  gap: 3px;
  overflow: hidden;
}

/* ========== 整体容器 ========== */
.layout-container {
  display: grid;
  grid-template-columns: minmax(110px, 0.18fr) minmax(360px, 0.60fr) 1fr 1fr;
  grid-template-rows: minmax(0, 1fr) minmax(60px, 0.6fr) minmax(40px, 0.12fr);
  gap: 8px;
  width: 100%;
  flex: 1;
  min-height: 0;
}

/* ========== 通用面板样式 ========== */
.col-1,
.col-2-top,
.col-2-mid,
.col-2-bottom,
.col-2-footer,
.col-3,
.col-4 {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

/* ========== 第一竖列：侧边导航 ========== */
.col-1 {
  grid-row: 1;
  background: rgba(255, 255, 255, 0.90);
}

/* ========== 第二竖列 ========== */
.col-2 {
  grid-row: 1;
}

/* ========== 辅助面板 ========== */
.col-2-bottom {
  grid-column: 1 / 3;
  grid-row: 2;
  background: rgba(255, 255, 255, 0.82);
  overflow: hidden;
}

/* ========== 状态栏按钮 ========== */
.col-2-footer {
  grid-column: 1 / 3;
  grid-row: 3;
  background: rgba(255, 255, 255, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.9cqw, 8px);
  padding: 0 clamp(6px, 1.5cqw, 10px);
  overflow: hidden;
  container-type: inline-size;
}

.status-btn {
  display: flex;
  align-items: center;
  padding: clamp(6px, 1.3cqw, 10px) clamp(12px, 3.2cqw, 20px);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-primary);
  font-size: clamp(11px, 2.4cqw, 16px);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform var(--ease-out), box-shadow var(--ease-out), background-color var(--ease-out);
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-xs);
}

.status-btn:active {
  transform: translateY(0);
}

.status-btn.danger {
  background: #fef2f2;
  border-color: rgba(185, 28, 28, 0.20);
  color: var(--accent-red);
}

.status-btn.danger:hover {
  background: #fee2e2;
  border-color: rgba(185, 28, 28, 0.35);
}

/* ========== 第三/四竖列 ========== */
.col-3,
.col-4 {
  grid-row: 1 / 4;
}

.col-span {
  grid-column: 3 / 5;
}

/* ========== 各竖列通用 ========== */
.col {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ========== 第二竖列：多层堆叠 ========== */
.col-2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: transparent;
}

.col-2-top {
  flex: 3;
  overflow: hidden;
}

.col-2-mid {
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.84);
}

/* ========== 工具栏 ========== */
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-height: 0;
}

/* ── 港/澳 切换开关 ── */
.region-switch {
  display: flex;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-normal);
  flex-shrink: 0;
}

.switch-btn {
  padding: 2px 8px;
  border: none;
  background: #fff;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ease-out);
}

.switch-btn:hover {
  background: var(--surface-hover);
}

.switch-btn.active {
  color: #fff;
  font-weight: 700;
}

.switch-btn:first-child.active {
  background: #059669;
}

.switch-btn:last-child.active {
  background: #dc2626;
}

.toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.3px;
}

.toolbar-input {
  flex: 1;
  min-width: 0;
  padding: 10px 10px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color var(--ease-out), box-shadow var(--ease-out);
}

.toolbar-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
}

.toolbar-input::placeholder {
  color: var(--text-muted);
}

.toolbar-input.full {
  flex: 1;
}

.col-toggle {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.col-toggle input {
  cursor: pointer;
}

.toolbar-icon {
  margin-right: 3px;
  font-size: 13px;
  opacity: 0.8;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform var(--ease-out), box-shadow var(--ease-out), background-color var(--ease-out);
}

.toolbar-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.toolbar-btn:active {
  transform: translateY(0);
}

.toolbar-btn.primary {
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-blue-dark) 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.20);
}

.toolbar-btn.primary:hover {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.30);
}

/* ========== 第三竖列：主列表 ========== */
.col-3 {
  background: rgba(255, 255, 255, 0.92);
}

/* ========== 第四竖列：侧列表 ========== */
.col-4 {
  background: rgba(255, 255, 255, 0.88);
}

/* ========== 占位文字 ========== */
.placeholder-text {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  user-select: none;
  pointer-events: none;
  letter-spacing: 0.5px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ========== 辅助面板：录入记录 ========== */
.record-list {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.record-item {
  font-size: 11px;
  color: var(--text-primary);
  font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  white-space: normal;
  word-break: break-all;
  padding: 2px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.rec-time {
  color: var(--text-secondary);
}

.rec-stake {
  color: #dc2626;
  font-weight: 700;
}

.rec-reduce {
  color: #b45309;
  font-weight: 700;
  flex-shrink: 0;
}

.rec-report {
  color: #dc2626;
  font-weight: 700;
  flex-shrink: 0;
}

.rec-region {
  font-weight: 600;
}

.rec-macau {
  color: #059669;
}

.rec-hk {
  color: #dc2626;
}

.rec-player {
  color: var(--accent-blue);
  font-weight: 600;
}

.rec-type-特码 {
  color: #d97706;
  font-weight: 600;
}

.rec-type-二连肖,
.rec-type-三连肖,
.rec-type-四连肖,
.rec-type-五连肖 {
  color: #7c3aed;
  font-weight: 600;
}

.rec-type-平特 {
  color: #059669;
  font-weight: 600;
}

.rec-type-平码 {
  color: #0284c7;
  font-weight: 600;
}

.record-undo {
  color: #9ca3af;
}

/* ========== 底部任务栏 ========== */
.taskbar {
  width: 100%;
  height: 20px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  flex-shrink: 0;
  user-select: none;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-xs);
}

.taskbar-text {
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.2px;
}
</style>
