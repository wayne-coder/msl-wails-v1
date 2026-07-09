/**
 * 码上录 性能基准测试 (Node.js)
 *
 * 测试核心数据处理算法的性能瓶颈：
 * 1. Records 列表渲染（DOM 节点生成）
 * 2. 多玩家投注合并 (mergePlayerAmounts)
 * 3. 连肖组合爆炸 (lianXiaoRows generation)
 * 4. localStorage 大数据序列化
 * 5. Deep watch / JSON.stringify 开销
 * 6. 连续快速输入模拟
 */
import { performance } from 'node:perf_hooks'
import { randomInt } from 'node:crypto'

// ========== 常量 ==========
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

// ========== 数据生成 ==========
function generateRecords(count) {
  const regions = ['澳', '港']
  const betTypes = ['特码', '二连肖', '三连肖', '四连肖', '五连肖', '平特', '平码']
  const playerNames = Array.from({ length: 20 }, (_, i) => `玩家${i + 1}`)
  const records = []
  for (let i = 0; i < count; i++) {
    const h = String(Math.floor(Math.random() * 24)).padStart(2, '0')
    const m = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    const s = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    const nums = Array.from({ length: 3 }, () => Math.floor(Math.random() * 49) + 1)
    const deltas = {}
    nums.forEach(n => { deltas[n] = Math.floor(Math.random() * 100) + 10 })
    records.push({
      time: `07-09 ${h}:${m}:${s}`,
      totalStake: Math.floor(Math.random() * 500),
      region: regions[Math.floor(Math.random() * 2)],
      betType: betTypes[Math.floor(Math.random() * betTypes.length)],
      playerName: playerNames[Math.floor(Math.random() * playerNames.length)],
      numbers: nums.join(' '),
      stake: Math.floor(Math.random() * 50) + 5,
      deltas,
      undo: i < count * 0.05,
    })
  }
  return records
}

function generateAmounts(playerCount, betsPerPlayer) {
  const amounts = {}
  for (let p = 0; p < playerCount; p++) {
    const playerKey = `玩家${p + 1}`
    const betTypes = {}
    // 特码
    const specialNumber = {}
    for (let i = 0; i < betsPerPlayer; i++) {
      specialNumber[Math.floor(Math.random() * 49) + 1] = Math.floor(Math.random() * 500) + 10
    }
    betTypes['specialNumber'] = specialNumber
    // 平特
    const flatSpecial = {}
    for (let i = 0; i < Math.min(betsPerPlayer, 22); i++) {
      flatSpecial[i + 1] = Math.floor(Math.random() * 200) + 10
    }
    betTypes['flatSpecial'] = flatSpecial
    // 平码
    const flatNumber = {}
    for (let i = 0; i < betsPerPlayer; i++) {
      flatNumber[Math.floor(Math.random() * 49) + 1] = Math.floor(Math.random() * 300) + 10
    }
    betTypes['flatNumber'] = flatNumber
    amounts[playerKey] = betTypes
  }
  return amounts
}

function generateLianXiaoAmounts(comboCount) {
  const amounts = {}
  const betTypes = {}
  const lianXiao2 = {}
  for (let i = 0; i < comboCount; i++) {
    const a = Math.floor(Math.random() * 12)
    let b = Math.floor(Math.random() * 12)
    while (b === a) b = Math.floor(Math.random() * 12)
    const bits = (1 << a) | (1 << b)
    lianXiao2[bits] = Math.floor(Math.random() * 100) + 5
  }
  const lianXiao3 = {}
  for (let i = 0; i < Math.min(comboCount, 220); i++) {
    const idxs = new Set()
    while (idxs.size < 3) idxs.add(Math.floor(Math.random() * 12))
    let bits = 0
    for (const idx of idxs) bits |= (1 << idx)
    lianXiao3[bits] = Math.floor(Math.random() * 100) + 5
  }
  betTypes['lianXiao2'] = lianXiao2
  betTypes['lianXiao3'] = lianXiao3
  amounts['玩家1'] = betTypes
  return amounts
}

// ========== 测量工具 ==========
function measure(label, fn, iterations = 1) {
  // 预热
  fn()
  const times = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  return { label, avg, min, max, iterations }
}

// ========== 测试用例 ==========

// 1. mergePlayerAmounts -- 模拟 LayoutView mergePlayerAmounts
function testMergePlayerAmounts(amounts, selectedPlayer = null) {
  const players = selectedPlayer ? [selectedPlayer] : Object.keys(amounts)
  const merged = {}
  for (const p of players) {
    const betTypes = amounts[p]
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

// 2. records v-for HTML 生成
function testRecordsToString(records) {
  const parts = []
  for (const r of records) {
    if (r.undo) {
      parts.push(`[${r.time}]撤销[${r.totalStake}][${r.region === '澳' ? '澳门' : '香港'}][${r.betType}]${r.playerName} ${r.numbers}`)
    } else if (r.stake < 0) {
      parts.push(`[${r.time}]<减额>[${r.totalStake}][${r.region === '澳' ? '澳门' : '香港'}][${r.betType}]${r.playerName} ${r.numbers} ${r.stake}`)
    } else {
      parts.push(`[${r.time}][${r.totalStake}][${r.region === '澳' ? '澳门' : '香港'}][${r.betType}]${r.playerName} ${r.numbers} 各${r.stake}`)
    }
  }
  return parts.join('\n')
}

// 3. lianXiaoRows 生成 (BetList.vue lianXiaoRows computed)
function testLianXiaoRows(activeAmounts, totalAmount) {
  const rows = []
  for (const [key, amount] of Object.entries(activeAmounts)) {
    const bits = Number(key)
    if (bits === 0 || amount === 0) continue
    let project = ''
    for (let i = 0; i < ZODIAC.length; i++) {
      if (bits & (1 << i)) project += ZODIAC[i]
    }
    if (!project) continue
    const odds = project.includes('马') ? 65 : 60
    const risk = totalAmount - totalAmount * 0.03 - amount * odds
    rows.push({ id: bits, project, amount, risk: Math.round(risk) })
  }
  return rows
}

// 4. JSON.stringify + parse (localStorage)
function testStringify(data) {
  const json = JSON.stringify(data)
  JSON.parse(json)
  return json.length
}

// 5. Deep clone spread (applyBetDeltas 模式)
function testApplyBetDeltas(target, playerKey, betTypeKey, deltas) {
  const playerData = { ...(target[playerKey] ?? {}) }
  const typeData = { ...(playerData[betTypeKey] ?? {}) }
  for (const [num, add] of Object.entries(deltas)) {
    const n = Number(num)
    typeData[n] = (typeData[n] ?? 0) + add
  }
  target = { ...target, [playerKey]: { ...playerData, [betTypeKey]: typeData } }
  return target
}

// ========== 主测试 ==========
console.log('═'.repeat(72))
console.log('  码上录 性能基准测试')
console.log('═'.repeat(72))
console.log()

const results = []

// ── 测试 1: mergePlayerAmounts ──
console.log('── 场景 1: 多玩家投注合并 (mergePlayerAmounts) ──')
for (const [players, bets] of [[10, 49], [50, 49], [100, 30], [200, 20]]) {
  const data = generateAmounts(players, bets)
  const m = measure(`${players}玩家 × ~${bets}注`, () => testMergePlayerAmounts(data))
  const totalKeys = Object.values(testMergePlayerAmounts(data)).reduce((s, v) => s + Object.keys(v).length, 0)
  console.log(`  ${m.label.padEnd(20)} | avg ${m.avg.toFixed(2).padStart(7)}ms | min ${m.min.toFixed(2).padStart(7)}ms | ${totalKeys} 项`)
  results.push({ ...m, detail: `${totalKeys} 项` })
}

// ── 测试 2: records HTML 生成 ──
console.log('\n── 场景 2: Records 列表 HTML 生成 ──')
for (const count of [100, 500, 1000, 5000, 10000]) {
  const records = generateRecords(count)
  const m = measure(`${count} 条`, () => testRecordsToString(records))
  const outputSize = testRecordsToString(records).length
  console.log(`  ${m.label.padEnd(20)} | avg ${m.avg.toFixed(2).padStart(7)}ms | min ${m.min.toFixed(2).padStart(7)}ms | ${(outputSize / 1024).toFixed(0)}KB 输出`)
  results.push({ ...m, detail: `${(outputSize / 1024).toFixed(0)}KB` })
}

// ── 测试 3: 连肖行生成 ──
console.log('\n── 场景 3: 连肖组合行生成 (lianXiaoRows) ──')
for (const comboCount of [50, 200, 500, 792]) {
  const data = generateLianXiaoAmounts(comboCount)
  const activeAmounts = { ...data['玩家1']?.['lianXiao2'] ?? {}, ...data['玩家1']?.['lianXiao3'] ?? {} }
  const totalAmount = Object.values(activeAmounts).reduce((s, v) => s + v, 0)
  const m = measure(`${comboCount} 组合`, () => testLianXiaoRows(activeAmounts, totalAmount))
  const rowCount = testLianXiaoRows(activeAmounts, totalAmount).length
  console.log(`  ${m.label.padEnd(20)} | avg ${m.avg.toFixed(2).padStart(7)}ms | min ${m.min.toFixed(2).padStart(7)}ms | ${rowCount} 行`)
  results.push({ ...m, detail: `${rowCount} 行` })
}

// ── 测试 4: localStorage 序列化 ──
console.log('\n── 场景 4: localStorage JSON 序列化 (模拟 deep watch) ──')
for (const [players, bets] of [[10, 49], [50, 49], [100, 30], [200, 20]]) {
  const data = generateAmounts(players, bets)
  const m = measure(`${players}玩家`, () => testStringify(data), 5)
  const jsonSize = JSON.stringify(data).length
  console.log(`  ${m.label.padEnd(20)} | avg ${m.avg.toFixed(2).padStart(7)}ms | min ${m.min.toFixed(2).padStart(7)}ms | ${(jsonSize / 1024).toFixed(0)}KB JSON`)
  results.push({ ...m, detail: `${(jsonSize / 1024).toFixed(0)}KB` })
}

// ── 测试 5: applyBetDeltas 连续调用 ──
console.log('\n── 场景 5: 连续快速下注 (applyBetDeltas × 100) ──')
const baseAmounts = generateAmounts(50, 49)
const deltasBatch = Array.from({ length: 100 }, () => {
  const deltas = {}
  for (let j = 0; j < 5; j++) {
    deltas[Math.floor(Math.random() * 49) + 1] = Math.floor(Math.random() * 100) + 10
  }
  return deltas
})
const m5 = measure(`100 次连续`, () => {
  let target = JSON.parse(JSON.stringify(baseAmounts)) // 每次独立的副本
  for (const deltas of deltasBatch) {
    target = testApplyBetDeltas(target, '玩家1', 'specialNumber', deltas)
  }
}, 3)
console.log(`  ${m5.label.padEnd(20)} | avg ${m5.avg.toFixed(2).padStart(7)}ms | min ${m5.min.toFixed(2).padStart(7)}ms`)
results.push({ ...m5, detail: '100 次' })

// ── 测试 6: 连续 unshift 到 records ──
console.log('\n── 场景 6: records.unshift 连续插入 ──')
for (const count of [100, 500, 1000, 5000]) {
  const baseRecords = generateRecords(count)
  const newEntries = Array.from({ length: 100 }, () => generateRecords(1)[0])
  const m = measure(`基数组 ${count} + 100 次`, () => {
    const arr = [...baseRecords]
    for (const entry of newEntries) {
      arr.unshift(entry)
    }
    return arr
  }, 3)
  console.log(`  ${m.label.padEnd(20)} | avg ${m.avg.toFixed(2).padStart(7)}ms | min ${m.min.toFixed(2).padStart(7)}ms | unshift 到 ${count + 100} 条`)
  results.push({ ...m, detail: `${count}→${count + 100}` })
}

// ── 测试 7: 全量排序 ──
console.log('\n── 场景 7: sortedRows 排序 ──')
const rows49 = Array.from({ length: 49 }, (_, i) => ({
  id: i + 1,
  project: `${i + 1}${ZODIAC[(i + 1) % 12]}`,
  amount: Math.floor(Math.random() * 500),
  risk: Math.floor(Math.random() * 2000 - 1000),
}))
const m7 = measure(`49 行`, () => {
  const sorted = [...rows49]
  sorted.sort((a, b) => a.risk - b.risk)
}, 100)
console.log(`  ${m7.label.padEnd(20)} | avg ${m7.avg.toFixed(4).padStart(7)}ms | min ${m7.min.toFixed(4).padStart(7)}ms`)
results.push({ ...m7, detail: '49 行' })

// 模拟 500 行排序（连肖场景）
const rows500 = Array.from({ length: 500 }, (_, i) => ({
  id: i,
  project: `组合${i}`,
  amount: Math.floor(Math.random() * 500),
  risk: Math.floor(Math.random() * 2000 - 1000),
}))
const m7b = measure(`500 行`, () => {
  const sorted = [...rows500]
  sorted.sort((a, b) => a.risk - b.risk)
}, 100)
console.log(`  ${m7b.label.padEnd(20)} | avg ${m7b.avg.toFixed(4).padStart(7)}ms | min ${m7b.min.toFixed(4).padStart(7)}ms`)
results.push({ ...m7b, detail: '500 行' })

// ========== 判定 ==========
console.log('\n' + '═'.repeat(72))
console.log('  判定汇总')
console.log('═'.repeat(72))

const THRESHOLDS = {
  render: { warn: 50, fail: 100 },    // ms: 感觉到的延迟
  compute: { warn: 16, fail: 33 },     // ms: 1帧 vs 2帧
  serialize: { warn: 30, fail: 100 },  // ms
}

let hasFail = false
let hasWarn = false

for (const r of results) {
  let verdict = '✅ PASS'
  let threshold = THRESHOLDS.compute

  if (r.label.includes('HTML') || r.label.includes('排序')) {
    threshold = THRESHOLDS.render
  } else if (r.label.includes('localStorage') || r.label.includes('JSON')) {
    threshold = THRESHOLDS.serialize
  }

  if (r.avg > threshold.fail) {
    verdict = '❌ FAIL'
    hasFail = true
  } else if (r.avg > threshold.warn) {
    verdict = '⚠️  WARN'
    hasWarn = true
  }

  console.log(`  ${verdict} | ${r.label.padEnd(30)} | ${r.avg.toFixed(2).padStart(7)}ms avg | ${r.detail || ''}`)
}

console.log('\n' + '═'.repeat(72))
console.log('  结论')
console.log('═'.repeat(72))

if (hasFail) {
  console.log('❌ 存在严重性能问题：大数据量下会有明显卡顿。建议：')
  console.log('  1. records 列表使用虚拟滚动（vue-virtual-scroller），只渲染可见区域')
  console.log('  2. localStorage deep watch 加 debounce/throttle（500ms-1s）')
  console.log('  3. 大对象使用 shallowRef + triggerRef，关闭深度响应式')
  console.log('  4. records > 500 条时用分页或"加载更多"')
} else if (hasWarn) {
  console.log('⚠️  中等数据量下基本流畅，但大数据量边界情况需关注。')
} else {
  console.log('✅ 当前算法在测试数据量下运行良好。')
}

// 打印内存估算
const used = process.memoryUsage()
console.log(`\n当前进程内存: ${(used.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(used.heapTotal / 1024 / 1024).toFixed(1)}MB`)
