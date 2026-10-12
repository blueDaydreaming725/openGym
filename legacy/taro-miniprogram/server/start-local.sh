#!/bin/sh
# 本机启动脚本：必须用 homebrew node v25（better-sqlite3 按 v25 ABI 编译）
NODE_BIN="/opt/homebrew/bin/node"
cd "/Users/xcwengyx/.zcode/workspace/default/fitness-app/server" || exit 1
exec "$NODE_BIN" dist/index.js
