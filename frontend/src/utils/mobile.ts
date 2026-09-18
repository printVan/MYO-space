const KEY = 'myo-mobile-mode'
const AUTO_KEY = 'myo-auto-mobile'

/** 当前是否处于移动端自适应视图（手动强制，持久化在 localStorage） */
export function isMobileMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** 切换移动端自适应视图，并广播事件给各页面 */
export function setMobileMode(v: boolean): void {
  try {
    if (v) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('myo-mobile-change', { detail: { mobile: v } }))
  }
}

/** 订阅移动视图变化，返回取消订阅函数 */
export function onMobileChange(fn: (mobile: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => fn(isMobileMode())
  window.addEventListener('myo-mobile-change', handler)
  return () => window.removeEventListener('myo-mobile-change', handler)
}

/** 是否允许手机宽度自动切换移动布局（默认开启；关闭后手机打开保持桌面布局） */
export function isAutoMobileEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0'
  } catch {
    return true
  }
}

export function setAutoMobileEnabled(v: boolean): void {
  try {
    if (v) localStorage.removeItem(AUTO_KEY)
    else localStorage.setItem(AUTO_KEY, '0')
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('myo-auto-mobile-change', { detail: { enabled: v } }))
  }
}

/** 订阅自动切换开关变化 */
export function onAutoMobileChange(fn: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => fn(isAutoMobileEnabled())
  window.addEventListener('myo-auto-mobile-change', handler)
  return () => window.removeEventListener('myo-auto-mobile-change', handler)
}

/**
 * 将自动切换开关绑定到页面根元素：
 * 开关关闭时给根元素加 .no-auto-mobile（禁用 CSS media query 自动布局），
 * 返回取消绑定函数（组件卸载时调用）。
 */
export function bindAutoMobile(el: () => HTMLElement | null): () => void {
  if (typeof window === 'undefined') return () => {}
  const apply = () => {
    const node = el()
    if (!node) return
    if (isAutoMobileEnabled()) node.classList.remove('no-auto-mobile')
    else node.classList.add('no-auto-mobile')
  }
  apply()
  const off = onAutoMobileChange(apply)
  return () => off()
}
