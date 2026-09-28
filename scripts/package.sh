#!/usr/bin/env bash
# Build the store uploads:
#   dist/cam360-<version>.zip          Chrome Web Store (Edge Add-ons takes it too)
#   dist/cam360-firefox-<version>.zip  Firefox Add-ons (addons.mozilla.org)
#   dist/firefox/                      the same Firefox build unpacked, for testing
# Both stores require manifest.json at the ZIP ROOT, so we zip the files
# directly rather than zipping the repo folder.
#
# Firefox gets the same code with a rewritten manifest; see
# scripts/firefox-manifest.py for what changes and why.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
FILES=(_locales icons popup src vendor)
mkdir -p dist

OUT="dist/cam360-$VERSION.zip"
rm -f "$OUT"
zip -qr "$OUT" manifest.json "${FILES[@]}" -x "*.DS_Store"
echo "built $OUT"

FX="dist/firefox"
rm -rf "$FX"
mkdir -p "$FX"
cp -R "${FILES[@]}" "$FX"/
python3 scripts/firefox-manifest.py manifest.json > "$FX/manifest.json"
FOUT="cam360-firefox-$VERSION.zip"
rm -f "dist/$FOUT"
(cd "$FX" && zip -qr "../$FOUT" . -x "*.DS_Store")
echo "built dist/$FOUT"
