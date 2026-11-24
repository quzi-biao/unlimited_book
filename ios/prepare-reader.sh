#!/bin/sh
# 仅构建并复制本地网页资源，不打包上传或调用发布脚本。
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if ! command -v node >/dev/null 2>&1; then
  READER_NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  PATH="$READER_NODE_BIN:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
  export PATH
fi
cd "$PROJECT_ROOT/web"
pnpm build
READER_DEST="${TARGET_BUILD_DIR:?Xcode target directory required}/${UNLOCALIZED_RESOURCES_FOLDER_PATH:?Xcode resources required}/Reader"
mkdir -p "$READER_DEST"
cp -R dist/. "$READER_DEST/"
