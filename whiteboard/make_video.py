#!/usr/bin/env python3
"""Whiteboard explainer video: "How to remember things".

One script: edit SCENES (text, timings, doodles) and NARRATION, then run
    python3 make_video.py
Needs: Pillow, numpy, ffmpeg. Voice: Piper (python -m piper) with VOICE model;
falls back to marker-scratch sounds + burned-in captions if Piper is missing.
"""
import math, os, random, subprocess, sys, wave, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- settings
W, H, FPS, SS = 1280, 720, 15, 2          # SS = supersampling for smooth lines
MARGIN = 60
MIN_TEXT = 34                             # smallest on-screen text (px), phone-readable
PAPER = (251, 249, 242)
INK, BLUE, GREEN, ORANGE, RED = (35, 35, 45), (40, 100, 200), (40, 150, 80), (235, 130, 30), (210, 50, 50)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "how_to_remember.mp4")
WORK = os.path.join(HERE, "build")
VOICE = os.environ.get("PIPER_VOICE", os.path.join(HERE, "en_US-lessac-medium.onnx"))
LENGTH_SCALE = 1.2                        # >1 = slower speech
SR = 22050                                # audio sample rate
FONT_PATHS = ["/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
FONT_FILE = next(p for p in FONT_PATHS if os.path.exists(p))

# ---------------------------------------------------------------- narration
#            (scene name, target seconds, narration line)
NARRATION = [
    ("Hook", 6, "Ever read something, then forget it a day later? Let's fix that today."),
    ("Problem", 9, "Your brain drops most new things fast. Within a day, much of it fades. "
                   "That's normal. It just needs the right signals."),
    ("Idea 1", 11, "Idea one: test yourself. Close the book and try to recall it. "
                   "Each time you pull a memory out, the path to it gets stronger."),
    ("Idea 2", 11, "Idea two: space it out. Review after one day, then three days, then a week. "
                   "Short gaps beat one long cram session every time."),
    ("Idea 3", 11, "Idea three: link it. Connect new facts to things you already know. "
                   "More links mean more ways back to the memory when you need it."),
    ("Recap", 12, "So remember: test yourself, space it out, and link it up. "
                  "Three small habits, every day. Try one today, and watch what sticks."),
]

# ---------------------------------------------------------------- items
_fonts = {}
def font(size):
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT_FILE, size * SS)
    return _fonts[size]

def ease(p):
    p = min(max(p, 0.0), 1.0)
    return p * p * (3 - 2 * p)

class Stroke:
    """Polyline drawn progressively with a slight hand wobble."""
    def __init__(self, pts, t0, dur, color, width=5, seed=0):
        self.t0, self.dur, self.color, self.width = t0, dur, color, width
        rnd = random.Random(seed)
        # resample at ~3 px and add perpendicular wobble
        dense = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 3))
            dense += [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) for i in range(n)]
        dense.append(pts[-1])
        p1, p2, f1, f2 = rnd.uniform(0, 6), rnd.uniform(0, 6), rnd.uniform(.02, .04), rnd.uniform(.07, .11)
        self.pts, s = [], 0.0
        for i, (x, y) in enumerate(dense):
            a, b = dense[max(i - 1, 0)], dense[min(i + 1, len(dense) - 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1
            if i: s += math.hypot(x - dense[i - 1][0], y - dense[i - 1][1])
            off = 1.4 * math.sin(s * f1 + p1) + 0.6 * math.sin(s * f2 + p2)
            self.pts.append((x - dy / L * off, y + dx / L * off))

    def bbox(self):
        xs, ys = [p[0] for p in self.pts], [p[1] for p in self.pts]
        return min(xs), min(ys), max(xs), max(ys)

    def draw(self, d, img, t):
        p = ease((t - self.t0) / self.dur)
        if p <= 0: return None
        k = max(2, int(len(self.pts) * p))
        seg = [(x * SS, y * SS) for x, y in self.pts[:k]]
        w = int(self.width * SS)
        d.line(seg, fill=self.color, width=w, joint="curve")
        for x, y in (seg[0], seg[-1]):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=self.color)
        return self.pts[k - 1]

class Text:
    """Text revealed left to right (wipe), as if written."""
    def __init__(self, s, x, y, size, color, t0, dur, anchor="m"):
        self.s, self.size, self.color, self.t0, self.dur = s, size, color, t0, dur
        f = font(size)
        l, tp, r, b = f.getbbox(s)
        self.w, self.h = (r - l) / SS, (b - tp) / SS
        self.x = x - self.w / 2 if anchor == "m" else x     # "m" centre, "l" left edge
        self.y = y - self.h / 2                             # y is vertical centre
        self.layer = Image.new("RGBA", (r - l + 4, b - tp + 4), (0, 0, 0, 0))
        ImageDraw.Draw(self.layer).text((-l + 2, -tp + 2), s, font=f, fill=color)

    def bbox(self):
        return self.x, self.y, self.x + self.w, self.y + self.h

    def draw(self, d, img, t):
        p = min(max((t - self.t0) / self.dur, 0), 1)
        if p <= 0: return None
        cw = max(1, int(self.layer.width * p))
        img.paste(self.layer.crop((0, 0, cw, self.layer.height)),
                  (int(self.x * SS) - 2, int(self.y * SS) - 2), self.layer.crop((0, 0, cw, self.layer.height)))
        bob = 0.25 * self.h * math.sin(t * 40) if p < 1 else 0
        return (self.x + self.w * p, self.y + self.h * 0.75 + bob)

class Fill:
    """Bar that grows upward from its base."""
    def __init__(self, x0, y0, x1, y1, t0, dur, color):
        self.r, self.t0, self.dur, self.color = (x0, y0, x1, y1), t0, dur, color

    def bbox(self):
        return self.r

    def draw(self, d, img, t):
        p = ease((t - self.t0) / self.dur)
        if p <= 0: return None
        x0, y0, x1, y1 = self.r
        top = y1 - (y1 - y0) * p
        d.rectangle([x0 * SS, top * SS, x1 * SS, y1 * SS], fill=self.color)
        return ((x0 + x1) / 2 + (x1 - x0) * 0.3 * math.sin(t * 25), top)

class Scene:
    """Builder: items are placed one after another unless `at` is given."""
    def __init__(self, name):
        self.name, self.items, self.cursor, self._seed = name, [], 0.3, 0
    def _place(self, item_cls, *a, dur, at=None, gap=0.1, **kw):
        t0 = self.cursor if at is None else at
        self._seed += 1
        if item_cls is Stroke: kw["seed"] = self._seed + hash(self.name) % 1000
        it = item_cls(*a, t0=t0, dur=dur, **kw)
        self.items.append(it)
        self.cursor = t0 + dur + gap
        return it
    def stroke(self, pts, dur, color=INK, width=5, at=None, gap=0.1):
        return self._place(Stroke, pts, dur=dur, color=color, width=width, at=at, gap=gap)
    def text(self, s, x, y, size, color=INK, dur=None, anchor="m", at=None, gap=0.15):
        dur = dur or max(0.5, 0.07 * len(s))
        return self._place(Text, s, x, y, size, color, dur=dur, anchor=anchor, at=at, gap=gap)
    def fill(self, x0, y0, x1, y1, dur, color, at=None, gap=0.1):
        return self._place(Fill, x0, y0, x1, y1, dur=dur, color=color, at=at, gap=gap)
    # ---- doodle helpers
    def circle(self, cx, cy, r, dur, color=INK, width=5, bumps=0, at=None):
        pts = []
        for i in range(73):
            a = math.radians(-100 + 368 * i / 72)
            rr = r * (1 + (0.12 * math.sin(bumps * a) if bumps else 0)) * (1 + 0.03 * i / 72)
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        return self.stroke(pts, dur, color, width, at=at)
    def rect(self, x0, y0, x1, y1, dur, color=INK, width=5, at=None):
        return self.stroke([(x0, y0), (x1, y0 + 2), (x1, y1), (x0 + 2, y1), (x0, y0 - 2)], dur, color, width, at=at)
    def arrow(self, x0, y0, x1, y1, dur, color=INK, width=5, at=None):
        self.stroke([(x0, y0), (x1, y1)], dur * 0.7, color, width, at=at, gap=0.02)
        a, L = math.atan2(y1 - y0, x1 - x0), 22
        self.stroke([(x1 - L * math.cos(a - .5), y1 - L * math.sin(a - .5)), (x1, y1),
                     (x1 - L * math.cos(a + .5), y1 - L * math.sin(a + .5))], dur * 0.3, color, width)
    def check(self, x, y, s, dur, color=GREEN, width=8, at=None):
        return self.stroke([(x, y), (x + s * .35, y + s * .4), (x + s, y - s * .55)], dur, color, width, at=at)
    def star(self, cx, cy, r, dur, color=ORANGE, width=5, at=None):
        pts = [(cx + (r if i % 2 == 0 else r * .45) * math.cos(math.radians(-90 + 36 * i)),
                cy + (r if i % 2 == 0 else r * .45) * math.sin(math.radians(-90 + 36 * i))) for i in range(11)]
        return self.stroke(pts, dur, color, width, at=at)
    def person(self, x, y, r, dur, color=INK, at=None):
        """Stick figure; (x, y) = head centre."""
        part = dur / 5
        self.circle(x, y, r, part * 1.4, color, at=at)
        self.stroke([(x, y + r), (x, y + r * 3.2)], part * .6, color)
        self.stroke([(x - r * 1.3, y + r * 2.4), (x, y + r * 1.7), (x + r * 1.3, y + r * 2.4)], part, color)
        self.stroke([(x - r, y + r * 5.2), (x, y + r * 3.2), (x + r, y + r * 5.2)], part, color)

# ---------------------------------------------------------------- scenes
def build_scenes():
    S = []
    # 1 Hook — ink, blue, orange
    s = Scene("Hook")
    s.text("How to Remember Things", 640, 112, 76, INK, dur=1.0)
    s.person(380, 370, 40, 1.0, INK)
    s.circle(450, 312, 8, .2, BLUE, 4); s.circle(492, 282, 13, .25, BLUE, 4)
    s.circle(690, 315, 115, 0.7, BLUE, 6, bumps=7)
    s.text("?", 690, 315, 130, ORANGE, dur=.3)
    s.text("Why do we forget?", 640, 615, 50, BLUE, dur=.8)
    S.append(s)

    # 2 Problem — ink, red, blue
    s = Scene("Problem")
    s.text("Memories fade fast", 640, 105, 66, RED, dur=1.1)
    s.arrow(220, 530, 220, 180, .5, INK)
    s.arrow(220, 530, 1080, 530, .6, INK)
    s.text("100%", 160, 230, 34, INK, dur=.3)
    curve = [(x, 530 - 300 * (0.18 + 0.82 * math.exp(-(x - 230) / 120))) for x in range(230, 1050, 10)]
    s.stroke(curve, 2.3, RED, 7)
    s.text("Day 1", 340, 565, 34, INK, dur=.4)
    s.text("Day 7", 1000, 565, 34, INK, dur=.4)
    s.text("Normal! Your brain needs signals.", 640, 630, 44, BLUE, dur=1.3, at=5.6)
    S.append(s)

    # 3 Idea 1: test yourself — ink, blue, green
    s = Scene("Idea 1")
    s.text("1. Test yourself", 80, 105, 66, BLUE, dur=1.0, anchor="l")
    s.rect(110, 270, 270, 400, .8, INK); s.stroke([(190, 272), (190, 398)], .3, INK)
    s.text("book", 190, 435, 34, INK, dur=.3)
    s.arrow(295, 335, 395, 335, .5, BLUE)
    s.person(470, 285, 32, 1.0, INK)
    s.text("?", 545, 225, 60, BLUE, dur=.3)
    s.arrow(575, 335, 675, 335, .5, BLUE)
    for i, (y, w) in enumerate([(270, 3), (345, 8), (420, 15)]):
        s.text(f"try {i+1}", 710, y, 34, INK, dur=.35, anchor="l")
        s.stroke([(805, y), (900, y - 18), (1000, y + 14), (1100, y - 12), (1180, y)], .8, GREEN, w)
    s.text("Each recall makes the path stronger", 640, 590, 46, GREEN, dur=1.5, at=7.6)
    S.append(s)

    # 4 Idea 2: space it out — ink, green, orange
    s = Scene("Idea 2")
    s.text("2. Space it out", 80, 105, 66, GREEN, dur=1.0, anchor="l")
    s.arrow(90, 330, 620, 330, .8, INK)
    for x, lab in [(140, "Day 1"), (290, "Day 3"), (540, "Day 7")]:
        s.stroke([(x, 315), (x, 345)], .15, INK)
        s.text(lab, x, 380, 34, INK, dur=.35)
        s.check(x - 20, 270, 40, .4, GREEN, 7)
    s.text("remembered", 700, 175, 34, INK, dur=.6, anchor="l", at=4.6)
    s.stroke([(760, 200), (760, 520), (1200, 520)], .7, INK)
    s.fill(810, 420, 930, 518, .8, ORANGE)
    s.text("Cram", 870, 555, 34, INK, dur=.3)
    s.fill(1030, 225, 1150, 518, 1.2, GREEN)
    s.text("Spaced", 1090, 555, 34, INK, dur=.4)
    s.text("Short gaps beat one long cram", 640, 625, 46, ORANGE, dur=1.4, at=8.4)
    S.append(s)

    # 5 Idea 3: link it — ink, orange, blue
    s = Scene("Idea 3")
    s.text("3. Link it", 80, 105, 66, ORANGE, dur=.8, anchor="l")
    s.circle(640, 370, 90, .9, ORANGE, 6)
    s.text("New fact", 640, 370, 38, ORANGE, dur=.5)
    sats = [(290, 270, "Song"), (290, 480, "Place"), (990, 270, "Friend"), (990, 480, "Story")]
    for cx, cy, lab in sats:
        a = math.atan2(cy - 370, cx - 640)
        s.stroke([(640 + 95 * math.cos(a), 370 + 95 * math.sin(a)),
                  (cx - 75 * math.cos(a), cy - 75 * math.sin(a))], .45, INK, 5)
        s.circle(cx, cy, 70, .55, BLUE, 5)
        s.text(lab, cx, cy, 34, BLUE, dur=.35)
    s.text("More links = more ways back", 640, 625, 46, ORANGE, dur=1.4, at=8.6)
    S.append(s)

    # 6 Recap — ink, green, orange
    s = Scene("Recap")
    s.text("Recap", 640, 100, 70, INK, dur=.7)
    for i, (lab, at) in enumerate([("Test yourself", 1.3), ("Space it out", 2.3), ("Link it up", 3.4)]):
        y = 225 + i * 105
        s.check(370, y, 46, .45, GREEN, 9, at=at)
        s.text(lab, 450, y, 58, INK, dur=.7, anchor="l")
    s.star(360, 575, 34, .6, ORANGE, 5, at=7.2)
    s.text("Try one today!", 640, 575, 70, ORANGE, dur=1.2)
    s.star(920, 575, 34, .6, ORANGE, 5)
    S.append(s)
    return S

# ---------------------------------------------------------------- layout check
def check_layout(scenes):
    problems = []
    for sc, (_, target, _) in zip(scenes, NARRATION):
        texts = []
        for it in sc.items:
            if it.t0 + it.dur > target - 0.5:
                problems.append(f"{sc.name}: item ends at {it.t0 + it.dur:.1f}s, scene is {target}s")
            x0, y0, x1, y1 = it.bbox()
            if x0 < MARGIN - 1 or y0 < MARGIN - 1 or x1 > W - MARGIN + 1 or y1 > H - MARGIN + 1:
                problems.append(f"{sc.name}: {type(it).__name__} outside margin {tuple(round(v) for v in (x0, y0, x1, y1))}")
            if isinstance(it, Text):
                if len(it.s.split()) > 8: problems.append(f"{sc.name}: >8 words: {it.s}")
                if it.size < MIN_TEXT: problems.append(f"{sc.name}: text too small: {it.s}")
                for o in texts:
                    a, b = it.bbox(), o.bbox()
                    if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                        problems.append(f"{sc.name}: text overlap '{it.s}' / '{o.s}'")
                texts.append(it)
    return problems

# ---------------------------------------------------------------- pen sprite
def draw_pen(d, tip, color):
    x, y = tip[0] * SS, tip[1] * SS
    a = math.radians(-55)                       # pen leans up-right
    ux, uy = math.cos(a), math.sin(a); px, py = -uy, ux
    def P(along, side): return (x + ux * along * SS + px * side * SS, y + uy * along * SS + py * side * SS)
    d.polygon([P(0, 0), P(16, -7), P(16, 7)], fill=color)                       # nib
    d.polygon([P(16, -9), P(26, -12), P(26, 12), P(16, 9)], fill=(90, 90, 100))   # cone
    d.polygon([P(26, -12), P(118, -12), P(118, 12), P(26, 12)], fill=(245, 245, 245), outline=(60, 60, 70), width=2 * SS)
    d.polygon([P(70, -12), P(92, -12), P(92, 12), P(70, 12)], fill=color)       # label band
    d.polygon([P(118, -13), P(132, -13), P(132, 13), P(118, 13)], fill=color)   # cap end

def render_frame(scene, t):
    img = Image.new("RGB", (W * SS, H * SS), PAPER)
    d = ImageDraw.Draw(img)
    tip, color, latest = None, INK, -1
    for it in scene.items:
        pos = it.draw(d, img, t)
        if pos is not None and it.t0 >= latest:      # pen = most recently started item
            latest, tip, color = it.t0, pos, it.color
    busy_until = max(it.t0 + it.dur for it in scene.items) + 0.4
    if tip is not None and t < busy_until:           # pen leaves once drawing is done
        draw_pen(d, tip, color)
    return img.resize((W, H), Image.LANCZOS)

# ---------------------------------------------------------------- audio
def tts(text, path):
    cmd = [sys.executable, "-m", "piper", "-m", VOICE, "-f", path,
           "--length-scale", str(LENGTH_SCALE), "--sentence-silence", "0.25"]
    subprocess.run(cmd, input=text.encode(), check=True, capture_output=True)
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        if w.getframerate() != SR:
            n = int(len(a) * SR / w.getframerate())
            a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a)
    if np.sqrt((a ** 2).mean()) < 0.01:
        raise RuntimeError("TTS produced silence")
    return a

def scratch(n, rng):
    noise = rng.standard_normal(n).astype(np.float32)
    hp = np.diff(noise, prepend=0)                                  # brighter, papery
    env = 0.6 + 0.4 * np.abs(np.sin(np.arange(n) / SR * 2 * np.pi * rng.uniform(5, 9)))
    return hp * env

def chime(sr=SR):
    t = np.arange(int(1.6 * sr)) / sr
    return (np.sin(2 * np.pi * 880 * t) + 0.6 * np.sin(2 * np.pi * 1320 * t) + 0.3 * np.sin(2 * np.pi * 1760 * t)) \
        * np.exp(-t * 3.0) * 0.25

# ---------------------------------------------------------------- main
def main():
    os.makedirs(WORK, exist_ok=True)
    scenes = build_scenes()
    probs = check_layout(scenes)
    for p in probs: print("LAYOUT:", p)

    # narration -> scene durations
    voice, voices = True, []
    for i, (name, target, line) in enumerate(NARRATION):
        try:
            voices.append(tts(line, os.path.join(WORK, f"vo_{i}.wav")))
        except Exception as e:
            print("No TTS voice available:", e); voice = False; break
    durs = []
    for i, (name, target, line) in enumerate(NARRATION):
        need = (len(voices[i]) / SR + 0.3 + 0.5) if voice else 0
        durs.append(max(target, round(need * FPS) / FPS))
    if not voice:
        # burn captions in (max 8 words per line), two lines at bottom
        for sc, (_, _, line) in zip(scenes, NARRATION):
            words = line.split(); lines = [" ".join(words[k:k + 8]) for k in range(0, len(words), 8)]
            sc.captions = lines
    print("Scene durations:", durs, "total", sum(durs))

    # video frames -> ffmpeg pipe
    total_frames = sum(int(round(d * FPS)) for d in durs)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium",
                           "-crf", "20", "-pix_fmt", "yuv420p", os.path.join(WORK, "video.mp4")], stdin=subprocess.PIPE)
    cap_font = ImageFont.truetype(FONT_FILE, 30)
    n = 0
    for sc, dur in zip(scenes, durs):
        for f in range(int(round(dur * FPS))):
            t = f / FPS
            img = render_frame(sc, t)
            if not voice:
                cd = ImageDraw.Draw(img)
                k = min(len(sc.captions) - 1, int(t / dur * len(sc.captions)))
                cd.rectangle([60, 655, 1220, 700], fill=(235, 232, 222))
                cd.text((640, 677), sc.captions[k], font=cap_font, fill=INK, anchor="mm")
            ff.stdin.write(img.tobytes()); n += 1
        print(f"  rendered {sc.name}")
    ff.stdin.close(); ff.wait()

    # audio mix
    rng = np.random.default_rng(1)
    audio = np.zeros(int(sum(durs) * SR) + SR, np.float32)
    start = 0.0
    for i, (sc, dur) in enumerate(zip(scenes, durs)):
        for it in sc.items:                                  # soft marker scratch while drawing
            a, b = int((start + it.t0) * SR), int((start + it.t0 + it.dur) * SR)
            if b > a:
                seg = scratch(b - a, rng) * np.hanning(b - a).astype(np.float32)
                audio[a:b] += seg * (0.012 if voice else 0.035)
        if voice:
            a = int((start + 0.3) * SR); v = voices[i]
            audio[a:a + len(v)] += v * 0.9
        start += dur
    c = chime(); a = int((sum(durs) - 1.5) * SR)
    audio[a:a + len(c)] += c[:len(audio) - a]
    audio = audio[:int(sum(durs) * SR)]
    audio /= max(1.0, np.abs(audio).max() / 0.95)
    with wave.open(os.path.join(WORK, "audio.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((audio * 32767).astype(np.int16).tobytes())

    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(WORK, "video.mp4"),
                    "-i", os.path.join(WORK, "audio.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                    "-ar", "44100", "-shortest", "-movflags", "+faststart", OUT], check=True)
    print("VOICE:", "yes (Piper)" if voice else "NO - captions + scratch sounds only")
    print("Wrote", OUT, f"({n} frames)")

if __name__ == "__main__":
    main()
