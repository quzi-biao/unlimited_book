# 无限之书

产品方向参考：[2026-11-19 收录的企划书备忘](docs/product-memory.md)（含原文归档与历史规划差异；规划不等于已实现能力）。

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
| Android 客户端 | `android/` | Kotlin、Compose Multiplatform 共享组件、Android Compose、Retrofit | - |
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

本地构建可以直接使用已安装的工具链，无需 Docker。在仓库根目录运行：

```bash
./android/build-local.sh
```

脚本默认运行共享模块、手机与平板变体的单元测试，并生成两种调试包；优先使用 `JAVA_HOME`，
未设置时尝试 macOS 注册的 JDK 17 或 HBuilderX 自带的 JDK。
SDK 使用 `android/local.properties` 中的 `sdk.dir`，也支持 `ANDROID_HOME` /
`ANDROID_SDK_ROOT`。本机复用的 SDK 位于
`/Users/ai/Library/Developer/chinapay-build-tools/sdk`，包含 Android SDK 36 和 Build Tools 35.0.0。
`local.properties` 是本机配置，已被 Git 忽略；其他机器需填写自己的 SDK 路径。

默认沿用客户端已配置的 API 地址，可通过参数覆盖：

```bash
./android/build-local.sh :app:assemblePhoneDebug -PAPI_BASE_URL=https://your-api.example.com
```

编译不需要后端在线；实际使用时，设备必须能够访问该地址。单元测试报告位于
`android/app/build/reports/tests/testPhoneDebugUnitTest/index.html` 等变体目录。
手机和原平板使用独立构建变体，可同时安装。CMP 已迁入工具栏、朗读控制和选区等共享组件，
业务页面与平台服务仍在逐步迁移；iOS 应用尚未完成。详细范围见 [安卓与 CMP 迁移说明](docs/android-cmp-migration.md)。

模拟器通过 `10.0.2.2` 访问宿主机：

```bash
cd android
./gradlew :app:assemblePhoneDebug -PAPI_BASE_URL=http://10.0.2.2:3007
```

手机 APK：`android/app/build/outputs/apk/phone/debug/app-phone-debug.apk`；
平板 APK：`android/app/build/outputs/apk/tablet/debug/app-tablet-debug.apk`。
仅打包手机可运行 `./android/build-local.sh :app:assemblePhoneDebug`。
真机调试时请将 `API_BASE_URL` 换成设备可访问的 HTTPS 地址或局域网地址。

### 4. 启动 Web 原型（可选）

```bash
cd web
pnpm install
pnpm dev
```

Web 原型保留用于历史功能参考，当前主产品入口是 Android 原生客户端。
开发代理默认连接本地 Docker API `http://localhost:8888`。如果使用前文的本地 Node API，
请运行 `VITE_API_TARGET=http://localhost:3007 pnpm dev`。

### 本地内容副本

2026-11-12 已从现有后端只读复制内容到本机 Docker 数据库：130 本书、419 页、
566 条标注、204 条已有页面跳转，并包含话题、解读和已缓存的语音。
图片与语音共 4,528 个文件（约 2.68 GB），存放于 `.local-data/media/`，
本地 Compose 以只读卷挂载，由 `/api/local-assets/` 提供访问。
未设置 `LOCAL_ASSET_DIR` 的部署不会启用此静态资源入口。

在 `http://localhost:5175/` 点击左下角「书架」查看内容。本地 Compose 启用
`VITE_LOCAL_SHARED_READER=true`，各浏览器在 localhost 共用 `flipbook-local-shared-reader`
这一阅读身份，首次打开或刷新后可访问同一书架。该设置仅在 Vite 开发模式且通过本机
回环地址访问时生效；正常构建仍使用浏览器指纹。关闭此开关可恢复按浏览器隔离。
原始导出、导入前本地数据库备份及校验报告位于
`.local-data/production-copy-20261112/`，该目录已排除 Git 和 Docker 构建上下文。
导入只包含内容与相关展示配置，不复制线上账号、订单、支付配置或 API 密钥。
已有图册和跳转可以本地浏览；生成新内容仍需配置对应 AI 服务。
本地 Compose 将新生成的图片和音频保存到 `.local-data/uploads/`，通过
`/api/local-uploads/` 访问，无需配置 OSS；导入的 `.local-data/media/` 仍保持只读。
框选、看图解读和图片标题同时支持这两类本地相对路径。未配置
`LOCAL_UPLOAD_DIR` 的部署仍使用原有 OSS 上传流程。

## Docker 部署

### 本地一键启动（自带 PostgreSQL）

```bash
cp .env.example .env
# 编辑 .env，分别设置 POSTGRES_PASSWORD、JWT_SECRET 和 ADMIN_PASSWORD
# POSTGRES_PASSWORD 使用 URL 安全字符，例如 openssl rand -hex 24 的输出
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
```

后台地址：`http://localhost:8888/admin`，API 健康检查：`http://localhost:8888/api/health`。
管理员账号由 `.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 指定，默认用户名为 `admin`。
已有管理员不会因修改 `.env` 自动重置密码。

本地配置创建独立数据库，数据保存在 Docker 命名卷中；数据库不映射宿主机端口，
应用只监听本机 `127.0.0.1`。容器内的 `DATABASE_URL` 由本地 Compose 自动配置。
停止服务用 `docker compose -f docker-compose.local.yml down`，不要加 `-v`，以免删除数据库。
更新 `.env` 后重新执行启动命令即可重建容器并加载配置。

首次启动自动建立数据库表、管理员、默认套餐、全局配置和默认提示词风格。
仓库未包含百科话题种子数据，需要在后台添加话题与分类；协议内容也需要配置。
基础后台和 API 可在未配置外部服务的情况下运行，完整功能还需要：

- 图文生成与局部解读：`GPTIMAGE_API_KEY`、`GPTIMAGE_BASE_URL`。当前文字和视觉解读也使用该服务。OpenLux 接口地址填 `https://api.openlux.ai`（不加 `/v1`，代码会追加）；密钥使用 OpenLux 控制台的 API 令牌。`GPTIMAGE_TEXT_MODEL` 默认 `gpt-4.1-mini`，用于文字标题和看图解读；图片生成继续使用 `gpt-image-2`，密钥需有这两个模型的调用权限。
- 图片、音频及 APK 存储：`OSS_ENDPOINT`、`OSS_KEY_ID`、`OSS_KEY_SECRET`、`OSS_BUCKET`。
- 语音合成和音色同步：`MINIMAX_API_KEY`。
- 微信云端内容检测：`WX_MINI_APPID`、`WX_MINI_SECRET`。
- 真实支付：微信商户配置、回调地址及证书；本地 Compose 默认不挂载证书。

主 Docker 镜像包含 API 和管理后台；Android 客户端与静态官网独立运行。
浏览器阅读端也可通过可选 Docker 服务启动：

```bash
docker compose -f docker-compose.local.yml up -d --build web
```

访问 `http://localhost:5175`，该服务自动代理到本地 API，并通过设备注册进入阅读界面，
无需管理员账号。Web 服务以 Vite 开发模式运行，仅用于本地体验和开发。

### 外部数据库部署

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

用户于 2026-11-19 提供的产品企划（原文署期 2026-08-26）已整理为[产品企划记录](docs/product-planning-context.md)，涵盖单版本全龄、账号知识库、分形阅读、生成装配与监护人边界。该记录用于后续产品讨论，规划内容不代表现有实现状态。

本仓库暂未声明开源许可证，未经许可请勿将代码用于再分发或商业用途。
