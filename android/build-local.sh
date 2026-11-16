#!/bin/sh
# 本地构建入口：复用已安装的 JDK / SDK，不安装工具或修改系统环境配置。
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ -z "${JAVA_HOME:-}" ]; then
    if [ -x /usr/libexec/java_home ]; then
        JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
    fi
    if [ -z "${JAVA_HOME:-}" ] && [ -x /Applications/HBuilderX.app/Contents/HBuilderX/plugins/amazon-corretto/bin/java ]; then
        JAVA_HOME=/Applications/HBuilderX.app/Contents/HBuilderX/plugins/amazon-corretto
    fi
fi
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    printf '%s\n' '未找到 JDK，请将 JAVA_HOME 指向已安装的 JDK 17。' >&2
    exit 1
fi
export JAVA_HOME

# Android Gradle Plugin 优先使用 local.properties 的 sdk.dir。
SDK_PATH=
if [ -f local.properties ]; then
    SDK_PATH=$(sed -n 's/^sdk\.dir=//p' local.properties | head -n 1)
fi
SDK_PATH=${SDK_PATH:-${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}}
if [ -z "$SDK_PATH" ] || [ ! -f "$SDK_PATH/platforms/android-36/android.jar" ]; then
    printf '%s\n' '未找到 Android SDK 36，请配置 android/local.properties 的 sdk.dir 或 ANDROID_HOME。' >&2
    exit 1
fi
export ANDROID_HOME="$SDK_PATH"
export ANDROID_SDK_ROOT="$SDK_PATH"

if [ "$#" -eq 0 ]; then
    set -- :shared:testDebugUnitTest :app:testPhoneDebugUnitTest :app:testTabletDebugUnitTest :app:assemblePhoneDebug :app:assembleTabletDebug
fi
printf 'JDK: %s\nSDK: %s\n' "$JAVA_HOME" "$ANDROID_HOME"
exec sh ./gradlew --no-daemon --console=plain --max-workers=2 "$@"
