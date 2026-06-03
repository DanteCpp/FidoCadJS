#!/bin/bash
# scripts/vendor-mathjax.sh
# Vendors the MathJax SVG engine into the source tree as a single self-contained
# ES module. Unlike KaTeX (a pure copy of a released dist), MathJax is bundled
# from `mathjax-full` (a dev dependency) via esbuild, because we ship a custom
# DOM-free liteAdaptor entry (scripts/mathjax-svg-entry.mjs) that exposes glyph
# geometry. MathJax is Apache-2.0, one-way compatible into FidoCadJS (GPL v3).
# Runtime deps stay at zero — mathjax-full is devDependencies only.
# Run from the FidoCadJS/ directory root.

set -euo pipefail

DEST="src/vendor/mathjax"
ENTRY="scripts/mathjax-svg-entry.mjs"
MJ_VERSION="$(node -p "require('./node_modules/mathjax-full/package.json').version" 2>/dev/null || echo unknown)"

echo "→ Ensuring mathjax-full dev dependency is installed..."
if [ ! -d "node_modules/mathjax-full" ]; then
    npm i -D mathjax-full
fi

echo "→ Bundling SVG engine with esbuild..."
mkdir -p "$DEST"
# mathjax-full has node-only lazy loaders that do `eval('require')` at init
# (components/version.js, mml3-node.js). We bundle everything statically and
# never hit those paths, so a module-scope require shim that throws only when
# actually invoked lets `eval('require')` resolve harmlessly in ESM scope.
npx esbuild "$ENTRY" \
    --bundle \
    --format=esm \
    --platform=neutral \
    --minify \
    --legal-comments=none \
    --define:PACKAGE_VERSION="\"${MJ_VERSION}\"" \
    --banner:js="var require=(m)=>{throw new Error('mathjax: dynamic require unsupported: '+m);};" \
    --outfile="$DEST/mathjax.mjs"

echo "→ Copying MathJax license..."
cp "node_modules/mathjax-full/LICENSE" "$DEST/LICENSE"

echo "✓ MathJax SVG engine vendored to ${DEST}/"
echo "  Bundle: $(du -h "$DEST/mathjax.mjs" | cut -f1)"
