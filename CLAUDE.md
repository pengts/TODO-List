# TODO List 桌面便签应用

## 技术栈
- Wails v2 + Go (后端)
- 纯 JS + Vite (前端)
- JSON 文件持久化 (~/.todo-list/data.json)

## 项目结构
- `main.go` — Wails 入口，frameless 窗口，支持 --page-id 参数指定打开哪个便签
- `app.go` — Go 后端方法：LoadData/SaveData/DeletePage/NewWindow/SetAlwaysOnTop/窗口控制
- `frontend/src/main.js` — 前端全部逻辑（纯 JS DOM 操作）
- `frontend/src/style.css` — 绿色便签主题样式
- `frontend/wailsjs/` — Wails 自动生成的 Go 绑定（手动维护，新增 Go 方法后需同步更新 App.js 和 App.d.ts）

## 核心机制
- 每个便签是独立进程/窗口，通过 --page-id 参数绑定到 data.json 中的某个 page
- +按钮创建新 page 并启动新进程
- 标题栏列表按钮可查看所有便签、打开已关闭的便签、永久删除便签
- 关闭窗口不删除数据，数据始终保留在 data.json 中
- 编辑器使用 contenteditable，content 存储 HTML
- 内容加载时经过 `sanitizeContent` 清洗（移除 `<font>` 标签和内联 font-size），防止 WebView2 版本更新后旧 HTML 字号爆炸
- 粘贴操作强制纯文本，阻止外部富文本格式污染
- TODO 取消勾选时通过 `clearInlineColor` 清除浏览器烘焙的内联灰色样式

## 构建命令
```bash
# 前端构建
cd frontend && npx vite build

# Windows exe 交叉编译（在 Linux 上）
GOOS=windows GOARCH=amd64 go build -tags desktop,production -ldflags="-s -w -H windowsgui" -o build/bin/"TODO List.exe"
```

## 注意事项
- Go 的 PATH 在此服务器上需要: export PATH=$PATH:/usr/local/go/bin
- 编译 exe 必须带 -tags desktop,production，否则启动时报错
- wailsjs 绑定文件需手动同步，新增/修改 Go 导出方法后更新 frontend/wailsjs/go/main/App.js 和 App.d.ts
- contenteditable 环境下浏览器会将 CSS 计算样式烘焙为内联 style，修改 CSS 选择器状态不会自动清除内联样式，需要手动处理
- 不要在 contenteditable 内容中依赖相对字号单位（em/larger/%），会因嵌套标签累积而指数级放大
