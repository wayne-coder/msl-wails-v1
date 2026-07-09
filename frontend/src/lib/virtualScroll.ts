/**
 * 轻量级虚拟滚动 composable
 * 只渲染可视区域内的 DOM 节点，大幅减少大数据列表的渲染开销
 *
 * 用法:
 *   const { containerRef, wrapperStyle, visibleItems, onScroll } = useVirtualScroll({
 *     items: myArray,
 *     itemHeight: 24,
 *   })
 *   // 模板中 v-for="item in visibleItems"
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface VirtualScrollOptions<T> {
  /** 数据源 (响应式) */
  items: Ref<T[]> | T[]
  /** 单项预估高度 (px)，作为初始值；后续用实测值校准 */
  itemHeight?: number
  /** 可视区域外预渲染行数 (上下各这么多行) */
  overscan?: number
}

export interface VirtualScrollReturn<T> {
  /** 挂到滚动容器的 ref */
  containerRef: Ref<HTMLElement | null>
  /** 内部撑高容器 style */
  wrapperStyle: Ref<Record<string, string>>
  /** 当前可见的 items 切片 */
  visibleItems: Ref<T[]>
  /** 可见切片在原数组中的起始下标 */
  visibleStart: Ref<number>
  /** 可见切片顶部的 Y 偏移 */
  offsetY: Ref<number>
  /** scroll 事件处理 */
  onScroll: () => void
  /** 强制重新测量高度 */
  recalc: () => void
  /** 滚动到底部 */
  scrollToBottom: () => void
}

export function useVirtualScroll<T>(options: VirtualScrollOptions<T>): VirtualScrollReturn<T> {
  const { overscan = 5 } = options
  const itemHeight = options.itemHeight ?? 24

  const containerRef = ref<HTMLElement | null>(null)
  const containerHeight = ref(400)   // 初始化时猜测
  const scrollTop = ref(0)
  const measuredHeights = ref<Map<number, number>>(new Map())

  const totalCount = computed(() =>
    Array.isArray(options.items) ? options.items.length : options.items.value.length
  )

  // 计算每行的累计偏移
  function getOffset(index: number): number {
    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += measuredHeights.value.get(i) ?? itemHeight
    }
    return offset
  }

  // 二分查找 scrollTop 对应的起始行
  function findStartIndex(st: number): number {
    let offset = 0
    const tc = totalCount.value
    for (let i = 0; i < tc; i++) {
      const h = measuredHeights.value.get(i) ?? itemHeight
      if (offset + h > st) return i
      offset += h
    }
    return Math.max(0, tc - 1)
  }

  const totalHeight = computed(() => {
    let h = 0
    const tc = totalCount.value
    for (let i = 0; i < tc; i++) {
      h += measuredHeights.value.get(i) ?? itemHeight
    }
    return Math.max(h, 0)
  })

  const visibleStart = ref(0)
  const visibleEnd = ref(0)

  const visibleItems = computed<T[]>(() => {
    const source = Array.isArray(options.items) ? options.items : options.items.value
    if (source.length === 0) return []
    const start = visibleStart.value
    const end = Math.min(visibleEnd.value, source.length)
    return source.slice(start, end)
  })

  const wrapperStyle = computed<Record<string, string>>(() => ({
    height: `${totalHeight.value}px`,
    position: 'relative',
    width: '100%',
  }))

  // 计算 offsetY：visibleStart 之前所有项的高度和
  const offsetY = computed(() => getOffset(visibleStart.value))

  function updateRange() {
    if (!containerRef.value) return
    const start = findStartIndex(scrollTop.value)
    const visibleCount = Math.ceil(containerHeight.value / itemHeight) + 1
    visibleStart.value = Math.max(0, start - overscan)
    visibleEnd.value = Math.min(totalCount.value, start + visibleCount + overscan)
  }

  function onScroll() {
    if (!containerRef.value) return
    scrollTop.value = containerRef.value.scrollTop
    containerHeight.value = containerRef.value.clientHeight
    updateRange()
  }

  // 测量已渲染行的实际高度
  function measureRendered() {
    if (!containerRef.value) return
    const innerWrapper = containerRef.value.firstElementChild as HTMLElement | null
    if (!innerWrapper) return
    const rowsWrapper = innerWrapper.firstElementChild as HTMLElement | null
    if (!rowsWrapper) return
    const children = rowsWrapper.children
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement
      const actualIndex = visibleStart.value + i
      const h = el.getBoundingClientRect().height
      if (h > 0 && h !== (measuredHeights.value.get(actualIndex) ?? 0)) {
        measuredHeights.value.set(actualIndex, h)
      }
    }
  }

  // 初始化时用 ResizeObserver 监听容器高度
  let resizeObs: ResizeObserver | null = null

  onMounted(() => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight
      updateRange()
      resizeObs = new ResizeObserver(() => {
        if (containerRef.value) {
          containerHeight.value = containerRef.value.clientHeight
          updateRange()
        }
      })
      resizeObs.observe(containerRef.value)
    }
  })

  onUnmounted(() => {
    resizeObs?.disconnect()
  })

  // 当数据源长度变化时重算 (flush: 'post' 确保 DOM 已更新，v-if/v-else 分支已渲染)
  watch(totalCount, () => {
    nextTick(() => updateRange())
  }, { flush: 'post' })

  // 渲染后测量高度
  watch(visibleStart, () => {
    requestAnimationFrame(() => measureRendered())
  })

  const recalc = () => {
    measuredHeights.value.clear()
    updateRange()
  }

  const scrollToBottom = () => {
    if (!containerRef.value) return
    containerRef.value.scrollTop = totalHeight.value
    onScroll()
  }

  return {
    containerRef,
    wrapperStyle,
    visibleItems,
    visibleStart,
    onScroll,
    recalc,
    scrollToBottom,
    // 暴露 offsetY 给模板
    offsetY,
  }
}
