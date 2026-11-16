# 手机横屏阅读布局（2026-11-16）

## 触发问题

用户手机截图显示，1.0.142-phone 虽然默认横屏，但顶部状态栏和侧面导航栏仍占用空间，原工具栏按窄屏排成两行，持续显示的大输入框遮住图片下半部分。

## 修改

- 手机入口启用沉浸模式，系统状态栏和导航栏默认隐藏；保留系统返回及临时唤出系统栏的边缘手势，不启用专用硬件的锁定策略。安全区域改为刘海避让。
- 手机工具栏独立为单行深色阅读栏，高度 68dp，包含主题列表、书名、页名、探索入口及朗读按钮。标题过长省略，按钮保持 48dp 点击区域。
- 点击“探索”后在同一行展开输入并请求键盘；关闭时保留草稿，成功入队后才清空输入。输入期间隐藏朗读按钮，失去焦点或收起键盘后恢复阅读栏。
- 正常阅读时，图片画布为底栏预留 68dp，避免被常驻控件遮挡。主动点击图片收起底栏时释放空间，点选热点及框选时临时隐藏底栏不改变坐标空间。
- 朗读圆形按钮与底栏对齐，播放展开条位于底栏上方。平板继续使用原工具栏和系统策略。
- 图片继续等比显示；超宽手机与图片比例不同，左右可能保留空白，不裁切图片文字或热点来填满屏幕。

## 版本和产物

- 手机版：1.0.143-phone / versionCode 143 / com.flipbook.ai.phone。
- 本地包：android/releases/unlimited-book-phone-1.0.143.apk。
- 公网文件：https://www.wenyi-tech.cn/downloads/unlimited-book/unlimited-book-phone-1.0.143.apk。
- 文件大小：37,231,097 字节。
- APK SHA-256：b2b01de85755094bcebdaa832c15a05d710ea2168cf550fa7321bc4ac58304bb。
- 签名证书 SHA-256：ce0783da862ffe8dd3e573e06a52a29cbf24a42b8e302cd4021b4b3839980226，与 1.0.142-phone 一致。
- 使用同一手机正式签名，支持覆盖更新；平板仍为 1.0.140，不更新平板 OTA，不修改后端。

## 验证

- assemblePhoneRelease 与 lintVitalPhoneRelease 成功。
- shared 3 项、phone Release 11 项单元测试通过。
- 平板 compileTabletDebugKotlin 成功、11 项单元测试通过，验证共享组件变更可用于平板构建。
- APK 签名验证通过，非调试包；打包后的 MainActivity screenOrientation=6（sensorLandscape），生产 API 地址存在。
- 构建日志、签名、Manifest 和校验记录位于 .local-data/releases/20261116-phone-reading/。公网发布是否通过以 verification.json 中 public_download_verified 为准。
- 本次未重新运行完整 lintPhoneRelease；1.0.142 记录的既有完整 lint 错误不由本次基础检查覆盖。

## 真机待确认

当前没有已连接的 Android 设备，未做真机显示验收；现有单元测试不覆盖 Compose 渲染、软键盘或手势。需要用手机确认首次启动隐藏系统栏、左右横屏、刘海避让、点击展开输入与收起键盘、草稿保留和提交、热点跳转、框选、目录及朗读。系统栏临时唤出与输入法行为可能随手机系统不同。

旧版 1.0.142 下载文件保留；Android 版本降级受系统限制，不代表可以直接无损降级安装。
