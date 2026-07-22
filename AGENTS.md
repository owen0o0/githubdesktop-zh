# AGENTS.md — 网页汉化工具

纯前端静态汉化：浏览器读取 `main.js` / `renderer.js`，按**平台词典**字面量替换，再下载。

## 结构

```
web/
├── index.html          汉化工作台（含平台选择）
├── help.html           各平台使用说明
├── dict.html           词典只读查看
├── dict-edit.html      词典编辑（密码鉴权）
├── platform.js         平台 id / 词典路径 / localStorage
├── app.js / dict-view.js / dict-edit.js
├── worker.js / zh-core.js / zip.js
└── dict/
    ├── Mac.zh
    ├── Windows.zh
    └── Linux.zh
scripts/web-server.cjs  静态站 + 词典 API
```

## 命令

```bash
npm start   # → http://127.0.0.1:5173/
```

密码写在根目录 `.env`（见 `.env.example`），默认 `zh-edit`。

## 词典 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/platforms` | 可用平台列表 |
| GET | `/api/dict?platform=mac\|windows\|linux` | 返回 entries |
| POST | `/api/auth` | `{password}` → `{token}` |
| PUT | `/api/dict?platform=…` | Bearer + `{entries\|text, platform?}` |

## 版本策略

详见 **[docs/dict-versioning.md](docs/dict-versioning.md)**（约定已定，实现未做）。

摘要：

- 平台必分词典；大版本用文件夹；小版本在词条上挂 `since`，选定版本后应用 `since ≤ 所选`（同英文 key 取最大 since）。
- 当前仍为扁平的 `Mac.zh` / `Windows.zh` / `Linux.zh`，无版本 UI。

## 词典格式

`英文>*.*<中文>*.*<分类>*.*<main.js|renderer.js>`

- 必须与压缩 JS 中字面量完全一致（含引号/反引号大小写）
- 勿翻译 `return"enabled"` 一类控制流状态串（运行时会自动跳过）
