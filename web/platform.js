/** 平台 ID ↔ 词典文件 */
export const PLATFORMS = [
  { id: 'mac', label: 'macOS', file: 'Mac.zh' },
  { id: 'windows', label: 'Windows', file: 'Windows.zh' },
  { id: 'linux', label: 'Linux', file: 'Linux.zh' },
]

const STORAGE_KEY = 'zh-platform'

export function detectPlatform() {
  const ua = navigator.userAgent || ''
  const plat = navigator.platform || ''
  if (/Win/i.test(plat) || /Windows/i.test(ua)) return 'windows'
  if (/Linux/i.test(plat) || (/Linux/i.test(ua) && !/Android/i.test(ua))) return 'linux'
  return 'mac'
}

export function normalizePlatform(id) {
  const hit = PLATFORMS.find((p) => p.id === id)
  return hit ? hit.id : 'mac'
}

export function getPlatform() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return normalizePlatform(saved)
  } catch {
    /* ignore */
  }
  return detectPlatform()
}

export function setPlatform(id) {
  const p = normalizePlatform(id)
  try {
    localStorage.setItem(STORAGE_KEY, p)
  } catch {
    /* ignore */
  }
  return p
}

export function platformMeta(id) {
  return PLATFORMS.find((p) => p.id === normalizePlatform(id))
}

export function dictUrl(id) {
  return `./dict/${platformMeta(id).file}`
}

/** 填充 <select>，返回当前平台 id */
export function bindPlatformSelect(selectEl, { onChange } = {}) {
  if (!selectEl) return getPlatform()
  selectEl.innerHTML = PLATFORMS.map(
    (p) => `<option value="${p.id}">${p.label}</option>`
  ).join('')
  const current = getPlatform()
  selectEl.value = current
  selectEl.addEventListener('change', () => {
    const next = setPlatform(selectEl.value)
    if (typeof onChange === 'function') onChange(next)
  })
  return current
}
