#!/usr/bin/env python3
"""Marker-hand sprite for the Apprelab whiteboard animation.

Flat whiteboard-explainer style: the marker is drawn complete and in front of the
hand, so there is never any doubt what is being held. A fist blob sits behind the
barrel with four finger pads wrapping over its near edge and a stubby thumb
crossing lower down; the arm runs off to the right into a sleeve that fades out.
TIP (rotation centre used by render.py) is the marker's nib.
"""
import math, os, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SPRITE = (1500, 1500)
TIP = (750, 780)


def load(path):
    """Return the hand sprite as RGBA (regenerating it if missing)."""
    if not os.path.exists(path):
        make_hand(path)
    return Image.open(path).convert("RGBA")
ANGLE = -58.0
LW = 8

SKIN, SKIN_D = (246, 208, 171), (205, 152, 110)
MARK, MARK_L, MARK_D, NIB = (40, 42, 47), (112, 116, 122), (24, 26, 30), (88, 90, 94)
RED, SLEEVE, SLEEVE_D = (226, 72, 61), (48, 96, 240), (28, 60, 174)

_u = (math.cos(math.radians(ANGLE)), math.sin(math.radians(ANGLE)))
_n = (-_u[1], _u[0])
P = lambda a, q=0.0: (TIP[0] + _u[0] * a + _n[0] * q, TIP[1] + _u[1] * a + _n[1] * q)
_wa = math.radians(ANGLE + 40)
WR = (math.cos(_wa), math.sin(_wa))
PA = (WR[1], -WR[0])


def _poly(d, pts, fill, outline=None, w=LW):
    d.polygon(pts, fill=fill, outline=outline, width=w if outline else 1)


def _caps(d, p0, p1, w, fill, outline=None):
    if outline:
        d.line([p0, p1], fill=outline, width=int(w + 2 * LW), joint="curve")
        for p in (p0, p1):
            r = (w + 2 * LW) / 2
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=outline)
    d.line([p0, p1], fill=fill, width=int(w), joint="curve")
    for p in (p0, p1):
        r = w / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill)


def _blob(cx, cy, ra, rb, ang_deg, n=96, wob=0.05):
    ca, sa = math.cos(math.radians(ang_deg)), math.sin(math.radians(ang_deg))
    out = []
    for k in range(n):
        t = 2 * math.pi * k / n
        r = 1.0 + wob * math.cos(3 * t + 0.5) + 0.03 * math.cos(5 * t + 2.1)
        ex, ey = ra * r * math.cos(t), rb * r * math.sin(t)
        out.append((cx + ex * ca - ey * sa, cy + ex * sa + ey * ca))
    return out


def make_hand(path):
    img = Image.new("RGBA", SPRITE, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # --- arm then sleeve, both behind the hand ---
    wrist = P(330, 60)
    _caps(d, (wrist[0] - WR[0] * 70, wrist[1] - WR[1] * 70),
          (wrist[0] + WR[0] * 150, wrist[1] + WR[1] * 150), 124, SKIN, SKIN_D)
    s0 = (wrist[0] + WR[0] * 40, wrist[1] + WR[1] * 40)
    s1 = (wrist[0] + WR[0] * 430, wrist[1] + WR[1] * 430)
    sl = Image.new("RGBA", SPRITE, (0, 0, 0, 0)); sd = ImageDraw.Draw(sl)
    quad = lambda p, hw: [(p[0] + PA[0] * hw, p[1] + PA[1] * hw), (p[0] - PA[0] * hw, p[1] - PA[1] * hw)]
    sd.polygon(quad(s0, 72) + quad(s1, 68)[::-1], fill=SLEEVE)
    c0 = (s0[0] + WR[0] * 130, s0[1] + WR[1] * 130)
    c1 = (s0[0] + WR[0] * 185, s0[1] + WR[1] * 185)
    sd.polygon(quad(c0, 73) + quad(c1, 71)[::-1], fill=SLEEVE_D)
    arr = np.asarray(sl).astype(np.float32)
    xs, ys = np.meshgrid(np.arange(SPRITE[0]), np.arange(SPRITE[1]))
    s = (xs - s0[0]) * WR[0] + (ys - s0[1]) * WR[1]
    arr[..., 3] *= np.clip((370.0 - s) / 130.0, 0.0, 1.0)
    img.alpha_composite(Image.fromarray(arr.astype(np.uint8)))

    # --- fist behind the barrel ---
    hc = P(300, 96)
    _poly(d, _blob(hc[0], hc[1], 132, 104, ANGLE, wob=0.06), SKIN, SKIN_D)

    # --- marker, complete and in front of the fist ---
    d.polygon([P(0, -8), P(0, 8), P(38, 16), P(38, -16)], fill=(64, 66, 70))
    d.polygon([P(14, -9), P(14, 9), P(38, 16), P(38, -16)], fill=NIB)
    _poly(d, [P(34, -16), P(120, -24), P(430, -24), P(468, -21),
              P(468, 21), P(430, 24), P(120, 24), P(34, 16)], MARK, MARK_D, 4)
    d.line([P(72, -14), P(424, -14)], fill=MARK_L, width=8)
    d.line([P(72, 16), P(424, 16)], fill=MARK_D, width=7)
    _poly(d, [P(388, -25), P(430, -25), P(430, 25), P(388, 25)], RED)
    _poly(d, [P(430, -23), P(462, -21), P(468, -14), P(468, 14), P(462, 21), P(430, 23)], (26, 28, 32))

    # --- four finger pads wrapping over the barrel's near edge ---
    for i, a in enumerate((196, 252, 308, 362)):
        c = P(a, 12)
        r = 30 - i * 2
        d.polygon(_blob(c[0], c[1], r, r * 0.9, ANGLE + 90, n=48, wob=0.02), SKIN, SKIN_D)

    # --- stubby thumb crossing the barrel lower down ---
    _caps(d, P(112, 62), P(196, 34), 64, SKIN, SKIN_D)
    d.line([P(130, 96), P(196, 62)], fill=(0, 0, 0, 0), width=1)

    sh = Image.new("RGBA", SPRITE, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 50), (0, 0), img.split()[3])
    out = Image.new("RGBA", SPRITE, (0, 0, 0, 0))
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(16)), (14, 18))
    out.alpha_composite(img)
    out.save(path)
    return out


if __name__ == "__main__":
    tgt = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "hand.png")
    make_hand(tgt)
    im = Image.open(tgt).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    bg.convert("RGB").crop((690, 330, 1500, 900)).resize((810, 570)).save("build/hand_preview.png")
    print("hand sprite ->", tgt, im.size)
