#!/usr/bin/env bash
# Build the Chrome Web Store upload zip.
# The store requires manifest.json at the ZIP ROOT, so we zip the files
# directly rather than zipping the repo folder.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/cam360-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -qr "$OUT" manifest.json icons popup src vendor -x "*.DS_Store"
echo "built $OUT"
