# 2026-11-13 手机版本上线记录

## 后端部署

- 服务器：`ubuntu@10.138.10.122`，项目目录 `/home/ubuntu/flipbook`。
- 发布镜像：`flipbook:phone-20261113`；Compose 的 `flipbook` 服务已固定该镜像。
- 公网 API：`https://www.wenyi-tech.cn/api`。
- 发布目录：`/home/ubuntu/flipbook/releases/20261113-phone`，含源码归档、SHA-256 清单、运行时 Dockerfile 和出口代理适配。
- 备份目录：`/home/ubuntu/flipbook/backups/20261113-phone`，包含部署前容器配置、环境配置、源码及 PostgreSQL 自定义格式备份。

本次发布的依赖清单、锁文件及 Prisma schema 与旧线上版本完全一致，因此复用旧运行时镜像安装的依赖，只覆盖后端源码与脚本。新镜像直接启动 Node 服务，保留线上已有出口代理，不执行数据库迁移或 seed。生产环境变量与旧容器逐项比较一致。后台静态资源、Nginx 管理后台配置及现有网页端由用户另行处理。

候选实例完成设备注册、设备信息、钱包、书架、音色、提示词风格、话题分类、套餐、随机话题、心跳及一次实际 AI 标题生成验证。验证设备使用独立指纹，完成后删除测试设备及其级联钱包、会话数据。后端源码哈希已与本地发布清单逐项比对。

切换后通过公网 HTTPS 再次完成上述接口验证，并实际读取一张现有线上图片完成 JPEG 压缩验证。临时候选容器已移除，正式容器为 healthy。

回滚只恢复应用镜像、Compose 和服务端源码，不还原业务数据库：

```bash
sh /home/ubuntu/flipbook/backups/20261113-phone/rollback.sh
```

数据库备份已用 `pg_restore --list` 验证可读取；未做数据库恢复演练。

## Android 手机包

- 版本：`1.0.141-phone`（versionCode 141）。
- 包名：`com.flipbook.ai.phone`，Android 7.0 / API 24 及以上。
- API：`https://www.wenyi-tech.cn`，使用系统信任的 HTTPS 证书。
- 构建入口：`./android/build-phone-release.sh`，使用本机 SDK，无需 Docker。
- 签名：手机独立 Release 密钥；配置及密钥位置见 `docs/android-cmp-migration.md`。
- 本地交付副本：`android/releases/unlimited-book-phone-1.0.141.apk`，37,231,101 字节（约 35.5 MiB）。
- 公网下载：`https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.141.apk`。
- 公网文件：`14.103.42.128:/var/www/wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.141.apk`，上传后已核对远端 SHA-256。
- APK SHA-256：`1619137517bd94311a00151b84d90e202671a27cf7e355e85586dce75bfbf435`。
- 签名证书 SHA-256：`ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226`。

验证：共享模块 3 项测试、手机 Release 11 项测试通过，Release Lint 检查通过；`apksigner` 验证 APK v2 签名通过。APK 包名、版本、最低系统版本、非调试属性及手机权限已核对；DEX 中已确认使用公网域名服务地址。

手机使用单独下载链接，不写入平板 OTA 版本表。当前没有连接 Android 真机，构建与接口验证不替代界面、触摸、音频和横竖屏的真机验收。
