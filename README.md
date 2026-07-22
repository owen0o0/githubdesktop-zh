# GitHub Desktop 网页汉化

浏览器本地上传 `main.js` / `renderer.js`，按**平台词典**静态替换后下载。**文件不离开本机。**

## 使用

```bash
npm start
```

打开 http://127.0.0.1:5173/

1. 选择平台（macOS / Windows / Linux，默认按系统猜测）
2. 上传安装目录中的 `main.js`、`renderer.js`
3. 点击「开始汉化」
4. 下载文件（或 ZIP）并覆盖回安装目录

各平台路径与收尾步骤见 http://127.0.0.1:5173/help.html

### 词典

| 平台 | 文件 |
|---|---|
| macOS | `web/dict/Mac.zh` |
| Windows | `web/dict/Windows.zh` |
| Linux | `web/dict/Linux.zh` |

| 页面 | 地址 |
|---|---|
| 查看 | http://127.0.0.1:5173/dict.html |
| 编辑 | http://127.0.0.1:5173/dict-edit.html |
| 帮助 | http://127.0.0.1:5173/help.html |

编辑密码写在项目根目录 `.env`（可参考 `.env.example`）：

```bash
DICT_EDIT_PASSWORD=你的密码
```

保存会写入对应平台的 `.zh`，并备份为 `*.zh.bak`。

### 关于 Desktop 版本

不同 GitHub Desktop 版本的 JS 文案会有增减。版本管理约定见 [`docs/dict-versioning.md`](docs/dict-versioning.md)（小版本用词条 `since` 水位线，大版本分文件夹）。**当前未做版本选择 UI**，每平台一份主线词典；优先保证平台选对。

## 注意

- 平台选错会明显漏译（大小写、`&` 快捷键、Finder/Explorer 等）
- 替换会跳过 `return` / `case` 等状态字面量，避免设置页空白

## 许可证

MIT
