# 极简日程管理APP - 技术选型与开发规范

## 一、项目概要

| 项目 | 说明 |
|------|------|
| 名称 | 极简日程管理 |
| 平台 | Windows 桌面应用 |
| 定位 | 轻量级个人日程管理工具，支持月/周/日三级计划视图 |

## 二、技术栈

### 核心框架

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | ^28.x | 桌面应用容器，提供窗口管理、系统API（置顶等） |
| Vue 3 | ^3.4.x | 前端UI框架，使用 Composition API + `<script setup>` 语法 |
| TypeScript | ^5.3.x | 类型安全，全项目强制使用TS |
| Vite | ^5.x | 构建工具，开发服务器 + 生产构建 |

### 状态管理与数据

| 技术 | 版本 | 用途 |
|------|------|------|
| Pinia | ^2.x | Vue官方状态管理库 |
| electron-store | ^8.x | 本地JSON持久化存储（基于Electron fs） |

### 打包发布

| 技术 | 版本 | 用途 |
|------|------|------|
| electron-builder | ^24.x | 打包为Windows exe安装包 |
| vite-plugin-electron | ^0.28.x | Vite集成Electron的插件 |

### 样式方案

| 方案 | 说明 |
|------|------|
| 原生CSS | 手写极简样式，不引入UI组件库 |
| CSS变量 | 统一主题色、间距、字体等设计令牌 |

## 三、项目结构规范

```
schedule-management/
├── electron/                # Electron主进程代码
│   ├── main.ts             # 窗口创建、系统API、IPC通信
│   └── preload.ts          # 预加载脚本，暴露安全API给渲染进程
├── src/                     # Vue前端代码（渲染进程）
│   ├── App.vue             # 根组件，视图路由切换
│   ├── main.ts             # Vue应用入口
│   ├── views/              # 页面级组件（三个视图）
│   │   ├── MonthView.vue   # 月计划 - 12个月网格
│   │   ├── WeekView.vue    # 周计划 - 当月4-5周列表
│   │   └── DayView.vue     # 日计划 - 7天x24h时间表
│   ├── components/         # 可复用组件
│   │   ├── TitleBar.vue    # 自定义标题栏（含置顶按钮）
│   │   └── TaskEditor.vue  # 任务/时间块编辑弹窗
│   ├── stores/             # Pinia状态管理
│   │   └── schedule.ts     # 日程数据store（含持久化逻辑）
│   ├── types/              # TypeScript类型定义
│   │   └── index.ts        # 所有数据模型接口
│   └── styles/             # 全局样式
│       └── main.css        # CSS变量、重置样式、公共类
├── package.json
├── vite.config.ts           # Vite + Electron插件配置
├── tsconfig.json            # TypeScript配置
├── tsconfig.node.json       # Node端TS配置（electron/目录）
└── electron-builder.json    # 打包配置（输出exe）
```

## 四、数据模型

```typescript
// ===== 月计划 =====
interface MonthGoal {
  id: string
  year: number
  month: number          // 1-12
  goals: string[]        // 本月目标列表
}

// ===== 周计划 =====
interface WeekTask {
  id: string
  content: string
  done: boolean
}

interface WeekPlan {
  id: string
  year: number
  weekNumber: number     // 1-52 (ISO周)
  tasks: WeekTask[]
}

// ===== 日计划 =====
interface TimeBlock {
  id: string
  startHour: number      // 0-23
  startMinute: number    // 0 或 30（半小时粒度）
  duration: number       // 分钟，最小30
  title: string
  color: string          // 十六进制色值
}

interface DaySchedule {
  id: string
  date: string           // 格式 'YYYY-MM-DD'
  blocks: TimeBlock[]
}

// ===== 应用设置 =====
interface AppSettings {
  alwaysOnTop: boolean   // 窗口置顶状态
}

// ===== 完整存储结构 =====
interface AppData {
  monthGoals: MonthGoal[]
  weekPlans: WeekPlan[]
  daySchedules: DaySchedule[]
  settings: AppSettings
}
```

### 数据存储规则

- 存储位置：用户目录下 `~/.schedule-management/data.json`
- 格式：单个JSON文件，结构为 `AppData`
- 写入策略：数据变更后防抖500ms写入，避免频繁IO
- 启动时加载到Pinia store，所有操作在内存中进行

## 五、Electron进程通信规范

### 主进程 -> 渲染进程

通过 `preload.ts` 暴露受限API，禁止直接使用 `require('electron')`。

```typescript
// preload.ts 暴露的API
interface ElectronAPI {
  // 窗口控制
  toggleAlwaysOnTop(pinned: boolean): void
  minimizeWindow(): void
  maximizeWindow(): void
  closeWindow(): void

  // 数据持久化
  loadData(): Promise<AppData>
  saveData(data: AppData): Promise<void>
}
```

渲染进程通过 `window.electronAPI` 调用，不直接操作Node模块。

## 六、视图设计规范

### 月计划视图
- 布局：4列 x 3行网格
- 当前月卡片高亮（边框或背景色区分）
- 每个卡片展示：月份标题 + 目标摘要（最多3条可见）
- 交互：点击卡片展开编辑；点击月份标题跳转到该月的周视图

### 周计划视图
- 范围：当前月的4-5个自然周
- 布局：每周一行，展示任务列表（checkbox + 文本）
- 顶部：月份切换器（上月/下月箭头）
- 当前周行高亮
- 交互：点击周标题跳转到该周的日视图

### 日计划视图
- 布局：7列（周一至周日） x 纵向时间轴
- 时间轴：默认展示 6:00-23:00，可滚动查看全部24h
- 时间粒度：30分钟为最小单位
- 顶部：周切换器（上周/下周箭头）
- 交互：点击空白格创建时间块；点击已有时间块编辑/删除

### 视图切换
- 顶部标签栏：月 | 周 | 日
- 支持下钻导航：月 -> 周 -> 日（带面包屑回退）

## 七、窗口配置

| 属性 | 值 | 说明 |
|------|------|------|
| 宽度 | 1000px | 默认窗口宽度 |
| 高度 | 700px | 默认窗口高度 |
| 最小宽度 | 800px | 防止布局错乱 |
| 最小高度 | 600px | |
| 边框 | 无 (frameless) | 自定义标题栏 |
| 置顶 | 可切换 | 通过图钉按钮控制 |
| 背景色 | #ffffff | 纯白背景 |

## 八、命名与编码规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件名 | PascalCase（.vue）/ camelCase（.ts） | `MonthView.vue`, `schedule.ts` |
| 组件名 | PascalCase | `<TitleBar />` |
| 变量/函数 | camelCase | `currentWeek`, `togglePin()` |
| 类型/接口 | PascalCase | `MonthGoal`, `TimeBlock` |
| CSS类名 | kebab-case | `.month-card`, `.time-block` |
| 常量 | UPPER_SNAKE_CASE | `MAX_GOALS_DISPLAY` |

## 九、构建与运行

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建Windows exe
npm run build
# 产物位于 build/ 目录

# 类型检查
npx tsc --noEmit
```

## 十、设计原则

1. **极简优先** - 不引入UI组件库，手写精简CSS，功能够用即可
2. **单文件存储** - JSON文件足以应对个人日程数据量，无需数据库
3. **离线本地** - 不联网、不同步、不登录，纯本地应用
4. **类型安全** - 全项目TypeScript，数据模型接口化
5. **进程隔离** - 主进程与渲染进程严格分离，通过preload桥接
