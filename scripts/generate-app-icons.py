#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Filename:    generate-app-icons.py
# Author:      Dante Loi
# Date:        2026-06-03
# Description: Regenerate the PWA / desktop app icons by compositing the
#              master PCB artwork onto an opaque dark background, slightly
#              scaled down so it sits inside a comfortable margin (also keeps
#              the maskable icon within its safe zone).
# Copyright:   Copyright 2026 Dante Loi - GPL v3
# Details:     Reads the pristine transparent artwork from SOURCE and writes
#              icon-512.png and icon-192.png. The artwork keeps its aspect
#              ratio and is centred; corners that were transparent become the
#              dark background colour.
# ---------------------------------------------------------------------------

from pathlib import Path
from PIL import Image

ICONS_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
SOURCE = ICONS_DIR / "favicon.png"   # master full-bleed transparent artwork

BG_COLOR = (13, 27, 42)              # #0d1b2a  dark navy
ARTWORK_SCALE = 0.70                 # artwork occupies 70% of the canvas
SIZES = (512, 192)


def build_icon(artwork: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG_COLOR + (255,))

    target = int(round(size * ARTWORK_SCALE))
    scaled = artwork.copy()
    scaled.thumbnail((target, target), Image.LANCZOS)

    x = (size - scaled.width) // 2
    y = (size - scaled.height) // 2
    canvas.paste(scaled, (x, y), scaled)
    return canvas


def main() -> None:
    artwork = Image.open(SOURCE).convert("RGBA")
    for size in SIZES:
        out = ICONS_DIR / f"icon-{size}.png"
        build_icon(artwork, size).save(out)
        print(f"wrote {out.relative_to(ICONS_DIR.parent.parent)} ({size}x{size})")


if __name__ == "__main__":
    main()
