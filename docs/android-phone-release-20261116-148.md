# Android 手机版 1.0.148（2026-11-16）

## 包信息

- 版本：`1.0.148-phone`，versionCode：148。
- 包名：`com.flipbook.ai.phone`，Android 7.0 / API 24 及以上。
- API：`https://www.wenyi-tech.cn`。
- 文件：`android/releases/unlimited-book-phone-1.0.148.apk`。
- 大小：37,247,485 字节。
- SHA256：`1bf3834935a5634efe2b041d5a09935a2b4cc71624260b2b35c3c8c227aa5875`。
- 签名证书 SHA256：`ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226`。
- 公网下载：`https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.148.apk`。

## 内容

继续默认横屏。搜索和朗读整体宽度随实际图片显示宽度调整为 60%，左右各留 20%，保留分开的顶部控件和底部悬浮控件。
按需生图和 16:9 画幅由已上线后端控制；APK 连接正式服务，书页图片不打入安装包。
本次仅更新手机版版本，不改变平板/专用硬件 1.0.140 OTA，不修改线上用户图书或余额。

## 验证

- assemblePhoneRelease、lintVitalPhoneRelease 通过。
- shared 单元测试 3 项、PhoneRelease 11 项、TabletDebug 11 项，全部通过。
- APK v2 签名验证、16KB 页对齐检查通过。
- 签名与 1.0.147 一致、包名一致、versionCode 递增，支持覆盖更新。
- 编译产物核对：正式 API 域名、非 debuggable、sensorLandscape 横屏、60% 控件宽度均正确。
- 当前 ADB 没有连接设备，未进行本轮真机安装和触控/音频验收。
- 生成失败时仍可能受到 OpenLux 上游繁忙影响；本包不改变 AI 供应商容量。

## 发布记录

本地记录：`.local-data/releases/20261116-android-148`，包含构建日志、签名、manifest、字节码核验和 verification.json。
公网暂存：`14.103.42.128:/var/backups/unlimited-book/20261116-android-148/staging`。
发布到 `/var/www/wenyi-tech.cn/downloads/unlimited-book/`，校验后原子重命名，原 147 下载保留。
下载完成后可在 verification-public.json 核对公网完整下载 SHA256。
