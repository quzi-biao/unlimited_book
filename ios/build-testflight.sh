#!/bin/sh
# 构建并导出正式 iOS 测试包；传入 --upload 后上传至 App Store Connect。
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Users/ai/Downloads/Xcode.app/Contents/Developer}
BUILD_NUMBER=${BUILD_NUMBER:-1}
OUTPUT=${OUTPUT:-"$ROOT/.local-data/ios-release-$(date +%Y%m%d-%H%M%S)"}
mkdir -p "$OUTPUT"
xcodebuild -project "$ROOT/ios/UnlimitedBook.xcodeproj" -scheme UnlimitedBook \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUTPUT/UnlimitedBook.xcarchive" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates archive
DESTINATION=export
if [ "${1:-}" = '--upload' ]; then DESTINATION=upload; fi
python3 - "$OUTPUT/ExportOptions.plist" "$DESTINATION" <<'PY'
import plistlib,sys
with open(sys.argv[1], 'wb') as f:
    plistlib.dump({'method':'app-store-connect','destination':sys.argv[2],
      'teamID':'W72VRR6V9W','signingStyle':'automatic',
      'manageAppVersionAndBuildNumber':False,'uploadSymbols':True}, f)
PY
xcodebuild -exportArchive -archivePath "$OUTPUT/UnlimitedBook.xcarchive" \
  -exportPath "$OUTPUT/export" -exportOptionsPlist "$OUTPUT/ExportOptions.plist" \
  -allowProvisioningUpdates
