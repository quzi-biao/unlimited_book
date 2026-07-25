# Flipbook 项目编码规范

## 文件大小限制（强制）

- **每个代码文件不得超过 500 行**
- 超过 500 行时必须拆分：
  - React 组件 → 抽离子组件到独立文件
  - 工具函数 → 按功能分类到多个 `utils/` 文件
  - 路由文件 → 按资源类型拆分
  - 服务层 → 按职责切分（如 `ai/gemini.js` + `ai/prompts.js`）

## 包管理器

- 统一使用 `pnpm`（不允许 `npm install` 或 `yarn add`）

## 目录结构约定

### 前端 (`src/`)
```
components/
  ComponentName/
    ComponentName.jsx      ← 主组件（< 500 行）
    ComponentName.module.css
    SubPart.jsx            ← 超 500 行时拆出的子组件
contexts/
  AuthContext.jsx
api/
  client.js               ← fetch 封装
  backend.js              ← 后端接口函数
  providers/              ← AI provider 适配层
  shared/                 ← 共享 prompt/工具
```

### 后端 (`server/src/`)
```
routes/       ← 每个资源一个文件（< 500 行）
services/
  ai/         ← AI 相关服务拆到子目录
middleware/
config/
```

## 命名规范
- React 组件：PascalCase
- 函数/变量：camelCase
- CSS Module 类名：camelCase
- API 路由：kebab-case（`/api/books/:id`）
- 数据库字段：camelCase（Prisma convention）

## 注释规范
- 每个函数写 JSDoc 注释（参数、返回值）
- 复杂逻辑写行内中文注释

## 错误处理
- 后端路由统一使用 `try/catch + next(err)` 模式
- 前端 API 调用统一捕获错误并 `toast` 提示

## 环境变量
- 前端：`VITE_` 前缀，保存在 `.env`
- 后端：无前缀，保存在 `server/.env`
- 敏感 key（Gemini API key）只在 `server/.env` 中，不在前端暴露
