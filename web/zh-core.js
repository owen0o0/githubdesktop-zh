/**
 * 浏览器端词典解析与静态替换
 */
const SEP = '>*.*<'
const VALID_TARGETS = new Set(['main.js', 'renderer.js'])

function parseZhLine(line, lineNo) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const parts = trimmed.split(SEP)
  if (parts.length < 4) {
    throw new Error(`第 ${lineNo} 行格式错误`)
  }
  const en = parts[0]
  const zh = parts[1]
  const category = parts[2]
  const target = parts.slice(3).join(SEP).trim().replace(/\r$/, '')
  if (!en) throw new Error(`第 ${lineNo} 行英文为空`)
  if (!VALID_TARGETS.has(target)) {
    throw new Error(`第 ${lineNo} 行目标无效: ${target}`)
  }
  return { en, zh, category, target, line: lineNo }
}

function parseZhText(text) {
  const rules = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const rule = parseZhLine(lines[i], i + 1)
    if (rule) rules.push(rule)
  }
  return rules
}

function groupRulesByTarget(rules) {
  const groups = { 'main.js': [], 'renderer.js': [] }
  for (const rule of rules) groups[rule.target].push(rule)
  return groups
}

function countOcc(haystack, needle) {
  if (!needle) return 0
  let n = 0
  let from = 0
  while (true) {
    const i = haystack.indexOf(needle, from)
    if (i < 0) break
    n++
    from = i + needle.length
  }
  return n
}

function isStateTokenRule(en, source) {
  if (!en || !source.includes(en)) return false
  if (/^["'][A-Za-z][A-Za-z0-9_-]{0,40}["']\s*;$/.test(en)) return true
  const codeHits =
    countOcc(source, `return${en}`) +
    countOcc(source, `case${en}`) +
    countOcc(source, `===${en}`) +
    countOcc(source, `!==${en}`) +
    countOcc(source, `==${en}`) +
    countOcc(source, `!=${en}`)
  return codeHits > 0
}

function sortRulesForReplace(rules) {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      const lenDiff = b.rule.en.length - a.rule.en.length
      if (lenDiff !== 0) return lenDiff
      return a.index - b.index
    })
    .map((item) => item.rule)
}

function applyRules(source, rules) {
  const ordered = sortRulesForReplace(rules)
  let output = source
  let hit = 0
  let miss = 0
  let skipped = 0
  let replacements = 0

  for (const rule of ordered) {
    if (!rule.en) {
      miss++
      continue
    }
    if (isStateTokenRule(rule.en, source)) {
      skipped++
      continue
    }
    if (!output.includes(rule.en)) {
      miss++
      continue
    }
    const parts = output.split(rule.en)
    const count = parts.length - 1
    output = parts.join(rule.zh)
    hit++
    replacements += count
  }

  return { output, hit, miss, skipped, replacements }
}

function applyForFile(source, allRules, fileName) {
  const grouped = groupRulesByTarget(allRules)
  return applyRules(source, grouped[fileName] || [])
}
