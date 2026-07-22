import { bindPlatformSelect, getPlatform, platformMeta } from './platform.js'

const qEl = document.getElementById('q')
const targetEl = document.getElementById('target')
const rowsEl = document.getElementById('rows')
const countEl = document.getElementById('count')
const statusEl = document.getElementById('status')

let entries = []
let platform = getPlatform()

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function filtered() {
  const q = qEl.value.trim().toLowerCase()
  const target = targetEl.value
  return entries.filter((e) => {
    if (target && e.target !== target) return false
    if (!q) return true
    return (
      e.en.toLowerCase().includes(q) ||
      e.zh.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    )
  })
}

function render() {
  const list = filtered()
  const meta = platformMeta(platform)
  countEl.textContent = `${meta.label} · 显示 ${list.length} / ${entries.length} 条`
  rowsEl.innerHTML = list
    .map(
      (e, i) => `<tr>
      <td class="col-i">${i + 1}</td>
      <td><code>${esc(e.en)}</code></td>
      <td>${esc(e.zh)}</td>
      <td class="col-meta">${esc(e.category)}</td>
      <td class="col-meta">${esc(e.target)}</td>
    </tr>`
    )
    .join('')
}

async function load() {
  statusEl.textContent = '正在加载词典…'
  statusEl.className = 'status'
  try {
    const res = await fetch(`/api/dict?platform=${encodeURIComponent(platform)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    entries = data.entries || []
    statusEl.textContent = ''
    render()
  } catch (err) {
    statusEl.textContent = `加载失败：${err.message || err}`
    statusEl.className = 'status err'
    countEl.textContent = '—'
  }
}

bindPlatformSelect(document.getElementById('platform'), {
  onChange: (id) => {
    platform = id
    load()
  },
})

qEl.addEventListener('input', render)
targetEl.addEventListener('change', render)
load()
