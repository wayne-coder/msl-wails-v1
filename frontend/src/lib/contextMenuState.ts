import { reactive } from 'vue'

/** 全局右键菜单状态 — 在任意元素上 @contextmenu="ctxMenu.show" 即可使用 */
export const ctxMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  _target: null as HTMLElement | null,

  show(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement
    e.preventDefault()
    this._target = el
    this.x = e.clientX
    this.y = e.clientY
    this.visible = true
  },

  hide() {
    this.visible = false
    this._target = null
  },

  /** 目标是否为可编辑元素（input/textarea） */
  get canEdit(): boolean {
    const el = this._target
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
  },

  /** 获取目标元素的完整文本内容 */
  _fullText(): string {
    const el = this._target
    if (!el) return ''
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value
    }
    return el.textContent ?? ''
  },

  /** 获取当前选中的文本 */
  _selectedText(): string {
    const el = this._target
    if (!el) return ''
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      return start !== end ? el.value.substring(start, end) : el.value
    }
    // 普通元素：取 window.getSelection() 选中的文本
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      return sel.toString()
    }
    return el.textContent ?? ''
  },

  copy() {
    const text = this._selectedText()
    if (!text) { this.hide(); return }
    navigator.clipboard.writeText(text).catch(() => {
      const el = this._target
      if (!el) return
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus()
        el.select()
        document.execCommand('copy')
      }
    })
    this.hide()
  },

  async paste() {
    const el = this._target
    if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
    try {
      const text = await navigator.clipboard.readText()
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      const val = el.value
      el.value = val.slice(0, start) + text + val.slice(end)
      el.selectionStart = el.selectionEnd = start + text.length
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      el.focus()
      document.execCommand('paste')
    }
    this.hide()
  },

  cut() {
    const el = this._target
    if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const text = start !== end ? el.value.substring(start, end) : el.value

    navigator.clipboard.writeText(text).then(() => {
      if (start !== end) {
        el.value = el.value.slice(0, start) + el.value.slice(end)
        el.selectionStart = el.selectionEnd = start
      } else {
        el.value = ''
      }
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }).catch(() => {
      el.focus()
      el.select()
      document.execCommand('cut')
    })
    this.hide()
  },

  selectAll() {
    const el = this._target
    if (!el) return
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus()
      el.select()
    } else {
      // 普通元素：用 Selection API 全选
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    this.hide()
  },
})
