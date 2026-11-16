#!/bin/sh
# 使用本地正式签名构建连接公网服务的手机 APK。
set -eu
BUILD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ ! -f "$BUILD_DIR/phone-signing.properties" ]; then
    printf '%s\n' '缺少 android/phone-signing.properties，请先配置手机正式签名。' >&2
    exit 1
fi
exec "$BUILD_DIR/build-local.sh" :app:assemblePhoneRelease \
    "-PAPI_BASE_URL=${API_BASE_URL:-https://www.wenyi-tech.cn}" "$@"
