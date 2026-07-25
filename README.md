# 无限之书

一本可以无限展开的 AI 百科书。孩子可以从一个话题出发，生成图文百科页面，并通过点击、框选和追问继续探索，逐步形成自己的知识树。

> 当前项目面向 Android 专用终端，包含原生客户端、业务 API、运营管理后台，以及仍保留在仓库中的 Web 原型和产品官网。

## 主要能力

- AI 百科页面生成与书架沉淀
- 点击、框选解读和子页面探索
- 页面讲解与 Minimax 语音合成
- 设备注册、心跳、版本升级和内容配置
- 学习点数、套餐、订单与微信支付
- 渠道、结算、工单和经营数据管理
- 提示词风格、话题分类、音色与协议管理

## 技术架构

| 模块 | 目录 | 技术栈 | 默认端口 |
| --- | --- | --- | --- |
| Android 客户端 | `android/` | Kotlin、Jetpack Compose、Retrofit | - |
| API 服务 | `server/` | Node.js、Express、Prisma、PostgreSQL | `3007` |
| 管理后台 | `admin-frontend/` | React、Vite、Ant Design | `5174` |
| Web 原型 | `web/` | React、Vite | `5175` |
| 产品官网 | `website/` | HTML、CSS、JavaScript | - |

生产镜像会构建管理后台，并由 Express 在 `/admin` 提供静态页面；API 统一位于 `/api`。

## 环境要求

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+
- JDK 17
- Android SDK 36（构建 Android 客户端时需要）
- Docker 与 Docker Compose（可选）

## 本地开发

### 1. 启动 API 服务

```bash
cp .env.example server/.env
cd server
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed:admin
pnpm dev
```

首次初始化必须在 `server/.env` 中设置强管理员密码 `ADMIN_PASSWORD`。基础接口启动后可访问：

- 健康检查：`http://localhost:3007/api/health`
- 服务信息：`http://localhost:3007/`

AI 生成、对象存储、TTS 和微信支付属于可选集成；使用对应功能前，请在 `server/.env` 中补齐相关变量。所有可用变量见 [`.env.example`](.env.example)。

### 2. 启动管理后台

```bash
cd admin-frontend
pnpm install
VITE_API_TARGET=http://localhost:3007 pnpm dev
```

访问 `http://localhost:5174/admin`。

### 3. 构建 Android 客户端

模拟器通过 `10.0.2.2` 访问宿主机：

```bash
cd android
./gradlew assembleDebug -PAPI_BASE_URL=http://10.0.2.2:3007
```

APK 输出到 `android/app/build/outputs/apk/debug/app-debug.apk`。真机调试时请将 `API_BASE_URL` 换成设备可访问的 HTTPS 地址或局域网地址。

### 4. 启动 Web 原型（可选）

```bash
cd web
pnpm install
pnpm dev
```

Web 原型保留用于历史功能参考，当前主产品入口是 Android 原生客户端。

## Docker 部署

Docker Compose 需要一个可访问的 PostgreSQL 实例：

```bash
cp .env.example .env
# 编辑 .env，至少设置 DATABASE_URL、JWT_SECRET 和 ADMIN_PASSWORD
docker compose up -d --build
curl http://localhost:8888/api/health
```

微信支付证书默认从宿主机 `/home/ubuntu/flipbook/certs` 只读挂载到容器 `/app/certs`，请按部署环境调整 `docker-compose.yml` 的卷路径。

## 常用命令

```bash
# API 数据库
cd server
pnpm db:generate       # 生成 Prisma Client
pnpm db:push           # 同步 schema（本地开发）
pnpm db:migrate        # 创建开发迁移
pnpm db:seed:admin     # 初始化管理员、套餐和全局配置

# 前端检查与构建
cd admin-frontend
pnpm lint
pnpm build

# Android
cd android
./gradlew test
./gradlew assembleDebug
```

## 目录说明

```text
.
├── android/            # 原生 Android 客户端
├── server/             # API、Prisma 数据模型与部署脚本
├── admin-frontend/     # 运营管理后台
├── web/                # 历史 Web 阅读端
├── website/            # 静态产品官网
├── docs/               # 产品、渠道和迁移文档
├── docker-compose.yml
└── Dockerfile
```

## 安全说明

- 不要提交 `.env`、支付证书、私钥或云服务密钥。
- 生产环境必须使用高强度 `JWT_SECRET` 和 `ADMIN_PASSWORD`。
- 首次登录后台后应立即确认管理员账号配置，并限制管理端的公网访问范围。
- AI 生成内容、未成年人数据和支付功能上线前，应完成对应的内容安全、隐私与支付合规检查。

## 项目状态

项目处于持续开发阶段，当前用于封闭测试和产品验证。商业化规划与详细产品背景见 [`docs/project-plan.md`](docs/project-plan.md)。

本仓库暂未声明开源许可证，未经许可请勿将代码用于再分发或商业用途。
