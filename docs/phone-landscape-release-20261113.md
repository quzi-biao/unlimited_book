# 手机默认横屏更新（2026-11-13）

## 变更

- 手机版 MainActivity 的方向从 unspecified 改为 sensorLandscape：启动请求横屏，可在左右横屏之间转向。
- 手机版升级为 1.0.142-phone / versionCode 142，包名 com.flipbook.ai.phone。
- 平板版本仍为 1.0.140；没有修改平板 OTA 或服务器程序。
- 沿用 1.0.141-phone 正式签名，支持覆盖更新。

## 产物

- 本地：android/releases/unlimited-book-phone-1.0.142.apk
- 下载：https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.142.apk
- 文件大小：37,214,713 字节。
- APK SHA-256：f71e19570098c746b3f267d4214acc4eb20fd43057d9dd5b9b09cc16ed43b3d5
- 签名证书 SHA-256：ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226
- 验证记录：.local-data/releases/20261113-phone-landscape/verification.json
- 旧版 1.0.141 下载地址保留；Android 降级安装受系统限制，不等同于可无损回退。

## 验证和限制

- Release 打包成功，shared 3 项、phone Release 11 项单元测试通过。
- lintVitalPhoneRelease 通过；APK v2 签名通过，证书与上一正式版一致。
- 已检查 APK 内的 MainActivity manifest：screenOrientation=6（sensorLandscape），非调试包。
- 完整 lintPhoneRelease 未通过：6 项既有错误、69 项警告，未为横屏修改而跳过或删除这些报告。
- 错误包括 DeviceControl 的 Wi-Fi 定位权限及 API 26 调用、localDB 和 useFlipbookTasks 的 java.time 在最低 API 24 上的兼容性；本次未扩展修复范围。
- 当前未连接 Android 设备，因此尚未实测启动横屏、左右翻转和键盘布局。
- 完整静态检查报告：.local-data/releases/20261113-phone-landscape/lint-results-phoneRelease.txt
