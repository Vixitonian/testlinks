#!/usr/bin/env python3
"""Whiteboard animation (10 s, 1920x1080, 30 fps) pitching apprelab.com to a mentor.

Ink is drawn progressively ("written") onto a persistent layer; a marker hand
sprite follows the pen tip. Frames are piped straight into ffmpeg (no PNG dump),
then the beat-synced narration from make_audio.py is muxed in.

  python3 make_audio.py && python3 render.py [--hand-only]
"""
import json, math, os, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import hand as h

ROOT = os.path.dirname(os.path.abspath(__file__))
A = lambda *p: os.path.join(ROOT, *p)
W, H, FPS, DUR = 1920, 1080, 30, 10.0
NF = int(round(DUR * FPS))
HAND_TIP = None  # set from hand.TIP once the sprite is loaded/scaled
HAND_FADE = 0.18
HAND_SCALE = 0.56  # shrink the sprite so the fist clears the top of frame at the title line
INK = (38, 41, 46)
RED = (226, 72, 61)
BLUE = (37, 99, 235)
F_MARKER = A("assets", "marker.ttf")
F_HAND = A("assets", "hand.ttf")
F_ARCH = A("assets", "arch.ttf")

# ---------------------------------------------------------------- ink helpers
def paste(ink, tile, x, y):
    """alpha-composite a tile that may hang over the canvas edge."""
    x, y = int(x), int(y)
    if x >= ink.width or y >= ink.height or x + tile.width <= 0 or y + tile.height <= 0:
        return
    cx, cy = max(0, -x), max(0, -y)
    x0, y0 = max(0, x), max(0, y)
    w = min(tile.width - cx, ink.width - x0)
    h = min(tile.height - cy, ink.height - y0)
    if w > 0 and h > 0:
        ink.alpha_composite(tile.crop((cx, cy, cx + w, cy + h)), (x0, y0))


def jitter_path(pts, amp, seed, samples=None):
    """Resample a control polyline and add hand wobble."""
    rng = random.Random(seed)
    if len(pts) < 2:
        return pts
    if samples is None:
        samples = max(24, int(_plen(pts) / 12))
    out = []
    for k in range(samples + 1):
        u = k / samples
        seg = u * (len(pts) - 1)
        i = min(int(seg), len(pts) - 2)
        f = seg - i
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        x, y = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / n, dx / n
        bow = math.sin(math.pi * u) * amp * rng.uniform(-0.8, 0.8)
        out.append((x + nx * bow + rng.uniform(-amp, amp) * 0.5,
                    y + ny * bow + rng.uniform(-amp, amp) * 0.5))
    return out


def _plen(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def wavy(p0, p1, amp=2.0, seed=1):
    return jitter_path([p0, p1], amp, seed, samples=max(20, int(math.dist(p0, p1) / 10)))


def rect_path(x0, y0, x1, y1, amp=2.5, seed=2, start="tl"):
    c = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    if start == "tr":
        c = c[1:] + c[:1]
    c = c + [c[0]]
    pts = []
    for i in range(len(c) - 1):
        s = jitter_path([c[i], c[i + 1]], amp, seed + i, samples=int(math.dist(c[i], c[i + 1]) / 9))
        pts += s if not pts else s[1:]
    return pts


def ellipse_path(cx, cy, rx, ry, seed=3, a0=-90, sweep=360, amp=2.0):
    rng = random.Random(seed)
    n = max(40, int(abs(sweep) / 4))
    pts = []
    for k in range(n + 1):
        a = math.radians(a0 + sweep * k / n)
        r = 1 + rng.uniform(-amp, amp) / min(rx, ry)
        pts.append((cx + rx * r * math.cos(a), cy + ry * r * math.sin(a)))
    return pts


def check_path(x, y, h, seed=5):
    return jitter_path([(x, y - h * 0.55), (x + h * 0.36, y - h * 0.08), (x + h, y - h * 1.15)],
                       1.2, seed, samples=16)


class Base:
    def __init__(self, start, end):
        self.start, self.end = start, end
        self.dur = max(0.05, end - start)

    def prog(self, t):
        return min(1.0, max(0.0, (t - self.start) / self.dur))

    def active(self, t):
        return self.start <= t <= self.end


class TextEl(Base):
    """A hand-written text run: glyph tiles with per-glyph jitter, revealed by pen distance."""

    def __init__(self, text, fpath, size, color, start, end, x, baseline,
                 seed=1, jitter=3.0, rot=1.8, tracking=0.0, weight_pad=None):
        super().__init__(start, end)
        self.x, self.baseline, self.size = x, baseline, size
        f = ImageFont.truetype(fpath, size)
        rng = random.Random(seed)
        pad = int(size * 0.85) + 8
        self.items, cu = [], 0.0
        for ch in text:
            adv = f.getlength(ch)
            if ch.strip() == "":
                self.items.append((None, 0, 0, cu, adv))
            else:
                tw, th = int(adv) + 2 * pad, int(size * 1.9) + 2 * pad
                t = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
                ImageDraw.Draw(t).text((pad, pad + size * 1.25), ch, font=f, fill=color, anchor="ls")
                t = t.rotate(rng.uniform(-rot, rot), resample=Image.BICUBIC, center=(tw / 2, th / 2))
                dy, dx = rng.uniform(-jitter, jitter), rng.uniform(-jitter * 0.5, jitter * 0.5)
                self.items.append((t, x + cu + dx - pad, baseline + dy - (pad + size * 1.25), cu, adv))
            cu += adv + tracking
        self.total, self.pad, self.done = cu, pad, 0

    def update(self, t, ink):
        d = self.prog(t) * self.total
        i = self.done
        while i < len(self.items):
            tile, px, py, cu, adv = self.items[i]
            if tile is None:
                i += 1
                self.done = i
                continue
            if d >= cu + adv:
                paste(ink, tile, px, py)
                i += 1
                self.done = i
            else:
                w = int(self.pad + max(0.0, d - cu))
                if w > 0:
                    paste(ink, tile.crop((0, 0, min(w, tile.width), tile.height)), px, py)
                break

    def pen(self, t):
        d = self.prog(t) * self.total
        for tile, px, py, cu, adv in self.items:
            if tile is not None and d <= cu + adv:
                f = 0.0 if adv <= 0 else min(1.0, max(0.0, (d - cu) / adv))
                return (self.x + cu + f * adv, self.baseline - self.size * 0.42)
        return (self.x + self.total, self.baseline - self.size * 0.42)


class StrokeEl(Base):
    def __init__(self, pts, width, color, start, end):
        super().__init__(start, end)
        self.pts, self.width, self.color = pts, width, color
        cum = [0.0]
        for i in range(1, len(pts)):
            cum.append(cum[-1] + math.dist(pts[i - 1], pts[i]))
        self.cum, self.total = cum, max(1e-6, cum[-1])

    def _upto(self, d):
        i = 0
        while i + 1 < len(self.cum) and self.cum[i + 1] <= d:
            i += 1
        out = self.pts[:i + 1]
        if i + 1 < len(self.pts) and self.cum[i + 1] > d:
            f = (d - self.cum[i]) / (self.cum[i + 1] - self.cum[i])
            (x0, y0), (x1, y1) = self.pts[i], self.pts[i + 1]
            out = out + [(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)]
        return out

    def update(self, t, ink):
        sub = self._upto(self.prog(t) * self.total)
        if len(sub) < 2:
            return
        d = ImageDraw.Draw(ink)
        d.line(sub, fill=self.color + (255,), width=self.width, joint="curve")
        r = self.width / 2 - 0.5
        for p in (sub[0], sub[-1]):
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=self.color + (255,))

    def pen(self, t):
        sub = self._upto(self.prog(t) * self.total)
        return sub[-1]


# ---------------------------------------------------------------- hand sprite
def _rot(p, ang, o):
    c, s = math.cos(ang), math.sin(ang)
    x, y = p[0] - o[0], p[1] - o[1]
    return (o[0] + x * c - y * s, o[1] + x * s + y * c)


def _ellipse_pts(cx, cy, rx, ry, ang, n=70):
    """Ellipse outline rotated by ang (ellipse drawn in a rotated frame)."""
    ca, sa = math.cos(ang), math.sin(ang)
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        ex, ey = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + ex * ca - ey * sa, cy + ex * sa + ey * ca))
    return out


def _capsule(d, p0, p1, w, fill, outline=None):
    if outline:
        d.line([p0, p1], fill=outline, width=w + 7, joint="curve")
        for p in (p0, p1):
            d.ellipse([p[0] - (w + 7) / 2, p[1] - (w + 7) / 2, p[0] + (w + 7) / 2, p[1] + (w + 7) / 2], fill=outline)
    d.line([p0, p1], fill=fill, width=w, joint="curve")
    for p in (p0, p1):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=fill)


def rotated_hand(sprite, deg, cache={}):
    """Rotate the hand about its marker tip; PIL moves the tip, so track it."""
    key = round(deg / 4) * 4
    if key not in cache:
        img = sprite.rotate(-key, resample=Image.BICUBIC, center=h.TIP)
        c, sn = math.cos(math.radians(key)), math.sin(math.radians(key))
        dx, dy = h.TIP[0] - h.TIP[0], h.TIP[1] - h.TIP[1]
        tip = (h.TIP[0] + (dx * c - dy * sn), h.TIP[1] + (dx * sn + dy * c))
        cache[key] = (img, tip)
    return cache[key]


# ---------------------------------------------------------------- scene
def build_scene(times):
    (A0, A1), (B0, B1), (C0, C1) = times["A"], times["B"], times["C"]
    scene, strokes = [], []

    title = TextEl("Apprelab", F_MARKER, 132, INK, A0, A0 + 1.05, 150, 265, seed=11, jitter=4, rot=3)
    scene.append(title)
    strokes.append(("title_under", wavy((152, 312), (152 + title.total * 0.96, 316), 3.0, 21),
                    9, RED, A0 + 1.05, A0 + 1.45))
    scene.append(TextEl("Learn digital skills in 3-7 minute lessons.", F_ARCH, 54, INK,
                        A0 + 1.45, A1 + 0.06, 156, 425, seed=12, jitter=3, rot=2))

    bullets = ["Real tasks", "Instant AI feedback", "Verified badge"]
    by = [578, 690, 802]
    t0 = B0
    for i, (txt, y) in enumerate(zip(bullets, by)):
        strokes.append((f"chk{i}", check_path(182, y, 46, seed=31 + i), 8, BLUE, t0, t0 + 0.16))
        dur = (0.34, 0.46, 0.36)[i]
        scene.append(TextEl(txt, F_ARCH, 56, INK, t0 + 0.16, t0 + 0.16 + dur, 248, y, seed=41 + i, jitter=3, rot=2))
        t0 += 0.16 + dur + 0.14
    strokes.append(("badge", ellipse_path(1010, 690, 100, 92, seed=61, a0=-88, sweep=372, amp=2.2),
                    9, BLUE, B0 + 2.55, B0 + 3.02))
    strokes.append(("badge_chk", check_path(958, 706, 92, seed=62), 10, BLUE, B0 + 3.02, B0 + 3.16))

    scene.append(TextEl("I’d love your mentorship to scale this.", F_ARCH, 52, INK,
                        C0, C0 + 1.35, 186, 1006, seed=71, jitter=3, rot=2))
    strokes.append(("arrow", wavy((1146, 984), (1382, 988), 2.0, 81), 8, RED, C0 + 1.40, C0 + 1.68))
    strokes.append(("arrow_head", [(1362, 966), (1386, 988), (1362, 1010)], 8, RED, C0 + 1.66, C0 + 1.76))
    url_size = 62
    while True:
        url = TextEl("apprelab.com", F_MARKER, url_size, RED, C0 + 1.80, C0 + 3.05, 1404, 1012,
                     seed=91, jitter=3, rot=2)
        if 1404 + url.total <= W - 46 or url_size <= 44:
            break
        url_size -= 4
    scene.append(url)
    for tag, pts, w, col, s, e in strokes:
        scene.append(StrokeEl(pts, w, col, s, e))
    return scene


def make_paper():
    rng = np.random.default_rng(7)
    a = np.full((H, W, 3), 250, np.uint8) + rng.integers(-2, 3, (H, W, 1), dtype=np.int16)
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.05 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    a = (a * v[..., None]).clip(0, 255).astype(np.uint8)
    paper = Image.fromarray(a, "RGB").convert("RGBA")
    ImageDraw.Draw(paper).rounded_rectangle([24, 24, W - 25, H - 25], 22, outline=(205, 209, 213, 255), width=3)
    return paper


def main():
    hand_only = False
    sprite = h.load(A("assets", "hand.png"))
    global HAND_TIP
    if HAND_SCALE != 1.0:
        sprite = sprite.resize((int(sprite.width * HAND_SCALE), int(sprite.height * HAND_SCALE)), Image.LANCZOS)
        HAND_TIP = (h.TIP[0] * HAND_SCALE, h.TIP[1] * HAND_SCALE)
    if hand_only:
        print("hand sprite ->", A("assets", "hand.png"))
        return
    times = json.load(open(A("build", "times.json")))
    scene = build_scene(times)
    paper = make_paper()
    ff = subprocess.run([sys.executable, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
                        capture_output=True, text=True).stdout.strip()
    silent = A("build", "video_silent.mp4")
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                             "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
                             "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent], stdin=subprocess.PIPE)
    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    last = None
    for fi in range(NF):
        t = fi / FPS
        for el in scene:
            if t >= el.start:
                el.update(t, ink)
        board = Image.alpha_composite(paper, ink)
        act = [e for e in scene if e.active(t)]
        if act:
            el = max(act, key=lambda e: e.start)
            p = el.pen(t)
            deg = 0.0
            if isinstance(el, StrokeEl):
                sub = el._upto(el.prog(t) * el.total)
                d = math.degrees(math.atan2(sub[-1][1] - sub[0][1], sub[-1][0] - sub[0][0])) if len(sub) > 1 else 0.0
                deg = max(-60.0, min(60.0, -d))
            last = (p, deg, t)
            img, tip = rotated_hand(sprite, deg)
            paste(board, img, int(p[0] - tip[0]), int(p[1] - tip[1]))
        elif last and t - last[2] < HAND_FADE:
            # let the hand fade out where it stopped instead of popping away
            p, deg, lt = last
            img, tip = rotated_hand(sprite, deg)
            a = 1.0 - (t - lt) / HAND_FADE
            img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
            paste(board, img, int(p[0] - tip[0]), int(p[1] - tip[1]))
            if t - lt > HAND_FADE + 0.05:
                last = None
        proc.stdin.write(board.convert("RGB").tobytes())
    proc.stdin.close()
    proc.wait()
    assert proc.returncode == 0, "ffmpeg encode failed"
    final = A("out", "apprelab-whiteboard-pitch-10s.mp4")
    r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", silent, "-i", A("build", "narration.wav"),
                        "-filter_complex", "[1:a]apad=whole_dur=10[a]", "-map", "0:v", "-map", "[a]",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{DUR}", final], capture_output=True)
    assert r.returncode == 0, r.stderr.decode()[-500:]
    print(f"ok: {NF} frames -> {final} ({os.path.getsize(final)/1e6:.1f} MB)")
    # verification stills
    for tt in (0.8, 2.4, 4.2, 6.0, 7.6, 9.6):
        subprocess.run([ff, "-y", "-loglevel", "error", "-ss", str(tt), "-i", final, "-frames:v", "1",
                        A("build", f"still_{tt}.png")], capture_output=True)
    print("stills in build/")


if __name__ == "__main__":
    main()
