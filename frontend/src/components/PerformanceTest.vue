<script setup lang="ts">
/**
 * 性能测试组件
 * 用于测试大数据量下各组件的渲染性能和内存使用
 *
 * 测试场景：
 * 1. 大量录入记录 (records)
 * 2. 大量玩家 + 密集投注数据
 * 3. 连肖组合爆炸
 * 4. localStorage 持久化压力
 * 5. 连续快速输入
 */
import { ref, nextTick, onMounted } from 'vue'

// ========== 测试结果 ==========
interface TestResult {
  name: string
  dataSize: string
  renderTime: string
  frameDrops: number
  memoryDelta: string
  fps: string
  verdict: 'pass' | 'warn' | 'fail'
}

const results = ref<TestResult[]>([])
const running = ref(false)
const currentTest = ref('')

// ========== 性能测量工具 ==========
function measureMemory(): number {
  if ('memory' in performance) {
    return (performance as any).memory.usedJSHeapSize / 1024 / 1024
  }
  return 0
}

async function measureFrameRate(durationMs: number): Promise<{ fps: number; drops: number }> {
  return new Promise((resolve) => {
    let frames = 0
    let drops = 0
    let lastTime = performance.now()
    let animId: number

    function tick(now: number) {
      const delta = now - lastTime
      if (delta > 33.33) drops++ // 低于 30fps 算掉帧
      frames++
      lastTime = now
      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)

    setTimeout(() => {
      cancelAnimationFrame(animId)
      const elapsed = durationMs / 1000
      resolve({ fps: Math.round(frames / elapsed), drops })
    }, durationMs)
  })
}

function addResult(name: string, dataSize: string, renderTime: number, frameDrops: number, fps: number, memoryBefore: number, memoryAfter: number) {
  const delta = memoryAfter > 0 ? (memoryAfter - memoryBefore).toFixed(1) + 'MB' : 'N/A'
  let verdict: TestResult['verdict'] = 'pass'
  if (renderTime > 500 || frameDrops > 10) verdict = 'fail'
  else if (renderTime > 100 || frameDrops > 3) verdict = 'warn'

  results.value.push({
    name,
    dataSize,
    renderTime: renderTime.toFixed(1) + 'ms',
    frameDrops,
    memoryDelta: delta,
    fps: fps.toString(),
    verdict,
  })
}

// ========== 数据生成器 ==========
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const

function generateRecords(count: number): any[] {
  const records: any[] = []
  const regions = ['澳', '港']
  const betTypes = ['特码', '二连肖', '三连肖', '四连肖', '五连肖', '平特', '平码']
  const playerNames = Array.from({ length: 20 }, (_, i) => `玩家${i + 1}`)

  for (let i = 0; i < count; i++) {
    const h = String(Math.floor(Math.random() * 24)).padStart(2, '0')
    const m = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    const s = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    const nums = Array.from({ length: 3 }, () => Math.floor(Math.random() * 49) + 1).join(' ')
    const deltas: Record<number, number> = {}
    nums.split(' ').forEach(n => { deltas[Number(n)] = Math.floor(Math.random() * 100) + 10 })

    records.push({
      time: `07-09 ${h}:${m}:${s}`,
      totalStake: Math.floor(Math.random() * 500),
      region: regions[Math.floor(Math.random() * 2)],
      betType: betTypes[Math.floor(Math.random() * betTypes.length)],
      playerName: playerNames[Math.floor(Math.random() * playerNames.length)],
      numbers: nums,
      stake: Math.floor(Math.random() * 50) + 5,
      deltas,
      undo: i < count * 0.05, // 5% 是撤销记录
    })
  }
  return records
}

function generateAmounts(playerCount: number, betsPerPlayer: number): Record<string, any> {
  const amounts: Record<string, any> = {}
  for (let p = 0; p < playerCount; p++) {
    const playerKey = `玩家${p + 1}`
    const betTypes: Record<string, Record<number, number>> = {}

    // 特码
    const specialNumber: Record<number, number> = {}
    for (let i = 0; i < betsPerPlayer; i++) {
      specialNumber[Math.floor(Math.random() * 49) + 1] = Math.floor(Math.random() * 500) + 10
    }
    betTypes['specialNumber'] = specialNumber

    // 平特
    const flatSpecial: Record<number, number> = {}
    for (let i = 0; i < Math.min(betsPerPlayer, 22); i++) {
      flatSpecial[i + 1] = Math.floor(Math.random() * 200) + 10
    }
    betTypes['flatSpecial'] = flatSpecial

    // 平码
    const flatNumber: Record<number, number> = {}
    for (let i = 0; i < betsPerPlayer; i++) {
      flatNumber[Math.floor(Math.random() * 49) + 1] = Math.floor(Math.random() * 300) + 10
    }
    betTypes['flatNumber'] = flatNumber

    amounts[playerKey] = betTypes
  }
  return amounts
}

function generateLianXiaoAmounts(comboCount: number): Record<string, any> {
  // 生成大量连肖组合
  const amounts: Record<string, any> = {}
  const playerKey = '玩家1'
  const betTypes: Record<string, Record<number, number>> = {}

  // 生成生肖组合位图
  const lianXiao2: Record<number, number> = {}
  for (let i = 0; i < comboCount; i++) {
    // 随机选2个生肖
    const a = Math.floor(Math.random() * 12)
    let b = Math.floor(Math.random() * 12)
    while (b === a) b = Math.floor(Math.random() * 12)
    const bits = (1 << a) | (1 << b)
    lianXiao2[bits] = Math.floor(Math.random() * 100) + 5
  }

  const lianXiao3: Record<number, number> = {}
  for (let i = 0; i < Math.min(comboCount, 220); i++) {
    const idxs = new Set<number>()
    while (idxs.size < 3) idxs.add(Math.floor(Math.random() * 12))
    let bits = 0
    for (const idx of idxs) bits |= (1 << idx)
    lianXiao3[bits] = Math.floor(Math.random() * 100) + 5
  }

  betTypes['lianXiao2'] = lianXiao2
  betTypes['lianXiao3'] = lianXiao3
  amounts[playerKey] = betTypes
  return amounts
}

// ========== 测试执行 ==========
async function runAllTests() {
  running.value = true
  results.value = []

  // ===== 测试 1: 大量 records =====
  for (const count of [100, 500, 1000, 5000]) {
    currentTest.value = `records × ${count}`
    await nextTick()

    const memBefore = measureMemory()
    const records = generateRecords(count)

    const start = performance.now()
    await nextTick()
    // 模拟 LayoutView 中 records v-for 渲染
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:700px;height:500px;overflow:auto'
    document.body.appendChild(container)

    // 用 innerHTML 模拟 Vue 渲染（不用 Vue 以避免干扰）
    const htmlParts: string[] = []
    for (const r of records) {
      if (r.undo) {
        htmlParts.push(`<div style="padding:3px;font-size:11px;color:#9ca3af;border-bottom:1px solid #eee;white-space:nowrap">[${r.time}]撤销[${r.totalStake}][${r.region === '澳' ? '澳门' : '香港'}][${r.betType}]${r.playerName} ${r.numbers}</div>`)
      } else {
        htmlParts.push(`<div style="padding:3px;font-size:11px;border-bottom:1px solid #eee;white-space:nowrap">[${r.time}][${r.totalStake}][${r.region === '澳' ? '澳门' : '香港'}][${r.betType}]${r.playerName} ${r.numbers} 各${r.stake}</div>`)
      }
    }
    container.innerHTML = htmlParts.join('')

    const renderTime = performance.now() - start

    // 测量滚动性能
    const frameMeasure = await measureFrameRate(2000)
    // 滚动容器
    let scrollDrops = 0
    if (count > 100) {
      const scrollStart = performance.now()
      const scrollStep = container.scrollHeight / 50
      for (let i = 0; i < 50; i++) {
        container.scrollTop = i * scrollStep
        await new Promise(r => requestAnimationFrame(r))
      }
      const scrollTime = performance.now() - scrollStart
      scrollDrops = Math.floor(scrollTime / 33.33) - 50 // 超出 50 帧的部分
    }

    const memAfter = measureMemory()
    addResult(`records 渲染`, `${count} 条`, renderTime, frameMeasure.drops + scrollDrops, frameMeasure.fps, memBefore, memAfter)

    document.body.removeChild(container)
    await nextTick()
  }

  // ===== 测试 2: 大量玩家 + 密集投注 =====
  for (const cfg of [{ players: 10, bets: 49 }, { players: 50, bets: 49 }, { players: 100, bets: 30 }, { players: 200, bets: 20 }]) {
    currentTest.value = `${cfg.players} 玩家 × ~${cfg.bets} 注`
    await nextTick()

    const memBefore = measureMemory()
    const amounts = generateAmounts(cfg.players, cfg.bets)

    const start = performance.now()
    // 模拟 mergePlayerAmounts
    const merged: Record<string, Record<number, number>> = {}
    const playerKeys = Object.keys(amounts)
    for (const p of playerKeys) {
      const betTypes = amounts[p]
      if (!betTypes) continue
      for (const [btKey, nums] of Object.entries(betTypes)) {
        if (!merged[btKey]) merged[btKey] = {}
        for (const [num, amt] of Object.entries(nums as Record<number, number>)) {
          merged[btKey][Number(num)] = (merged[btKey][Number(num)] ?? 0) + amt
        }
      }
    }
    const mergeTime = performance.now() - start

    // 模拟 BetList computed rows 生成
    const rowStart = performance.now()
    let totalRows = 0
    for (const nums of Object.values(merged)) {
      totalRows += Object.keys(nums).length
    }
    const rowTime = performance.now() - rowStart

    const frameMeasure = await measureFrameRate(2000)
    const memAfter = measureMemory()
    addResult(`玩家投注合并`, `${cfg.players}玩家/${totalRows}项`, mergeTime + rowTime, frameMeasure.drops, frameMeasure.fps, memBefore, memAfter)
  }

  // ===== 测试 3: 连肖组合爆炸 =====
  for (const comboCount of [50, 200, 500]) {
    currentTest.value = `连肖 × ${comboCount} 组合`
    await nextTick()

    const memBefore = measureMemory()
    const amounts = generateLianXiaoAmounts(comboCount)

    const start = performance.now()
    // 模拟 lianXiaoRows computed
    const activeAmounts = { ...amounts['玩家1']?.['lianXiao2'] ?? {}, ...amounts['玩家1']?.['lianXiao3'] ?? {} }
    const rows: any[] = []
    for (const [key, amount] of Object.entries(activeAmounts)) {
      const bits = Number(key)
      if (bits === 0 || amount === 0) continue
      let project = ''
      for (let i = 0; i < ZODIAC.length; i++) {
        if (bits & (1 << i)) project += ZODIAC[i]
      }
      rows.push({ id: bits, project, amount, risk: Math.round(1000 - (amount as number) * 8.5) })
    }
    const renderTime = performance.now() - start

    const frameMeasure = await measureFrameRate(2000)
    const memAfter = measureMemory()
    addResult(`连肖组合`, `${rows.length} 行`, renderTime, frameMeasure.drops, frameMeasure.fps, memBefore, memAfter)
  }

  // ===== 测试 4: localStorage 持久化压力 =====
  currentTest.value = 'localStorage 序列化'
  await nextTick()

  const largeAmounts = generateAmounts(50, 49)
  const memBefore = measureMemory()

  const start = performance.now()
  for (let i = 0; i < 10; i++) {
    const json = JSON.stringify(largeAmounts)
    localStorage.setItem('__perf_test__', json)
    JSON.parse(localStorage.getItem('__perf_test__') || '{}')
  }
  const totalTime = performance.now() - start
  localStorage.removeItem('__perf_test__')

  const memAfter = measureMemory()
  addResult(`localStorage 序列化`, `${JSON.stringify(largeAmounts).length.toLocaleString()} 字节`, totalTime / 10, 0, 0, memBefore, memAfter)

  // ===== 测试 5: 连续快速输入模拟 =====
  currentTest.value = '连续输入模拟'
  await nextTick()

  // 模拟 100 次连续 onRecordBets 调用
  const records2 = generateRecords(100)
  const inputStart = performance.now()
  for (let i = 0; i < 100; i++) {
    // 模拟 onRecordBets 中的解析 + applyBetDeltas 逻辑
    const r = records2[i]
    // 浅拷贝 + unshift
    void { ...r }
  }
  const inputTime = performance.now() - inputStart

  const frameMeasure = await measureFrameRate(2000)
  addResult(`快速输入`, `100 次连续`, inputTime, frameMeasure.drops, frameMeasure.fps, 0, 0)

  running.value = false
  currentTest.value = ''
}

// ========== 单项深度测试 ==========
async function runDeepRecordTest() {
  running.value = true
  currentTest.value = '深度: records DOM 节点数'

  for (const count of [1000, 3000, 5000, 10000]) {
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:700px;height:500px;overflow:auto'
    document.body.appendChild(container)

    const records = generateRecords(count)
    const start = performance.now()
    const htmlParts: string[] = []
    for (const r of records) {
      htmlParts.push(`<div style="padding:3px;font-size:11px;border-bottom:1px solid #eee">[${r.time}][${r.totalStake}]${r.playerName} ${r.numbers}</div>`)
    }
    container.innerHTML = htmlParts.join('')

    // 测量 layout/reflow
    const _reflowStart = performance.now()
    container.offsetHeight // 强制 reflow
    void (performance.now() - _reflowStart)

    const renderTime = performance.now() - start
    const frameMeasure = await measureFrameRate(1500)

    addResult(
      `DOM 渲染 (含 reflow)`,
      `${count} 节点`,
      renderTime,
      frameMeasure.drops,
      frameMeasure.fps,
      0, 0
    )

    document.body.removeChild(container)
    await nextTick()
  }

  running.value = false
  currentTest.value = ''
}

onMounted(() => {
  // 自动开始
})
</script>

<template>
  <div class="perf-test">
    <div class="perf-header">
      <h2>⚡ 性能测试面板</h2>
      <div class="perf-controls">
        <button
          class="perf-btn primary"
          :disabled="running"
          @click="runAllTests"
        >
          {{ running ? '⏳ 测试中...' : '▶ 运行全部测试' }}
        </button>
        <button
          class="perf-btn"
          :disabled="running"
          @click="runDeepRecordTest"
        >
          🔬 深度 DOM 测试
        </button>
      </div>
      <div v-if="currentTest" class="current-test">{{ currentTest }}</div>
    </div>

    <!-- 结果表格 -->
    <div class="results-table-wrapper">
      <table class="results-table">
        <thead>
          <tr>
            <th>测试场景</th>
            <th>数据规模</th>
            <th>渲染 / 计算耗时</th>
            <th>帧率 (FPS)</th>
            <th>掉帧数 (/2s)</th>
            <th>内存增量</th>
            <th>判定</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="results.length === 0">
            <td colspan="7" class="empty-cell">点击上方按钮开始测试</td>
          </tr>
          <tr
            v-for="(r, i) in results"
            :key="i"
            :class="['result-row', `verdict-${r.verdict}`]"
          >
            <td class="cell-name">{{ r.name }}</td>
            <td class="cell-size">{{ r.dataSize }}</td>
            <td class="cell-time" :style="{ color: parseFloat(r.renderTime) > 500 ? '#dc2626' : parseFloat(r.renderTime) > 100 ? '#d97706' : '#16a34a' }">
              {{ r.renderTime }}
            </td>
            <td class="cell-fps" :style="{ color: Number(r.fps) < 30 ? '#dc2626' : Number(r.fps) < 55 ? '#d97706' : '#16a34a' }">
              {{ r.fps }}
            </td>
            <td class="cell-drops" :style="{ color: r.frameDrops > 10 ? '#dc2626' : r.frameDrops > 3 ? '#d97706' : '#16a34a' }">
              {{ r.frameDrops }}
            </td>
            <td class="cell-mem">{{ r.memoryDelta }}</td>
            <td>
              <span :class="['verdict-badge', `badge-${r.verdict}`]">
                {{ r.verdict === 'pass' ? '✅ 通过' : r.verdict === 'warn' ? '⚠️ 警告' : '❌ 卡顿' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分析建议 -->
    <div v-if="results.length > 0" class="analysis">
      <h3>📊 分析总结</h3>
      <ul>
        <li v-if="results.some(r => r.verdict === 'fail')">
          ❌ <strong>检测到严重卡顿</strong>：部分场景渲染时间超过 500ms 或掉帧严重，
          大数据量下用户体验会明显受影响。
        </li>
        <li v-if="results.some(r => r.name.includes('records') && r.verdict === 'warn')">
          ⚠️ <strong>Records 列表</strong>：记录数超过 500 条时建议引入虚拟滚动 (vue-virtual-scroller)。
        </li>
        <li v-if="results.some(r => r.name.includes('连肖') && parseFloat(r.renderTime) > 50)">
          ⚠️ <strong>连肖组合</strong>：组合数较多时计算耗时增加，建议对 lianXiaoRows 做缓存或分页。
        </li>
        <li v-if="results.some(r => r.name.includes('localStorage'))">
          💡 <strong>localStorage</strong>：大数据量下同步序列化会阻塞主线程，建议使用 Web Worker 或 debounce。
        </li>
      </ul>

      <h3>🔧 优化建议优先级</h3>
      <ol>
        <li><strong>虚拟滚动</strong>：records 列表和 BetList 引入虚拟滚动，只渲染可视区域内的 DOM 节点</li>
        <li><strong>localStorage debounce</strong>：deep watcher 加 500ms~1s 防抖，避免每次变更都序列化</li>
        <li><strong>shallowRef</strong>：大对象使用 shallowRef + 手动 triggerRef，避免深度响应式追踪开销</li>
        <li><strong>连肖分页</strong>：当 lianXiaoRows 超过 200 行时分页显示</li>
        <li><strong>requestAnimationFrame 批量更新</strong>：连续快速输入时合并多次渲染</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.perf-test {
  padding: 20px;
  max-width: 1100px;
  margin: 0 auto;
  font-family: "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  color: #1e293b;
}

.perf-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.perf-header h2 {
  margin: 0;
  font-size: 18px;
  white-space: nowrap;
}

.perf-controls {
  display: flex;
  gap: 10px;
}

.perf-btn {
  padding: 8px 18px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.perf-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
}

.perf-btn.primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.perf-btn.primary:hover:not(:disabled) {
  background: #2563eb;
}

.perf-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.current-test {
  font-size: 12px;
  color: #64748b;
  padding: 4px 12px;
  background: #f1f5f9;
  border-radius: 4px;
}

.results-table-wrapper {
  overflow-x: auto;
  margin-bottom: 20px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.results-table th {
  background: #f8fafc;
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.results-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.empty-cell {
  text-align: center;
  color: #94a3b8;
  padding: 30px !important;
}

.result-row:hover {
  background: #f8fafc;
}

.verdict-pass { }
.verdict-warn { background: #fffbeb; }
.verdict-fail { background: #fef2f2; }

.verdict-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.badge-pass { background: #dcfce7; color: #16a34a; }
.badge-warn { background: #fef3c7; color: #d97706; }
.badge-fail { background: #fee2e2; color: #dc2626; }

.cell-name { font-weight: 600; }
.cell-size { color: #64748b; font-variant-numeric: tabular-nums; }
.cell-time, .cell-fps, .cell-drops, .cell-mem {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.analysis {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px 24px;
  font-size: 13px;
  line-height: 1.8;
}

.analysis h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.analysis ul, .analysis ol {
  margin: 0 0 16px;
  padding-left: 20px;
}

.analysis li {
  margin-bottom: 6px;
}
</style>
