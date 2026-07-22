#!/usr/bin/env node
/**
 * 静态服务器 + 词典 API
 * http://127.0.0.1:5173/
 *
 * 编辑密码：.env 或环境变量 DICT_EDIT_PASSWORD（默认 zh-edit）
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const ROOT = path.join(PROJECT_ROOT, 'web')
const DICT_DIR = path.join(ROOT, 'dict')

const PLATFORM_FILES = {
  mac: 'Mac.zh',
  windows: 'Windows.zh',
  linux: 'Linux.zh',
}

function resolveDictPath(platform) {
  const key = String(platform || 'mac').toLowerCase()
  const file = PLATFORM_FILES[key] || PLATFORM_FILES.mac
  return { platform: PLATFORM_FILES[key] ? key : 'mac', file, path: path.join(DICT_DIR, file) }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    // 已有环境变量优先，不覆盖
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(path.join(PROJECT_ROOT, '.env'))

const PORT = Number(process.env.PORT || 5173)
const HOST = process.env.HOST || '127.0.0.1'
const EDIT_PASSWORD = process.env.DICT_EDIT_PASSWORD || 'zh-edit'
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

/** @type {Map<string, number>} token -> expireAt */
const tokens = new Map()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.zh': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const SEP = '>*.*<'
const VALID_TARGETS = new Set(['main.js', 'renderer.js'])

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0])
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const full = path.join(root, cleaned)
  if (!full.startsWith(root)) return null
  return full
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 8 * 1024 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseZhText(text) {
  const rules = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) {
      rules.push({ type: 'blank', line: i + 1, raw })
      continue
    }
    if (trimmed.startsWith('#')) {
      rules.push({ type: 'comment', line: i + 1, raw: trimmed, text: trimmed.slice(1).trim() })
      continue
    }
    const parts = trimmed.split(SEP)
    if (parts.length < 4) {
      rules.push({ type: 'invalid', line: i + 1, raw: trimmed })
      continue
    }
    const en = parts[0]
    const zh = parts[1]
    const category = parts[2]
    const target = parts.slice(3).join(SEP).trim().replace(/\r$/, '')
    rules.push({
      type: 'rule',
      line: i + 1,
      en,
      zh,
      category,
      target,
      raw: trimmed,
    })
  }
  return rules
}

function serializeRules(items) {
  const lines = []
  for (const item of items) {
    if (item.type === 'blank') {
      lines.push('')
      continue
    }
    if (item.type === 'comment') {
      lines.push(item.raw.startsWith('#') ? item.raw : `# ${item.text || ''}`)
      continue
    }
    if (item.type === 'invalid') {
      if (item.raw) lines.push(item.raw)
      continue
    }
    // type === 'rule' 或编辑页提交的纯对象 {en,zh,category,target}
    if (!item.en || !VALID_TARGETS.has(item.target)) {
      throw new Error(`无效规则（第 ${item.line || '?'} 行附近）：英文或目标文件不合法`)
    }
    if (String(item.en).includes(SEP) || String(item.zh).includes(SEP)) {
      throw new Error('英文/中文不能包含分隔符 >*.*<')
    }
    lines.push(
      `${item.en}${SEP}${item.zh ?? ''}${SEP}${item.category || '未分类'}${SEP}${item.target}`
    )
  }
  return lines.join('\n').replace(/\n*$/, '\n')
}

function purgeTokens() {
  const now = Date.now()
  for (const [token, exp] of tokens) {
    if (exp <= now) tokens.delete(token)
  }
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, Buffer.alloc(ba.length))
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

function getBearerToken(req) {
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return m ? m[1].trim() : ''
}

function requireEditAuth(req, res) {
  purgeTokens()
  const token = getBearerToken(req)
  const exp = tokens.get(token)
  if (!token || !exp || exp <= Date.now()) {
    sendJson(res, 401, { ok: false, error: '未授权或登录已过期，请重新验证密码' })
    return false
  }
  return true
}

async function handleApi(req, res, pathname, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return true
  }

  if (pathname === '/api/platforms' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      platforms: Object.entries(PLATFORM_FILES).map(([id, file]) => ({
        id,
        file,
        exists: fs.existsSync(path.join(DICT_DIR, file)),
      })),
    })
    return true
  }

  if (pathname === '/api/dict' && req.method === 'GET') {
    const { platform, file, path: dictPath } = resolveDictPath(url.searchParams.get('platform'))
    if (!fs.existsSync(dictPath)) {
      sendJson(res, 404, { ok: false, error: `词典不存在：${file}` })
      return true
    }
    const text = fs.readFileSync(dictPath, 'utf8')
    const parsed = parseZhText(text)
    const entries = parsed
      .filter((e) => e.type === 'rule')
      .map((e) => ({
        en: e.en,
        zh: e.zh,
        category: e.category,
        target: e.target,
        line: e.line,
      }))
    sendJson(res, 200, {
      ok: true,
      platform,
      file,
      ruleCount: entries.length,
      count: entries.length,
      entries,
      text,
    })
    return true
  }

  if (pathname === '/api/auth' && req.method === 'POST') {
    const raw = await readBody(req)
    let body
    try {
      body = JSON.parse(raw || '{}')
    } catch {
      sendJson(res, 400, { ok: false, error: 'JSON 无效' })
      return true
    }
    if (!timingSafeEqualStr(body.password || '', EDIT_PASSWORD)) {
      sendJson(res, 403, { ok: false, error: '密码错误' })
      return true
    }
    purgeTokens()
    const token = crypto.randomBytes(24).toString('hex')
    tokens.set(token, Date.now() + TOKEN_TTL_MS)
    sendJson(res, 200, {
      ok: true,
      token,
      expiresIn: TOKEN_TTL_MS,
    })
    return true
  }

  if (pathname === '/api/dict' && req.method === 'PUT') {
    if (!requireEditAuth(req, res)) return true
    const raw = await readBody(req)
    let body
    try {
      body = JSON.parse(raw || '{}')
    } catch {
      sendJson(res, 400, { ok: false, error: 'JSON 无效' })
      return true
    }

    const platformHint = body.platform || url.searchParams.get('platform')
    const { platform, file, path: dictPath } = resolveDictPath(platformHint)

    let nextText
    try {
      if (typeof body.text === 'string') {
        parseZhText(body.text)
        nextText = body.text.replace(/\n*$/, '\n')
      } else if (Array.isArray(body.entries)) {
        nextText = serializeRules(body.entries)
      } else {
        sendJson(res, 400, { ok: false, error: '需要 text 或 entries' })
        return true
      }
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message || String(e) })
      return true
    }

    const bak = dictPath + '.bak'
    if (fs.existsSync(dictPath)) {
      fs.copyFileSync(dictPath, bak)
    }
    fs.writeFileSync(dictPath, nextText, 'utf8')
    const entries = parseZhText(nextText).filter((e) => e.type === 'rule')
    sendJson(res, 200, {
      ok: true,
      platform,
      file,
      ruleCount: entries.length,
      count: entries.length,
      message: `已保存（并写入 ${file}.bak）`,
    })
    return true
  }

  return false
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
    const pathname = url.pathname

    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, pathname, url)
      if (handled) return
      sendJson(res, 404, { ok: false, error: 'API 不存在' })
      return
    }

    let filePath = safeJoin(ROOT, pathname)
    if (!filePath) {
      res.writeHead(403).end('Forbidden')
      return
    }

    fs.stat(filePath, (err, st) => {
      if (!err && st.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }
      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Not Found')
          return
        }
        const ext = path.extname(filePath).toLowerCase()
        res.writeHead(200, {
          'Content-Type': TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        res.end(data)
      })
    })
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message || String(e) })
  }
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`网页版: http://${HOST}:${PORT}/\n`)
  process.stdout.write(`词典查看: http://${HOST}:${PORT}/dict.html\n`)
  process.stdout.write(`词典编辑: http://${HOST}:${PORT}/dict-edit.html\n`)
  process.stdout.write(`编辑密码环境变量: DICT_EDIT_PASSWORD\n`)
})
