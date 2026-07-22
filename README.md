# GitHub Desktop 网页汉化

浏览器本地上传 `main.js` / `renderer.js`，按**平台词典**静态替换后下载。**文件不离开本机。**

## 使用说明

### 1. 启动

```bash
npm start
```

打开 http://127.0.0.1:5173/

### 2. 通用步骤

1. **完全退出** GitHub Desktop（确保进程已结束）。
2. 在汉化页选择平台（macOS / Windows / Linux，默认按系统猜测）。
3. 从安装目录取出 `main.js`、`renderer.js` 并上传。
4. 点击「开始汉化」，下载结果（可单独下载或「下载 ZIP」）。
5. **建议先备份原文件**，再覆盖回安装目录。
6. 按下方平台说明完成收尾后，再启动 GitHub Desktop。

各平台路径与收尾步骤也可在本地帮助页查看：http://127.0.0.1:5173/help.html

### 3. 各平台路径

#### macOS

安装目录：

```text
/Applications/GitHub Desktop.app/Contents/Resources/app/
```

覆盖后必须重签，否则可能无法启动：

```bash
codesign --force --deep --sign - "/Applications/GitHub Desktop.app"
xattr -cr "/Applications/GitHub Desktop.app"
```

若无法直接写入，可先复制到桌面汉化，再拖回原目录（需管理员密码）。

#### Windows

通常在用户本地应用数据目录（版本号会变）：

```text
%LOCALAPPDATA%\GitHubDesktop\app-<版本号>\resources\app\
```

在资源管理器地址栏打开 `%LOCALAPPDATA%\GitHubDesktop`，进入最新的 `app-*` 文件夹后替换。覆盖前请退出托盘中的 GitHub Desktop；一般无需额外签名。

Squirrel 更新后会出现新的 `app-x.y.z` 目录，需对新区再汉化一次。

#### Linux

常见路径（因发行渠道可能不同）：

```text
/opt/github-desktop/resources/app/
/usr/lib/github-desktop/resources/app/
/usr/share/github-desktop/resources/app/
```

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
- Desktop 自动更新后汉化会失效，需对新版本目录再操作一次

## 参考

本项目思路与平台路径说明参考了 [robotze/GithubDesktopZhTool](https://github.com/robotze/GithubDesktopZhTool)（Windows / Mac / Linux 汉化工具）。

## 许可证

MIT
