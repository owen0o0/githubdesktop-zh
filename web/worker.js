/* global parseZhText, applyForFile */
importScripts('./zh-core.js')

self.onmessage = (event) => {
  const { dictText, files } = event.data
  try {
    const rules = parseZhText(dictText)
    self.postMessage({ type: 'progress', message: `词典已加载 ${rules.length} 条` })

    const results = {}
    for (const file of files) {
      self.postMessage({ type: 'progress', message: `正在处理 ${file.name}…` })
      const result = applyForFile(file.text, rules, file.name)
      results[file.name] = {
        text: result.output,
        hit: result.hit,
        miss: result.miss,
        skipped: result.skipped,
        replacements: result.replacements,
        bytesIn: new TextEncoder().encode(file.text).length,
        bytesOut: new TextEncoder().encode(result.output).length,
      }
    }
    self.postMessage({ type: 'done', results, rulesTotal: rules.length })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err && err.message ? err.message : String(err),
    })
  }
}
