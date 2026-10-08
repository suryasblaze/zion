"""
Re-encode the shop artwork for the web.

The originals are photographs exported at print quality: a 900x900 tile
costs 165 KB, and the home page asks for eight of them plus a poster
before anything is readable. The WebP copies already in the tree were
made at near-maximum quality, which is why they saved almost nothing --
105 KB against 165 KB is not worth a second format.

This re-encodes both: WebP as the real image, JPEG kept beside it as the
fallback for anything that cannot read WebP. Sizes are capped at what
the layout actually displays on a 2x screen, because a tile rendered at
300 CSS pixels gains nothing from 900 source pixels.

Originals are tracked in git, so a bad run is `git checkout` away.

    python scripts/optimize_images.py            # report only
    python scripts/optimize_images.py --write    # actually re-encode
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "frontend" / "public"

# Longest edge, by role. A card tile renders about 300 CSS px wide in a
# four-column grid; 800 covers it on a 2x display with room to spare.
# Posters span most of the viewport, so they keep more.
CAPS = {
    "tile": 800,
    "poster": 1500,
    "hero": 1200,
}

WEBP_QUALITY = 80
JPEG_QUALITY = 80


def role(path: Path) -> str:
    name = path.stem
    if name.endswith("-tile"):
        return "tile"
    if "poster" in name:
        return "poster"
    return "hero"


def kb(n: int) -> str:
    return f"{n / 1024:.0f} KB"


def process(src: Path, write: bool) -> tuple[int, int]:
    """Returns (bytes before, bytes after) counting both formats."""
    before = src.stat().st_size
    webp_path = src.with_suffix(".webp")
    if webp_path.exists():
        before += webp_path.stat().st_size

    with Image.open(src) as im:
        im = im.convert("RGB")
        cap = CAPS[role(src)]
        if max(im.size) > cap:
            im.thumbnail((cap, cap), Image.LANCZOS)
        w, h = im.size

        if write:
            # method=6 is the slowest, smallest setting. These are built
            # once and served forever; the encode time is irrelevant.
            im.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
            # Progressive, so the fallback paints top-down rather than
            # sitting blank until the last byte.
            im.save(src, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)

    after = (src.stat().st_size + webp_path.stat().st_size) if write else before
    print(f"  {src.name:34} {w}x{h:<5} {kb(before):>9} -> {kb(after):>9}")
    return before, after


def main() -> int:
    write = "--write" in sys.argv
    if not PUBLIC.exists():
        print(f"not found: {PUBLIC}")
        return 1

    # Photographs only. The PNGs here are the logo and the icons: they
    # carry transparency, they are tiny, and re-encoding them as JPEG
    # would put an opaque white box behind the mark.
    sources = sorted(
        p for p in PUBLIC.rglob("*")
        if p.suffix.lower() in (".jpg", ".jpeg") and p.is_file()
    )
    if not sources:
        print("no images found")
        return 1

    print(f"{'DRY RUN -- pass --write to apply' if not write else 'Re-encoding'}\n")
    total_before = total_after = 0
    for src in sources:
        b, a = process(src, write)
        total_before += b
        total_after += a

    print(f"\n  {'total':34} {' ':11} {kb(total_before):>9} -> {kb(total_after):>9}")
    if write and total_before:
        print(f"  saved {kb(total_before - total_after)} "
              f"({100 * (total_before - total_after) / total_before:.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
