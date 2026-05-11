#!/bin/bash
# scripts/vendor-katex.sh
# One-time script to vendor KaTeX distribution files into the source tree.
# Downloads the release tarball (pre-built dist) from GitHub releases.
# KaTeX is MIT-licensed — same as FidoCadJS.
# Run this script from the FidoCadJS/ directory root.

set -euo pipefail

VERSION="${1:-0.16.21}"
DEST="src/vendor/katex"
TMP=$(mktemp -d)

URL="https://github.com/KaTeX/KaTeX/releases/download/v${VERSION}/katex.tar.gz"
echo "→ Downloading KaTeX v${VERSION} release tarball..."
curl -sL "$URL" -o "$TMP/katex.tar.gz"

echo "→ Extracting..."
tar xzf "$TMP/katex.tar.gz" -C "$TMP"

rm -rf "$DEST"
mkdir -p "$DEST/fonts"

cp "$TMP/katex/katex.mjs"      "$DEST/" 2>/dev/null || cp "$TMP/katex/katex.js" "$DEST/katex.mjs"
cp "$TMP/katex/katex.min.css"  "$DEST/"
cp "$TMP/katex/fonts/"*        "$DEST/fonts/"
# Type definitions aren't in the release tarball; we maintain our own minimal katex.d.ts
curl -sL "https://raw.githubusercontent.com/KaTeX/KaTeX/v${VERSION}/LICENSE" -o "$DEST/LICENSE"

rm -rf "$TMP"

echo "✓ KaTeX v${VERSION} vendored to ${DEST}/"
echo "  File: $(du -h "$DEST/katex.mjs" | cut -f1) JS"
echo "  CSS:  $(du -h "$DEST/katex.min.css" | cut -f1)"
echo "  Fonts: $(ls "$DEST/fonts" | wc -l) files ($(du -sh "$DEST/fonts" | cut -f1))"
