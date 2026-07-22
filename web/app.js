import { buildZip } from './zip.js'
import { bindPlatformSelect, dictUrl, platformMeta, getPlatform } from './platform.js'

;(() => {
  const fileMain = document.getElementById('file-main')
  const fileRenderer = document.getElementById('file-renderer')
  const metaMain = document.getElementById('meta-main')
  const metaRenderer = document.getElementById('meta-renderer')
  const dropMain = document.getElementById('drop-main')
  const dropRenderer = document.getElementById('drop-renderer')
  const btnRun = document.getElementById('btn-run')
  const btnDlMain = document.getElementById('btn-dl-main')
  const btnDlRenderer = document.getElementById('btn-dl-renderer')
  const btnDlBoth = document.getElementById('btn-dl-both')
  const statusEl = document.getElementById('status')
  const statsEl = document.getElementById('stats')
  const statMain = document.getElementById('stat-main')
  const statRenderer = document.getElementById('stat-renderer')
  const progressEl = document.getElementById('progress')
  const progressFill = document.getElementById('progress-fill')
  const platformHint = document.getElementById('platform-hint')

  let mainFile = null
  let rendererFile = null
  let outputs = null
  let platform = getPlatform()

  function updatePlatformHint() {
    const meta = platformMeta(platform)
    platformHint.textContent = `当前词典：${meta.file}（${meta.label}）`
  }

  bindPlatformSelect(document.getElementById('platform'), {
    onChange: (id) => {
      platform = id
      updatePlatformHint()
      clearOutputs()
      setStatus(`已切换到 ${platformMeta(id).label} 词典。请重新汉化。`)
    },
  })
  updatePlatformHint()

  function setStatus(message, kind) {
    statusEl.textContent = message
    statusEl.classList.remove('ok', 'err')
    if (kind) statusEl.classList.add(kind)
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(2)} MB`
  }

  function updateRunEnabled() {
    btnRun.disabled = !(mainFile && rendererFile)
  }

  function clearOutputs() {
    outputs = null
    btnDlMain.disabled = true
    btnDlRenderer.disabled = true
    btnDlBoth.disabled = true
    statsEl.hidden = true
    progressEl.hidden = true
    progressFill.classList.remove('is-done')
  }

  function baseName(path) {
    const name = String(path || '').replace(/\\/g, '/').split('/').pop() || ''
    return name.trim()
  }

  function matchExpectedName(fileName, expected) {
    return baseName(fileName).toLowerCase() === String(expected).toLowerCase()
  }

  async function assignFile(which, file, inputEl) {
    if (!file) return
    if (!matchExpectedName(file.name, which)) {
      const got = baseName(file.name) || '(未知)'
      const swapped =
        (which === 'main.js' && matchExpectedName(file.name, 'renderer.js')) ||
        (which === 'renderer.js' && matchExpectedName(file.name, 'main.js'))
      setStatus(
        swapped
          ? `文件放错位置：当前槽位需要 ${which}，你选的是 ${got}。`
          : `文件名不匹配：请选择 ${which}，当前是 ${got}。`,
        'err'
      )
      if (inputEl) inputEl.value = ''
      return
    }

    const text = await file.text()
    const entry = { name: which, text, file }
    if (which === 'main.js') {
      mainFile = entry
      metaMain.textContent = `${file.name} · ${formatBytes(file.size)}`
      dropMain.classList.add('has-file')
    } else {
      rendererFile = entry
      metaRenderer.textContent = `${file.name} · ${formatBytes(file.size)}`
      dropRenderer.classList.add('has-file')
    }
    clearOutputs()
    updateRunEnabled()
    setStatus('文件已就绪。点击「开始汉化」。')
  }

  function bindDrop(dropEl, inputEl, which) {
    inputEl.addEventListener('change', () => {
      const file = inputEl.files && inputEl.files[0]
      if (file) assignFile(which, file, inputEl)
    })

    ;['dragenter', 'dragover'].forEach((evt) => {
      dropEl.addEventListener(evt, (e) => {
        e.preventDefault()
        dropEl.classList.add('is-drag')
      })
    })
    ;['dragleave', 'drop'].forEach((evt) => {
      dropEl.addEventListener(evt, (e) => {
        e.preventDefault()
        dropEl.classList.remove('is-drag')
      })
    })
    dropEl.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) assignFile(which, file, inputEl)
    })
  }

  bindDrop(dropMain, fileMain, 'main.js')
  bindDrop(dropRenderer, fileRenderer, 'renderer.js')

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function downloadText(filename, text) {
    downloadBlob(
      filename,
      new Blob([text], { type: 'application/javascript;charset=utf-8' })
    )
  }

  function renderStats(results) {
    const fmt = (x) =>
      `命中 ${x.hit}/${x.hit + x.miss}\n替换 ${x.replacements} 处` +
      (x.skipped ? ` · 跳过 ${x.skipped}` : '') +
      `\n${formatBytes(x.bytesIn)} → ${formatBytes(x.bytesOut)}`
    statMain.textContent = fmt(results['main.js'])
    statRenderer.textContent = fmt(results['renderer.js'])
    statsEl.hidden = false
  }

  async function loadDictText() {
    const res = await fetch(dictUrl(platform))
    if (!res.ok) throw new Error(`词典加载失败（${res.status}）`)
    return await res.text()
  }

  btnRun.addEventListener('click', async () => {
    if (!mainFile || !rendererFile) return
    clearOutputs()
    btnRun.disabled = true
    progressEl.hidden = false
    const meta = platformMeta(platform)
    setStatus(`正在加载 ${meta.label} 词典（${meta.file}）…`)

    try {
      const dictText = await loadDictText()
      const worker = new Worker('./worker.js')

      const done = new Promise((resolve, reject) => {
        worker.onmessage = (event) => {
          const data = event.data
          if (data.type === 'progress') {
            setStatus(data.message)
          } else if (data.type === 'done') {
            resolve(data)
          } else if (data.type === 'error') {
            reject(new Error(data.message))
          }
        }
        worker.onerror = (err) => {
          reject(err.error || new Error(err.message || 'Worker 错误'))
        }
      })

      worker.postMessage({
        dictText,
        files: [
          { name: 'main.js', text: mainFile.text },
          { name: 'renderer.js', text: rendererFile.text },
        ],
      })

      const { results, rulesTotal } = await done
      worker.terminate()
      outputs = results
      progressFill.classList.add('is-done')
      renderStats(results)
      btnDlMain.disabled = false
      btnDlRenderer.disabled = false
      btnDlBoth.disabled = false
      setStatus(`完成（${meta.label}）。词典 ${rulesTotal} 条，可以下载了。`, 'ok')
    } catch (err) {
      progressEl.hidden = true
      setStatus(`失败：${err.message || err}`, 'err')
    } finally {
      updateRunEnabled()
    }
  })

  btnDlMain.addEventListener('click', () => {
    if (outputs && outputs['main.js']) downloadText('main.js', outputs['main.js'].text)
  })
  btnDlRenderer.addEventListener('click', () => {
    if (outputs && outputs['renderer.js']) {
      downloadText('renderer.js', outputs['renderer.js'].text)
    }
  })
  btnDlBoth.addEventListener('click', () => {
    if (!outputs) return
    const zip = buildZip([
      { name: 'main.js', data: outputs['main.js'].text },
      { name: 'renderer.js', data: outputs['renderer.js'].text },
    ])
    downloadBlob(`github-desktop-zh-${platform}.zip`, zip)
  })
})()
