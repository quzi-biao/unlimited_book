# 安卓手机包与 CMP 迁移

## 当前交付范围

Android 工程包含 `app` 与 `shared` 两个模块。`shared` 使用 Kotlin Multiplatform 2.1.21 和 Compose Multiplatform 1.8.2，Android 应用直接调用其中的组件。此次为第一阶段迁移，并非整套应用已经能直接编译成 iOS 应用。

已经共享的部分：

- 工具栏、话题输入、朗读控制条、通用按钮和呼吸动画。
- 区域选框、标注点、选区高亮与解读状态控件。
- 现有各界面的颜色和样式常量。
- 引导状态控制、标注分组、弹窗定位、目录展开与路径查找算法。

仍在 Android 层的部分：入口 Activity、主页面编排、书架等业务页面、Retrofit/Gson 网络层、SharedPreferences/数据库、Coil 图片加载、音频播放、设备注册、系统控制和 OTA。引导完成状态通过回调注入共享逻辑，实际存储留在 Android 层。

后续 iOS 工作需要继续迁移这些业务页面和数据层，实现 iOS 存储、图片、音频等适配，并创建 Xcode 应用入口与签名配置。共享模块预留 `-PenableIos=true` 来启用 `iosArm64` / `iosSimulatorArm64`；当前 Android 构建不需要安装或启动 Xcode。该开关本身不代表已有可安装的 iOS 应用。

## 两个 Android 构建变体

| 变体 | 包名 | 用途 |
| --- | --- | --- |
| `tablet` | `com.flipbook.ai` | 原有专用平板，横屏、锁定模式、开机自启和原 OTA 通道 |
| `phone` | `com.flipbook.ai.phone` | 普通安卓手机，默认横屏（支持左右横屏）、沉浸阅读、系统返回、刘海避让、单行阅读栏 |

两者可以在同一设备并存。手机包不声明设备管理员、无障碍自启组件及安装升级权限，不使用平板 OTA 通道，防止下载错误包。手机网络设置交给系统面板，亮度只调整当前阅读窗口。

手机宽度小于 720dp 时，书架的书本与话题列表在同一面板切换，目录单独打开；讲解、队列和离线提示使用适合窄屏的宽度。局部解读采用居中弹窗，朗读展开条放到工具栏上方。平板保留原有界面结构、颜色和交互。

从 1.0.144-phone 开始，手机版在所有宽度下使用单行半透明悬浮阅读栏，栏体高 64dp，距底部 10dp。图片始终使用完整可用高度，不为底栏预留空间；点击图片显示或隐藏底栏都不改变图片尺寸、位置及热点坐标。话题输入由“探索”按钮展开，关闭保留草稿、成功提交才清空。系统栏默认隐藏，可用边缘手势临时唤出，刘海区域继续避让。图片保持原始比例，不强行裁切填满超宽屏。

支付仍沿用现有二维码流程，尚未接入手机微信 App 支付。手机独立升级通道与商店上架尚未接入。手机正式签名及公网 Release 构建已补充，见下文。

## 本地构建

本机 SDK：`/Users/ai/Library/Developer/chinapay-build-tools/sdk`，通过忽略提交的 `android/local.properties` 配置。使用 JDK 17、Android SDK 36 / Build Tools 35.0.0，无需 Docker。

```bash
# 共享模块测试、两种变体测试和调试包
./android/build-local.sh

# 只构建手机调试包
./android/build-local.sh :app:assemblePhoneDebug

# 只构建平板调试包
./android/build-local.sh :app:assembleTabletDebug

# 如需覆盖服务地址
./android/build-local.sh :app:assemblePhoneDebug -PAPI_BASE_URL=https://your-api.example.com
```

产物：

- `android/app/build/outputs/apk/phone/debug/app-phone-debug.apk`
- `android/app/build/outputs/apk/tablet/debug/app-tablet-debug.apk`

默认沿用现有服务地址。这些是开发调试签名的 APK，不用于覆盖已经使用其他证书签名的应用。`setup-kiosk.sh` 仅用于平板，不应对手机包执行。

## 手机线上 Release 包

```bash
./android/build-phone-release.sh
```

此入口使用本机 JDK / SDK，默认 API 为 `https://www.wenyi-tech.cn`，产物位于 `android/app/build/outputs/apk/phone/release/app-phone-release.apk`。手机版本为 `1.0.144-phone`（versionCode 144），包名仍为 `com.flipbook.ai.phone`；入口配置为 `sensorLandscape`，启动即请求横屏并支持左右横屏。平板版本与签名配置沿用原设置。

签名配置读取 `android/phone-signing.properties`，示例为 `android/phone-signing.properties.example`。当前密钥保存在本机 `/Users/ai/.android/keystores/unlimited-book-phone-release.jks`，配置文件与密钥权限均为 `0600`，已排除 Git 提交。后续更新必须复用这套密钥并增加 versionCode；不要重新生成密钥。首次安装正式版前，如已安装同包名调试版，需要先卸载调试版，卸载会清除其本地数据。

正式包不启用调试，不通过平板 OTA 发布。发布与回滚记录见 `docs/production-release-20261113.md`，横屏更新记录见 `docs/phone-landscape-release-20261113.md`，手机阅读布局记录见 `docs/phone-reading-layout-20261116.md`，悬浮阅读栏更新见 `docs/phone-floating-toolbar-20261116.md`。

测试报告：`android/shared/build/reports/tests/testDebugUnitTest/`、`android/app/build/reports/tests/testPhoneDebugUnitTest/`、`android/app/build/reports/tests/testTabletDebugUnitTest/`。

## 真机验收

连接手机后，可执行 `adb install -r android/app/build/outputs/apk/phone/debug/app-phone-debug.apk`。需验证首次启动、书架与目录、话题输入及键盘、框选和点选、图文生成、朗读、网络切换、横竖屏切换及返回键。平板需回归原有阅读和升级流程。未连接设备时，编译和单元测试不能替代这些显示与交互检查。
