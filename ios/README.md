# 无限之书 iOS 测试版

正式 Xcode 工程：`UnlimitedBook.xcodeproj`，Scheme：`UnlimitedBook`。
Bundle ID：`cn.wenyi.unlimitedbook`；开发团队：`W72VRR6V9W`。
首版为 1.0.0 (1)，最低 iOS 17，支持 iPhone/iPad，默认横屏。

这是 UIKit + WKWebView 的全屏阅读器，加载 `https://www.wenyi-tech.cn/app/`。
不会打包书页图片，不依赖本机 localhost。网页更新重新打开即可加载；原生功能修改需要新包。

每次安装在 UserDefaults 保存随机 UUID，并且仅向正式域名主页面注入安装标识。
网页版普通浏览器仍沿用原指纹识别；此包不使用本机预览共用账户，也不内置接口密钥。
安装标识不是账号恢复机制；删除应用、清除数据或换设备可能产生新身份。

已包含隐私清单、图标、网络重试、JavaScript 确认弹窗、安全区域和横屏配置。
本地模拟器预览另见 `../ios-preview`，与本工程的安装标识及数据独立。

构建：`BUILD_NUMBER=2 sh ios/build-testflight.sh`。
上传：`BUILD_NUMBER=2 sh ios/build-testflight.sh --upload`。每次新上传应递增 build number。
需要 Xcode 中已登录有权限的 Apple 开发者账号；不在项目保存苹果密码或签名私钥。
