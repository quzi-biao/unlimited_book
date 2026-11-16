# 服务器与部署记录

检查时间：2026-11-13 17:52–17:56（Asia/Shanghai）。本次仅远程读取系统、容器、网络与配置，未部署、重启或修改远端服务。此文件不保存密码、令牌或完整连接密钥。

## 地址与用途

| 地址 | 登录方式 | 已确认用途 |
| --- | --- | --- |
| `14.103.42.128:22` | SSH，用户 `root` | 公网入口；Nginx 承载 `www.wenyi-tech.cn`、项目网页静态资源和 API 转发，也运行其他业务容器 |
| `http://101.34.87.172:3443/` | ztncui，用户 `admin` | ZeroTier 控制面板；同 IP 的 `8888` 端口也是当前 Android 配置的公网 API 地址 |
| `10.138.10.122:22` | ZeroTier 内 SSH，用户 `ubuntu` | 无限之书项目应用及数据库服务器 |

## 公网入口服务器

- 主机名：`unlimitedBook`；CentOS Linux 8。
- 4 个逻辑 CPU，约 8 GB 内存；根文件系统约 99 GB，使用率 19%。
- ZeroTier 节点：`e9f502b22c`，网络地址 `10.138.10.128/24`，状态 ONLINE / OK。
- Nginx 配置检查通过；主配置 `/etc/nginx/conf.d/wenyi-tech.cn.conf`。
- `flipbook_backend` 上游为 `101.34.87.172:8888`；`/api/` 和 `/api/ai/` 转发到该上游的 HTTPS 服务，现有配置关闭了上游证书验证。
- 网站静态文件根目录：`/var/www/wenyi-tech.cn`。
- 同机还运行 `dn-map`、`minyou-education-app`、`minyou-education-mysql`、`chinapay-emergency-assistance`，后续部署需注意共享服务器这一事实。

## ZeroTier 网络

- 管理程序 ztncui，控制器显示 ZeroTier 1.14.1，控制器地址 `4c31cbb5f1`。
- 私有网络名称 `Tend`，网络 ID `4c31cbb5f14b77cb`。
- 分配网段 `10.138.10.0/24`，地址池 `10.138.10.1`–`10.138.10.254`。
- 检查时 18 个成员，9 个显示 ONLINE、9 个显示 OFFLINE；这是控制器观察到的瞬时状态。
- 项目服务器成员名称「国光ubuntu」，节点 `3a10b5671c`，地址 `10.138.10.122`，ONLINE（v1.16.2）。
- 公网入口成员名称「闻一科技」，节点 `e9f502b22c`，地址 `10.138.10.128`，ONLINE（v1.16.2）。
- 另有 `192.168.100.0/24` 经 `10.138.10.1` 的托管路由。
- 本次只检查了该主机的 Web 控制面板和公网 API 响应，未登录其操作系统；未读取 `101.34.87.172:8888` 到内网服务器的转发配置。

## 项目服务器

- 主机名 `ubuntu-Default-string`；Ubuntu 24.04.4 LTS。
- 36 个逻辑 CPU，约 64 GB 内存；检查时可用内存约 43 GB。根文件系统约 466 GB，使用率 34%。
- 项目目录 `/home/ubuntu/flipbook`，Compose 配置 `/home/ubuntu/flipbook/docker-compose.yml`。
- 网页端目录 `/home/ubuntu/flipbook-web`，Compose 配置 `/home/ubuntu/flipbook-web/docker-compose.yml`。

| 容器 | 镜像 | 已确认端口和状态 |
| --- | --- | --- |
| `flipbook` | `flipbook:latest` | 宿主机 `8888` → 容器 `8888`；healthy，重启次数 0 |
| `flipbook-web` | `flipbook-web:latest` | 宿主机 `8890` → 容器 `80`；healthy，重启次数 0 |
| `flipbook-pg` | `postgres:16` | 宿主机 `5432` → 容器 `5432`；`pg_isready` 接受连接 |
| `unlimited-book-pg` | `postgres:16` | 宿主机 `127.0.0.1:5434` → 容器 `5432`；`pg_isready` 接受连接 |

当前 `flipbook` 容器数据库配置指向 `10.138.10.122:5432/flipbook`，没有指向 `5434`。检查只输出数据库主机、端口和库名，未记录认证字段。

数据库卷：`flipbook-pgdata`、`unlimited-book-pg-data`。应用证书挂载：`/home/ubuntu/flipbook/certs` → `/app/certs`。服务器同时运行其他项目服务，不应将整台机器当作无限之书独占环境。

## 可访问性与发现

| 检查目标 | 结果 |
| --- | --- |
| `http://10.138.10.122:8888/api/health` | 返回 `status: ok`，从本机和公网入口服务器访问均通过 |
| `https://101.34.87.172:8888/api/health` | 默认 TLS 验证失败，提示自签名证书；仅在诊断请求忽略验证后返回 `status: ok` |
| `https://www.wenyi-tech.cn/api/health` | 默认 TLS 验证通过，返回 `status: ok` |
| `https://www.wenyi-tech.cn/app/` | HTTP 200 |
| `https://www.wenyi-tech.cn/admin/` | HEAD 和 GET 均为 HTTP 500 |
| 项目服务器本地 `http://127.0.0.1:8890/` | HTTP 200 |
| 项目服务器本地 `http://127.0.0.1:8888/admin/` | HTTP 404，不能视为当前管理后台入口 |

公网后台 500 的原因已确认：Nginx `/admin` 配置使用 `alias /var/www/wenyi-tech.cn/admin`，但该目录和 `index.html` 都不存在。`try_files` 回退到 `/admin/index.html` 后产生循环重定向，错误日志明确记录了 `rewrite or internal redirection cycle`。后续应恢复正确的后台构建产物并核对静态文件路由。

其他观察：

- 公网 CentOS 服务器 `dnf-makecache.service` 状态 failed，Result 为 `core-dump`、退出状态 6。CentOS Linux 8 已结束常规维护。
- Ubuntu 服务器 `redsocks.service` 状态 failed，Result 为 `exit-code`；本次未进一步诊断其用途和失败原因。
- IP API 接口的自签名证书是已观察到的证书验证问题。后续正式客户端服务地址应单独核对证书信任与域名配置。

健康检查、容器状态和静态页面返回码不等于完整业务验收。本次未测试付费、AI 生成、语音播放或 OTA 更新。
