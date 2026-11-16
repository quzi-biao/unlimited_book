#!/bin/sh
# 仅构建本地 iPhone 模拟器预览，不生成可分发的 iOS 安装包。
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Users/ai/Downloads/Xcode.app/Contents/Developer}
PREVIEW_DIR="$PROJECT_ROOT/.local-data/ios-preview"
PREVIEW_APP="$PREVIEW_DIR/UnlimitedBookPreview.app"
mkdir -p "$PREVIEW_APP"
PREVIEW_SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
xcrun --sdk iphonesimulator swiftc \
  -target arm64-apple-ios17.0-simulator -sdk "$PREVIEW_SDK" \
  -parse-as-library -framework UIKit -framework WebKit \
  "$PROJECT_ROOT/ios-preview/PreviewApp.swift" -o "$PREVIEW_APP/UnlimitedBookPreview"
python3 - "$PREVIEW_APP/Info.plist" <<'PY'
import plistlib, sys
info = {
    'CFBundleIdentifier': 'cn.wenyi.unlimitedbook.localpreview',
    'CFBundleName': 'UnlimitedBookPreview',
    'CFBundleDisplayName': '无限之书预览',
    'CFBundleExecutable': 'UnlimitedBookPreview',
    'CFBundlePackageType': 'APPL',
    'CFBundleVersion': '1',
    'CFBundleShortVersionString': '1.0',
    'MinimumOSVersion': '17.0',
    'LSRequiresIPhoneOS': True,
    'UIDeviceFamily': [1],
    'UISupportedInterfaceOrientations': ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'],
    'UIStatusBarHidden': True,
    'UIViewControllerBasedStatusBarAppearance': True,
    'UILaunchScreen': {},
    'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
}
with open(sys.argv[1], 'wb') as f:
    plistlib.dump(info, f)
PY
codesign --force --sign - --timestamp=none "$PREVIEW_APP"
printf '%s\n' "$PREVIEW_APP"
