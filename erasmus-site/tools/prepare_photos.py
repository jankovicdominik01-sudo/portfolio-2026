#!/usr/bin/env python3
"""Turn the team's raw field photos into the web versions used by the deck.

Usage:
    python3 tools/prepare_photos.py <dir with WhatsApp copies>

The source folder needs the subfolders `kompost/` (composting plant, 30 Sep 2026,
photos by our teacher Martin Woznica) and `rd/` (photos the farming cooperative
in Senica shared with us, forwarded on 2 Oct 2026). File names are the running
numbers of the WhatsApp export (see docs/01-AUDIT-A-PLAN.md).

Output: assets/agriculture/field/*.webp, assets/agriculture/coop/*.webp and one
short video. Photos are never upscaled; the longest side is capped at 1920 px.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "assets" / "agriculture"

FIELD = {
    "007.jpg": "food-waste-bags",
    "005.jpg": "turner",
    "006.jpg": "windrows",
    "008.jpg": "mixer-inside",
    "009.jpg": "mixer-guide",
    "010.jpg": "mixer-platform",
    "011.jpg": "branches-guide",
    "013.jpg": "guide-explains",
    "014.jpg": "site-overview",
    "018.jpg": "team-husmann",
    "019.jpg": "branches-walk",
    "021.jpg": "container-mixer",
}
COOP = {
    "002.jpg": ("kompost", "team-cooperative"),
    "039.jpg": ("rd", "rapeseed-grazed"),
    "034.jpg": ("rd", "sorghum-fallow-deer"),
    "041.jpg": ("rd", "maize-wild-boar"),
    "036.jpg": ("rd", "rapeseed-red-deer"),
    "046.jpg": ("rd", "rapeseed-red-deer-2"),
    "068.jpg": ("rd", "sorghum-harvest"),
    "064.jpg": ("rd", "landscape"),
    "065.jpg": ("rd", "landscape-2"),
}


def save(src: Path, dst: Path, quality=82, cap=1920):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w, h = im.size
    k = min(1.0, cap / max(w, h))
    if k < 1:
        im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=quality, method=6)
    print(f"{dst.relative_to(HERE)}  {im.size[0]}x{im.size[1]}  {dst.stat().st_size // 1024} KB")


def main(src_root: Path):
    for name, slug in FIELD.items():
        save(src_root / "kompost" / name, OUT / "field" / f"{slug}.webp", quality=84)
    for name, (sub, slug) in COOP.items():
        save(src_root / sub / name, OUT / "coop" / f"{slug}.webp")
    # 15-second pan across the site (portrait phone video, no speech): muted, small
    video = src_root / "kompost" / "003.mp4"
    if video.exists():
        dst = OUT / "field" / "site-pan.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-an", "-c:v", "libx264", "-crf", "27",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)], check=True)
        poster = OUT / "field" / "site-pan.webp"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "6", "-i", str(video), "-frames:v", "1", str(poster.with_suffix(".png"))], check=True)
        save(poster.with_suffix(".png"), poster)
        poster.with_suffix(".png").unlink()
        print(f"{dst.relative_to(HERE)}  {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
