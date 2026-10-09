#!/bin/sh
cd "$(dirname "$0")" || exit 1
node tools/macos/build-host.mjs >/dev/null || exit 1
npm run build || exit 1
exec build/macos/ts-stg dist/main.js --root . --backend quickjs "$@"
