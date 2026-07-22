import { bindPlatformSelect, getPlatform, platformMeta } from './platform.js'

const TOKEN_KEY = 'dict-edit-token'

const gateEl = document.getElementById('gate')
const editorEl = document.getElementById('editor')
const authForm = document.getElementById('auth-form')
const passwordEl = document.getElementById('password')
const authStatusEl = document.getElementById('auth-status')
const qEl = document.getElementById('q')
const targetEl = document.getElementById('target')
const rowsEl = document.getElementById('rows')
const countEl = document.getElementById('count')
const statusEl = document.getElementById('status')
const addBtn = document.getElementById('add')
const saveBtn = document.getElementById('save')
const lockBtn = document.getElementById('lock')

/** @type {{en:string,zh:string,category:string,target:string}[]} */
let entries = []
let token = sessionStorage.getItem(TOKEN_KEY) || ''
let platform = getPlatform()

function setStatus(msg, kind) {
  statusEl.textContent = msg || ''
  statusEl.className = kind ? `status ${kind}` : 'status'
}

function unlockUi() {
  gateEl.hidden = true
  editorEl.hidden = false
}

function lockUi() {
  token = ''
  sessionStorage.removeItem(TOKEN_KEY)
  gateEl.hidden = false
  editorEl.hidden = true
  passwordEl.value = ''
  authStatusEl.textContent = ''
  authStatusEl.className = 'status'
}

function filteredIndexes() {
  const q = qEl.value.trim().toLowerCase()
  const target = targetEl.value
  const idxs = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (target && e.target !== target) continue
    if (
      q &&
      !(
        e.en.toLowerCase().includes(q) ||
        e.zh.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      )
    ) {
      continue
    }
    idxs.push(i)
  }
  return idxs
}

function render() {
  const idxs = filteredIndexes()
  const meta = platformMeta(platform)
  countEl.textContent = `${meta.label}（${meta.file}）· 显示 ${idxs.length} / ${entries.length} 条`
  rowsEl.innerHTML = idxs
    .map((i) => {
      const e = entries[i]
      return `<tr data-i="${i}">
        <td class="col-i">${i + 1}</td>
        <td><input data-f="en" value="${escapeAttr(e.en)}" /></td>
        <td><input data-f="zh" value="${escapeAttr(e.zh)}" /></td>
        <td class="col-meta"><input data-f="category" value="${escapeAttr(e.category)}" /></td>
        <td class="col-meta">
          <select data-f="target">
            <option value="main.js"${e.target === 'main.js' ? ' selected' : ''}>main.js</option>
            <option value="renderer.js"${e.target === 'renderer.js' ? ' selected' : ''}>renderer.js</option>
          </select>
        </td>
        <td class="col-act"><button type="button" class="btn btn-ghost btn-tiny" data-del="${i}">删</button></td>
      </tr>`
    })
    .join('')
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function syncFromDom(row) {
  const i = Number(row.dataset.i)
  if (!Number.isInteger(i) || !entries[i]) return
  const en = row.querySelector('[data-f="en"]')
  const zh = row.querySelector('[data-f="zh"]')
  const category = row.querySelector('[data-f="category"]')
  const target = row.querySelector('[data-f="target"]')
  entries[i] = {
    en: en.value,
    zh: zh.value,
    category: category.value.trim() || '未分类',
    target: target.value === 'main.js' ? 'main.js' : 'renderer.js',
  }
}

async function loadDict() {
  setStatus('正在加载词典…')
  const res = await fetch(`/api/dict?platform=${encodeURIComponent(platform)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  entries = (data.entries || []).map((e) => ({
    en: e.en,
    zh: e.zh,
    category: e.category || '未分类',
    target: e.target === 'main.js' ? 'main.js' : 'renderer.js',
  }))
  setStatus('')
  render()
}

bindPlatformSelect(document.getElementById('platform'), {
  onChange: (id) => {
    platform = id
    if (!editorEl.hidden) {
      loadDict().catch((err) => setStatus(`加载失败：${err.message || err}`, 'err'))
    }
  },
})

authForm.addEventListener('submit', async (ev) => {
  ev.preventDefault()
  authStatusEl.textContent = '验证中…'
  authStatusEl.className = 'status'
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordEl.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    token = data.token
    sessionStorage.setItem(TOKEN_KEY, token)
    unlockUi()
    await loadDict()
  } catch (err) {
    authStatusEl.textContent = err.message || String(err)
    authStatusEl.className = 'status err'
  }
})

rowsEl.addEventListener('change', (ev) => {
  const row = ev.target.closest('tr[data-i]')
  if (row) syncFromDom(row)
})

rowsEl.addEventListener('input', (ev) => {
  const row = ev.target.closest('tr[data-i]')
  if (row) syncFromDom(row)
})

rowsEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-del]')
  if (!btn) return
  const i = Number(btn.getAttribute('data-del'))
  if (!Number.isInteger(i)) return
  entries.splice(i, 1)
  render()
})

addBtn.addEventListener('click', () => {
  entries.unshift({
    en: '',
    zh: '',
    category: '未分类',
    target: 'renderer.js',
  })
  qEl.value = ''
  targetEl.value = ''
  render()
  const first = rowsEl.querySelector('input[data-f="en"]')
  if (first) first.focus()
})

saveBtn.addEventListener('click', async () => {
  rowsEl.querySelectorAll('tr[data-i]').forEach(syncFromDom)
  const cleaned = entries
    .map((e) => ({
      en: e.en.trim(),
      zh: e.zh.trim(),
      category: (e.category || '未分类').trim() || '未分类',
      target: e.target === 'main.js' ? 'main.js' : 'renderer.js',
    }))
    .filter((e) => e.en && e.zh)

  const meta = platformMeta(platform)
  setStatus('保存中…')
  try {
    const res = await fetch(`/api/dict?platform=${encodeURIComponent(platform)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ platform, entries: cleaned }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      lockUi()
      authStatusEl.textContent = '登录已过期，请重新解锁'
      authStatusEl.className = 'status err'
      return
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    entries = cleaned
    setStatus(`已保存 ${data.count} 条到 ${meta.file}（已备份 ${meta.file}.bak）`, 'ok')
    render()
  } catch (err) {
    setStatus(`保存失败：${err.message || err}`, 'err')
  }
})

lockBtn.addEventListener('click', () => {
  lockUi()
})

qEl.addEventListener('input', render)
targetEl.addEventListener('change', render)

if (token) {
  unlockUi()
  loadDict().catch((err) => {
    setStatus(`加载失败：${err.message || err}`, 'err')
  })
}
