# TODO List 桌面便签应用

## 技术栈
- Wails v2.11.0 + Go 1.23.6 (后端)
- 纯 JS + Vite (前端)
- JSON 文件持久化 (~/.todo-list/data.json)
- Windows 上使用 WebView2 (go-webview2 v1.0.22) 渲染

## 项目结构
- `main.go` — Wails 入口，frameless 窗口，支持 --page-id 参数指定打开哪个便签
- `app.go` — Go 后端方法：LoadData/SaveData/DeletePage/NewWindow/SetAlwaysOnTop/GetWindowSize/窗口控制
- `frontend/src/main.js` — 前端全部逻辑（纯 JS DOM 操作）
- `frontend/src/style.css` — 多主题便签样式（green/yellow/blue/pink/purple/orange）
- `frontend/wailsjs/` — Wails 自动生成的 Go 绑定（手动维护，新增 Go 方法后需同步更新 App.js 和 App.d.ts）
- `winres/winres.json` — Windows 资源配置（图标、manifest、DPI 声明）
- `rsrc_windows_amd64.syso` — 由 go-winres 从 winres/ 生成的 Windows 资源二进制

## 核心机制
- 每个便签是独立进程/窗口，通过 --page-id 参数绑定到 data.json 中的某个 page
- +按钮创建新 page 并启动新进程
- 标题栏列表按钮可查看所有便签、打开已关闭的便签、永久删除便签
- 关闭窗口不删除数据，数据始终保留在 data.json 中
- 编辑器使用 contenteditable，content 存储 HTML
- 内容加载时经过 `sanitizeContent` 清洗（移除 `<font>` 标签和内联 font-size），防止 WebView2 版本更新后旧 HTML 字号爆炸
- 粘贴操作强制纯文本，阻止外部富文本格式污染
- TODO 取消勾选时通过 `clearInlineColor` 清除浏览器烘焙的内联灰色样式
- DPI 补偿：`setupDPICompensation` 监听 resize 事件，比对 Go 逻辑宽度与 JS CSS 视口宽度，通过 CSS zoom 补偿跨显示器 DPI 差异

## DPI/缩放处理（重要）

### 问题背景
go-webview2 v1.0.22 硬编码了 `BoundsMode = USE_RAW_PIXELS` 和 `ShouldDetectMonitorScaleChanges = false`。这意味着 WebView2 的 RasterizationScale 在窗口创建时锁定，不会随显示器切换而自动调整。

### 已实施的修复
1. **manifest DPI 声明** (`winres/winres.json`): `dpi-awareness` 设为 `per monitor v2`，确保 Windows 不对窗口做位图拉伸。修改后需用 `go-winres make --arch amd64` 重新生成 .syso
2. **CSS font 防御** (`style.css`): `.note-editor font { font-size: inherit !important }` 防止残留 `<font>` 标签字号爆炸
3. **JS DPI 补偿** (`main.js setupDPICompensation`): 监听 resize 事件，通过 Go 的 `GetWindowSize`（返回 DPI 无关逻辑尺寸）与 `window.innerWidth`（基于冻结 RasterizationScale 的 CSS 视口）做比对，计算 `zoom = rawCSSWidth / logicalWidth` 动态补偿

### 已知限制
- `window.devicePixelRatio` 在 WebView2 中不会随显示器切换变化（因为 RasterizationScale 被冻结），不能用 matchMedia(resolution) 监听 DPI 变化
- CSS zoom 补偿是近似方案，在极端 DPI 差异下可能有轻微模糊

## 构建命令
```bash
# 前端构建
cd frontend && npx vite build

# 重新生成 Windows 资源（修改 winres/winres.json 后）
go-winres make --arch amd64

# Windows exe 交叉编译（在 Linux 上）
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags desktop,production -ldflags="-s -w -H windowsgui" -o build/bin/"TODO List.exe"
```

## 注意事项
- Go 的 PATH 在此服务器上需要: export PATH=$PATH:/usr/local/go/bin
- go-winres 安装: `go install github.com/tc-hib/go-winres@latest`，二进制在 `$(go env GOPATH)/bin/`
- 编译 exe 必须带 -tags desktop,production，否则启动时报错
- wailsjs 绑定文件需手动同步，新增/修改 Go 导出方法后更新 frontend/wailsjs/go/main/App.js 和 App.d.ts
- contenteditable 环境下浏览器会将 CSS 计算样式烘焙为内联 style，修改 CSS 选择器状态不会自动清除内联样式，需要手动处理
- 不要在 contenteditable 内容中依赖相对字号单位（em/larger/%），会因嵌套标签累积而指数级放大
- winres/winres.json 中的 `dpi-awareness` 必须保持 `per monitor v2`，改为 `system` 会导致多显示器下新窗口双重缩放
