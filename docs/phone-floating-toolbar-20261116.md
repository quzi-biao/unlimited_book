# 手机悬浮阅读栏（2026-11-16）

## 问题与行为

1.0.143-phone 为底部阅读栏预留了 68dp。用户手机截图确认，这会压缩等比显示的图片高度，放大左右留白；点击图片切换工具栏时，图片还会随着可用空间改变大小。

1.0.144-phone 将图片画布固定为完整可用区域，阅读栏改为覆盖在图片上的悬浮层。点击图片显示或隐藏阅读栏时，画布大小、图片位置及热点坐标保持一致。

- 移除 AppScreen 中依赖 toolbarUserHidden 的底部 padding。
- 阅读栏改为圆角半透明背景，与屏幕左右各保持 12dp、底部保持 10dp 间距，栏体高 64dp。
- 朗读按钮对齐悬浮栏，展开的播放控件放在悬浮栏上方。
- 继续保留探索输入、草稿和键盘交互。
- 图片仍按原比例完整显示。解除底栏占位后可显示得更大，但图片比例比手机横屏窄时，左右仍会留边；没有通过裁切或拉伸消除留白。
- 平板版本仍为 1.0.140，沿用原有工具栏、签名和 OTA 通道。

## 产物

- 版本：1.0.144-phone / versionCode 144 / com.flipbook.ai.phone。
- 本地：android/releases/unlimited-book-phone-1.0.144.apk。
- 下载：https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.144.apk。
- 文件大小：37,231,101 字节。
- APK SHA-256：9d43b74ab90aaae80e66e5982afc8093b559c9fb677320fdf6e1e318498022a2。
- 签名证书 SHA-256：ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226，与上一版一致，可覆盖更新。
- 保留 1.0.143 下载文件，不修改后端或平板 OTA。

## 验证与限制

- assemblePhoneRelease、lintVitalPhoneRelease、compileTabletDebugKotlin 成功。
- 现有 shared 3 项、phone Release 11 项、tablet Debug 11 项单元测试通过。
- APK 非调试包，签名有效，默认横屏，包含公网生产 API 地址。
- 对照修改前源码检查，本次仅调整手机底栏布局和图片占位，图片缩放及热点映射算法保持不变。
- 构建日志、修改前源码、签名、Manifest 和发布校验记录位于 .local-data/releases/20261116-phone-floating/。下载验证以 verification.json 的 public_download_verified 为准。
- 未连接真机；单元测试不覆盖 Compose 渲染，需在手机确认反复显示/隐藏底栏时图片不缩放、不位移，热点可点击，探索输入及朗读可用。
- 本次未运行完整 lintPhoneRelease；已知完整 lint 结果见上一版记录，不将 lintVital 通过等同于完整 lint 通过。
