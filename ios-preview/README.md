# iPhone 本地全屏预览

本目录是便于观察布局的最小 WKWebView 预览壳，加载本地 `http://localhost:5175/`。它不是正式 iOS 客户端，也没有上传 TestFlight。原有 Android 及线上部署不变。

- 无 Safari 地址栏与 localhost 提示，隐藏 iOS 状态栏，默认横屏。
- 网页在设备安全区域内显示，顶部导航及账户按钮避开灵动岛。
- 下方搜索及朗读合计仍为当前图片显示宽度的 60%。
- 本地 web/backend 容器需要保持运行；网页仍使用现有本地数据。
- 在模拟器主屏幕点击“无限之书预览”即可再次打开。

## 构建与安装

`sh ios-preview/build-simulator.sh` 构建 arm64 模拟器应用到 `.local-data/ios-preview/UnlimitedBookPreview.app`。

安装到已启动的模拟器：

```sh
export DEVELOPER_DIR=/Users/ai/Downloads/Xcode.app/Contents/Developer
xcrun simctl install booted .local-data/ios-preview/UnlimitedBookPreview.app
xcrun simctl launch booted cn.wenyi.unlimitedbook.localpreview
```

2026-11-16 已在 iPhone 17 Pro / iOS 26.5 模拟器编译安装并目视确认：黄山页面、顶部左右按钮和底栏显示正常，无浏览器地址栏。尚未验证正式 iOS 分发、真机或全部音频交互。
