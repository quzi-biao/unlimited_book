# Flipbook Web 端实现计划

## 背景

Flipbook 目前只有 Android 端（Kotlin/Compose）和一个管理后台（admin-frontend）。本计划在 `/web` 目录下实现一个功能完整的 **Web 用户端**，复用现有后端 API，不涉及任何后端修改。

---

## Android 功能清单 vs Web 实现范围

| 功能模块 | Android | Web 端 | 备注 |
|---------|---------|--------|------|
| 设备注册 / Token 认证 | ✅ | ✅ | 浏览器指纹（FingerprintJS）模拟 fingerprint |
| 主题探索（文生图）| ✅ | ✅ | 输入关键词 → AI 生成图片 |
| 图册书架（书本列表）| ✅ | ✅ | 卡片式列表 |
| 页面树（子图层级）| ✅ | ✅ | 侧边面板 |
| 图片区域框选识别 | ✅ | ✅ | Canvas 鼠标拖拽代替触摸 |
| 深入探索（图生图）| ✅ | ✅ | 基于区域框选结果 |
| 区域解读 / 标注 | ✅ | ✅ | explain-region API |
| 探索点击解释（Spot）| ✅ | ✅ | 点击坐标 → AI 解释弹出 |
| 标注管理（持久化）| ✅ | ✅ | Annotations CRUD |
| 页面解读（长文）| ✅ | ✅ | ExplanationPanel |
| TTS 语音朗读 | ✅ | ✅ | Web Audio 播放 OSS 分段 mp3 |
| 音色选择 | ✅ | ✅ | 设置页 |
| 提示词风格选择 | ✅ | ✅ | 设置页 |
| 话题分类浏览 | ✅ | ✅ | ShelfPanel 话题卡片 |
| 学习点数显示 | ✅ | ✅ | 顶部余额 |
| 套餐购买 / 微信支付 | ✅（App 内）| ✅（扫码）| Web 生成 Native 二维码，手机扫码支付 |
| OTA 升级 | ✅ | ❌ 跳过 | Android 专有 |
| Kiosk / 锁屏模式 | ✅ | ❌ 跳过 | Android 专有 |
| 工厂重置 | ✅ | ✅ | 设置页中保留 |
| 协议查看 | ✅ | ✅ | 首次访问弹出 |

---

## 技术选型

| 层 | 方案 |
|----|------|
| 框架 | Vite + React 19 |
| 路由 | React Router v6 |
| 状态管理 | React Context + hooks（无 Redux）|
| 样式 | Vanilla CSS + CSS Modules（无 Tailwind）|
| 浏览器指纹 | `@fingerprintjs/fingerprintjs` |
| Canvas 交互 | 原生 HTML5 Canvas API |
| 音频 | `<audio>` 标签 + Web Audio API |
| 二维码渲染 | `qrcode` npm 包（canvas 渲染）|
| 包管理 | pnpm |

---

## 目录结构

```
web/
├── index.html
├── vite.config.js
├── package.json
├── .env                       # VITE_API_BASE_URL=http://localhost:3007
├── .gitignore
├── PLAN.md                    ← 本文件
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css              ← 全局设计系统（暗色主题、CSS 变量）
    ├── api/
    │   ├── client.js          ← fetch 封装 + Token 自动注入 + 错误处理
    │   ├── device.js          ← 设备注册 / info / voices / prompt-styles / topic-categories
    │   ├── books.js           ← 书本 CRUD
    │   ├── pages.js           ← 页面 CRUD + explanation
    │   ├── ai.js              ← generate-image / identify-region / expand-region / explain-spot / explain-region / crop-region
    │   ├── tts.js             ← TTS 缓存检查 + 流式合成触发
    │   ├── annotations.js     ← 标注 CRUD
    │   └── payment.js         ← 套餐列表 / 创建订单 / 轮询状态
    ├── contexts/
    │   ├── AuthContext.jsx    ← Token + 设备信息 + 余额
    │   └── FlipbookContext.jsx← 当前书/页全局状态
    ├── hooks/
    │   ├── useFlipbookState.js    ← 主状态机（当前页、选区、标注）
    │   ├── useBooksState.js       ← 书本列表加载
    │   ├── useTtsPlayback.js      ← TTS 分段播放状态机
    │   └── useDeviceInit.js       ← 设备注册 + Token 持久化
    ├── components/
    │   ├── Viewport/              ← 主图片展示 + 标注层 + 框选交互
    │   │   ├── Viewport.jsx
    │   │   ├── Viewport.module.css
    │   │   ├── AnnotationLayer.jsx    ← SVG 标注覆盖层
    │   │   └── SelectionBox.jsx       ← 鼠标框选矩形
    │   ├── ShelfPanel/            ← 左侧书架抽屉
    │   │   ├── ShelfPanel.jsx
    │   │   └── ShelfPanel.module.css
    │   ├── TopicBrowser/          ← 话题分类浏览
    │   │   ├── TopicBrowser.jsx
    │   │   └── TopicBrowser.module.css
    │   ├── PageTreePanel/         ← 右侧页面层级树
    │   │   ├── PageTreePanel.jsx
    │   │   └── PageTreePanel.module.css
    │   ├── ExplanationPanel/      ← 底部 AI 解读面板
    │   │   ├── ExplanationPanel.jsx
    │   │   └── ExplanationPanel.module.css
    │   ├── TtsPlayer/             ← TTS 播放器 UI
    │   │   ├── TtsPlayer.jsx
    │   │   └── TtsPlayer.module.css
    │   ├── ToolBar/               ← 顶部工具栏（搜索 + 操作按钮）
    │   │   ├── ToolBar.jsx
    │   │   └── ToolBar.module.css
    │   ├── SettingsPage/          ← 设置抽屉（音色、风格、重置）
    │   │   ├── SettingsPage.jsx
    │   │   └── SettingsPage.module.css
    │   ├── ShopPage/              ← 套餐购买 + 微信二维码
    │   │   ├── ShopPage.jsx
    │   │   └── ShopPage.module.css
    │   ├── ExploreQueue/          ← 探索任务进度队列
    │   │   ├── ExploreQueue.jsx
    │   │   └── ExploreQueue.module.css
    │   └── common/
    │       ├── LoadingSpinner.jsx
    │       ├── Toast.jsx
    │       └── Modal.jsx
    └── utils/
        ├── fingerprint.js     ← FingerprintJS 封装（返回稳定 visitorId）
        ├── storage.js         ← localStorage token / deviceId 管理
        └── canvas.js          ← 图片坐标归一化工具（像素 ↔ 0~1 比例）
```

---

## 微信扫码支付流程

```
用户点击"充值" → ShopPage 展示套餐列表
  └→ 选择套餐 → POST /api/device/payment/create
      └→ 后端返回 { codeUrl, orderId }
          └→ 前端用 qrcode 库将 codeUrl 渲染成二维码图片
              └→ 用户手机扫码支付
                  └→ 前端轮询 GET /api/device/payment/order/:orderId
                      ├─ status=paid → 关闭弹窗 + 刷新余额
                      └─ 超时 5 分钟 → 提示"二维码已过期，请重新生成"
```

---

## 用户交互主流程

```
冷启动
 └→ useDeviceInit: FingerprintJS → POST /api/device/register → localStorage 存 Token
 └→ 拉取书本列表（若为空 → 引导打开话题浏览）

主界面（单页 SPA，无路由切换）
 ┌─ 左侧抽屉: ShelfPanel（书架列表 + 话题分类）
 ├─ 中央全屏: Viewport（图片 + 透明 Canvas 框选层 + 标注层）
 ├─ 右侧面板: PageTreePanel（页面层级树）
 ├─ 顶部: ToolBar（搜索框 + 书架/解读/朗读/设置/余额按钮）
 └─ 底部浮动: TtsPlayer（音频进度条 + 控制）

核心路径：
  输入关键词 → generate-image → 创建 Book + Page → Viewport 展示
  点击图片   → explain-spot → Callout 弹出
  拖拽框选   → identify-region → 识别结果浮层 → "深入探索"按钮
  深入探索   → expand-region → 新子页 → PageTree 更新
  解读按钮   → GET explanation（懒生成）→ ExplanationPanel 展开
  朗读按钮   → GET tts cache → 已缓存直接播放 / 未缓存触发合成 → 分段播放
```

---

## 设计风格

- **暗色主题**：深宇宙蓝 (`#0a0e1a`) + 星光金 (`#f0c060`) 强调色
- **玻璃拟态面板**：`backdrop-filter: blur(16px)` + 半透明边框
- **图片全屏沉浸**：图片占满中央区域，UI 以叠加方式呈现
- **流畅动画**：面板滑入 `300ms ease`，图片切换淡入
- **字体**：Google Fonts — `Inter`（正文）+ `Noto Serif SC`（科普解读文字）

---

## 部署方式

- **独立部署**：`pnpm run build` 产物为 `web/dist/`，独立于后端服务器
- 开发时：`pnpm run dev`（默认 5175 端口），通过 Vite proxy 转发 `/api` 到 `localhost:3007`
- 生产部署：Nginx 直接 serve `web/dist/`（或上传 OSS + CDN）

---

## 实现阶段

### Phase 1 — 基础设施
- [ ] Vite + React 项目初始化
- [ ] 全局 CSS 设计系统（颜色变量、字体、动画、glassmorphism 工具类）
- [ ] API client（fetch 封装、Token 注入、错误 toast）
- [ ] FingerprintJS 设备注册 + AuthContext

### Phase 2 — 核心功能
- [ ] ToolBar（搜索框 + 按钮组）
- [ ] Viewport（图片展示 + Canvas 框选 + 点击 Callout）
- [ ] ShelfPanel（书架列表 + 话题分类浏览）
- [ ] 文生图完整流程
- [ ] PageTreePanel（层级树导航）

### Phase 3 — 高级功能
- [ ] ExplanationPanel（懒加载 AI 解读）
- [ ] TtsPlayer（OSS 分段音频播放）
- [ ] AnnotationLayer（标注持久化 + 渲染）
- [ ] 深入探索（identify → expand）
- [ ] SettingsPage（音色、风格）
- [ ] ShopPage（套餐 + 微信二维码）

### Phase 4 — 打磨
- [ ] 引导流程（新用户 onboarding）
- [ ] 响应式适配（宽屏 / 窄屏布局切换）
- [ ] 错误边界 + 离线提示
- [ ] 生产构建验证
