"""Render the intro film for the Slovakia deck: media/intro.mp4 (+ poster).

A one-minute "Slovakia" opener cut from Creative Commons footage and photos:
  Spiš Castle drone flight  — Hendric Stattmann, CC BY-SA 4.0 (Wikimedia Commons)
  Bratislava and the Danube — Spasimir Pilev, CC BY-SA 4.0 (Wikimedia Commons)
  fujara music              — Ľubomír Párička, recorded by Mariusz Raniszewski, CC BY-SA 3.0
  photos                    — the deck's own photos (see tools/photos.json)

The last frame is the cover photo framed exactly like the cover slide's first
frame (scale 1.14, translate 1.5 % / 1 %), so the deck takes over seamlessly.

Usage:  python3 tools/make_intro.py <raw-dir> <fonts-dir>
  raw-dir:   spis.webm, bratislava.webm, fujara.webm and full/<photo>.jpg
  fonts-dir: manrope-800.ttf, manrope-300.ttf, serif-italic.ttf
Needs numpy, Pillow and imageio-ffmpeg (pip install numpy pillow imageio-ffmpeg).
"""
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

RAW, FONTS = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "media")
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
T = 58.0
BAR = 131  # letterbox bar height (2.35:1 picture inside 16:9)
XF = 1.0   # crossfade length


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- sources
class Video:
    """Reads frames from a video file, scaled to 1920×1080, on demand."""

    def __init__(self, path, src_in, dur):
        self.p = subprocess.Popen(
            [FF, "-v", "error", "-ss", str(src_in), "-i", path, "-t", str(dur + 0.5),
             "-vf", f"scale={W}:{H}:flags=lanczos,fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE)
        self.last = np.zeros((H, W, 3), np.uint8)

    def frame(self, _local):
        b = self.p.stdout.read(W * H * 3)
        if len(b) == W * H * 3:
            self.last = np.frombuffer(b, np.uint8).reshape(H, W, 3)
        return self.last


class Photo:
    """Ken Burns move written like CSS: scale s, translate (tx, ty) in % of the frame."""

    def __init__(self, path, dur, s0, s1, t0, t1, band=H - 2 * BAR):
        self.im = Image.open(path).convert("RGB")
        self.dur, self.s0, self.s1, self.t0, self.t1 = dur, s0, s1, t0, t1
        iw, ih = self.im.size
        # object-fit: cover into the frame (or the letterboxed band, whichever needs less upscaling)
        self.base = max(W / iw, band / ih, 0)
        if ih * self.base < H and band == H:
            self.base = max(W / iw, H / ih)

    def frame(self, local):
        k = ease(local / self.dur)
        s = self.s0 + (self.s1 - self.s0) * k
        tx = (self.t0[0] + (self.t1[0] - self.t0[0]) * k) / 100 * W
        ty = (self.t0[1] + (self.t1[1] - self.t0[1]) * k) / 100 * H
        iw, ih = self.im.size
        b = self.base
        # output pixel p -> frame point q = c + (p - c)/s - t -> image pixel = (q - offset)/b
        cx, cy = W / 2, H / 2
        ox, oy = (W - iw * b) / 2, (H - ih * b) / 2
        a = 1 / (s * b)
        coeffs = (a, 0, (cx - cx / s - tx - ox) / b, 0, a, (cy - cy / s - ty - oy) / b)
        out = self.im.transform((W, H), Image.AFFINE, coeffs, resample=Image.BICUBIC)
        return np.asarray(out)


class Black:
    def frame(self, _local):
        return np.zeros((H, W, 3), np.uint8)


def photo(name):
    p = os.path.join(RAW, "full", name + ".jpg")
    if not os.path.exists(p):
        p = os.path.join(HERE, "..", "img", name + ".webp")
    return p


# start, duration, source factory
SHOTS = [
    (0.0, 4.0, lambda d: Black()),
    (3.5, 12.0, lambda d: Video(os.path.join(RAW, "spis.webm"), 20.0, d)),
    (14.5, 9.0, lambda d: Photo(photo("tatras"), d, 1.06, 1.16, (-2.0, 0.5), (2.0, -0.5))),
    (22.5, 11.5, lambda d: Video(os.path.join(RAW, "bratislava.webm"), 1.0, d)),
    (33.0, 6.0, lambda d: Photo(photo("folk-dancers"), d, 1.04, 1.14, (0.0, 1.0), (-1.0, 0.0))),
    (38.0, 5.0, lambda d: Photo(photo("vlkolinec"), d, 1.12, 1.04, (1.5, 0.0), (-1.5, 0.0))),
    (42.0, 8.0, lambda d: Video(os.path.join(RAW, "spis.webm"), 88.0, d)),
    # ends exactly where the cover slide begins: scale(1.14) translate(1.5%, 1%)
    (49.0, 9.0, lambda d: Photo(photo("cover-strbske-pleso"), d, 1.34, 1.14, (-1.0, -1.5), (1.5, 1.0), band=H)),
]

# ---------------------------------------------------------------- titles
def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def text_img(lines, center=False):
    """lines: (text, font, tracking_px, rgba) stacked; returns RGBA numpy + size."""
    pad = 20
    sizes = []
    for txt, f, tr, _c in lines:
        w = sum(f.getlength(ch) + tr for ch in txt) - tr
        asc, desc = f.getmetrics()
        sizes.append((w, asc + desc))
    w = int(max(s[0] for s in sizes)) + pad * 2
    h = int(sum(s[1] for s in sizes) + 14 * (len(lines) - 1)) + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = pad
    for (txt, f, tr, c), (lw, lh) in zip(lines, sizes):
        x = pad + ((w - 2 * pad - lw) / 2 if center else 0)
        for ch in txt:
            d.text((x, y), ch, font=f, fill=c)
            x += f.getlength(ch) + tr
        y += lh + 14
    # soft shadow for legibility on bright skies
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 110), mask=im.split()[3])
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    out = Image.alpha_composite(sh, im)
    return np.asarray(out).astype(np.float32) / 255.0


WHITE, SOFT, GOLD = (255, 255, 255, 255), (236, 240, 248, 215), (240, 214, 150, 255)
K = font("manrope-800.ttf", 58)
KS = font("manrope-800.ttf", 22)
SER = font("serif-italic.ttf", 40)
SERL = font("serif-italic.ttf", 64)
BIG = font("manrope-800.ttf", 210)

TITLES = [
    # start, end, image, anchor ("c" centre or "ll" lower-left)
    (0.6, 3.5, text_img([("ERASMUS+ · MERSIN 2026", KS, 7, GOLD), ("a short film by the Slovak team from Senica", SER, 0, SOFT)], center=True), "c"),
    (5.5, 13.0, text_img([("SPIŠ CASTLE", K, 6, WHITE), ("one of Central Europe's largest castle sites · UNESCO", SER, 0, SOFT)]), "ll"),
    (16.0, 22.0, text_img([("HIGH TATRAS", K, 6, WHITE), ("the highest peaks of the Carpathians", SER, 0, SOFT)]), "ll"),
    (24.5, 32.0, text_img([("BRATISLAVA", K, 6, WHITE), ("our capital on the Danube", SER, 0, SOFT)]), "ll"),
    (34.2, 38.4, text_img([("LIVING TRADITIONS", K, 6, WHITE), ("folk costumes, music and dance", SER, 0, SOFT)]), "ll"),
    (39.0, 42.6, text_img([("VLKOLÍNEC", K, 6, WHITE), ("a UNESCO log-house village", SER, 0, SOFT)]), "ll"),
    (50.0, 55.2, text_img([("SLOVAKIA", BIG, 14, WHITE), ("the heart of Europe", SERL, 0, SOFT)], center=True), "c"),
]


def put(frame, img, x, y, alpha):
    h, w = img.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0 or alpha <= 0:
        return
    sub = img[y0 - y:y1 - y, x0 - x:x1 - x]
    a = sub[..., 3:4] * alpha
    region = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = (region * (1 - a) + sub[..., :3] * 255 * a).astype(np.uint8)


# ---------------------------------------------------------------- look
x = np.arange(256) / 255.0
curve = np.clip(x + 0.10 * np.sin((x - 0.5) * np.pi) * (1 - abs(x - 0.5) * 0.6), 0, 1)  # gentle S-curve
LUT = np.stack([np.clip(curve * 1.015 + 0.004, 0, 1), curve, np.clip(curve * 0.985 + 0.012 * (1 - x), 0, 1)], 1)
LUT = (LUT * 255).astype(np.uint8)
yy, xx = np.mgrid[0:H, 0:W]
VIG = (1 - 0.32 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.4).clip(0.55, 1).astype(np.float32)[..., None]


def bars_at(t):
    """Letterbox slides in at the start and retracts for the hand-off to the cover."""
    if t < 1.5:
        return int(BAR * ease(t / 1.5))
    if t > 55.0:
        return int(BAR * (1 - ease((t - 55.0) / 2.2)))
    return BAR


def grade(fr, t):
    g = LUT[fr, np.arange(3)]
    # the final shot must match the deck's untouched cover photo: fade the look out
    k = 1 - ease((t - 52.0) / 4.0) if t > 52.0 else 1.0
    if k > 0:
        v = 1 - (1 - VIG) * k
        g = (g.astype(np.float32) * v).astype(np.uint8)
        if k < 1:
            g = (g.astype(np.float32) * k + fr.astype(np.float32) * (1 - k)).astype(np.uint8)
    else:
        g = fr.copy()
    return g


# ---------------------------------------------------------------- render
def main():
    os.makedirs(OUT, exist_ok=True)
    n = int(T * FPS)
    enc = subprocess.Popen(
        [FF, "-v", "error", "-y",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-ss", "2.0", "-t", str(T), "-i", os.path.join(RAW, "fujara.webm"),
         "-map", "0:v", "-map", "1:a",
         "-af", f"loudnorm=I=-18:TP=-2,afade=t=in:st=0:d=2,afade=t=out:st={T - 3.5}:d=3.5",
         "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", "-shortest",
         os.path.join(OUT, "intro.mp4")],
        stdin=subprocess.PIPE)
    live = {}
    poster = None
    for i in range(n):
        t = i / FPS
        layers = []
        for si, (st, du, make) in enumerate(SHOTS):
            if st <= t < st + du:
                if si not in live:
                    live[si] = make(du)
                layers.append((si, st, du))
        for si in list(live):
            st, du, _ = SHOTS[si]
            if t >= st + du:
                src = live.pop(si)
                if isinstance(src, Video):
                    src.p.kill()
        # base = earliest layer, later layers cross-fade in over XF seconds
        fr = None
        for si, st, du in layers:
            img = live[si].frame(t - st)
            if fr is None:
                fr = img.copy()
            else:
                a = ease((t - st) / XF)
                fr = (fr.astype(np.float32) * (1 - a) + img.astype(np.float32) * a).astype(np.uint8)
        fr = grade(fr, t)
        for st, en, img, anchor in TITLES:
            if st <= t <= en:
                a = min(ease((t - st) / 0.7), ease((en - t) / 0.7))
                drift = int((1 - ease((t - st) / 1.4)) * 18)
                h, w = img.shape[:2]
                if anchor == "c":
                    put(fr, img, (W - w) // 2, (H - h) // 2 + drift, a)
                else:
                    put(fr, img, 96, H - BAR - h - 30 + drift, a)
        b = bars_at(t)
        if b:
            fr[:b] = 0
            fr[H - b:] = 0
        if abs(t - 46.0) < 1e-6:
            poster = fr.copy()
        enc.stdin.write(fr.tobytes())
        if i % 150 == 0:
            print(f"{t:5.1f}s", flush=True)
    enc.stdin.close()
    enc.wait()
    Image.fromarray(poster).save(os.path.join(OUT, "intro-poster.jpg"), quality=86)
    print("done", os.path.getsize(os.path.join(OUT, "intro.mp4")) // 1024, "KB")


if __name__ == "__main__":
    main()
