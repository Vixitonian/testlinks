#!/usr/bin/env python3
"""Build a beat-synced narration track for the Apprelab whiteboard pitch.

Synthesises each sentence separately with piper (offline), squeezes/stretches it
to a target length so the whole voice-over fits a 10 s cut, then lays the clips
on a 48 kHz stereo timeline and writes build/narration.wav + build/times.json.
"""
import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
A = lambda *p: os.path.join(ROOT, *p)
SR = 48000
DUR = 10.0
VOICE = A("assets", "voices", "en_US-ryan-high.onnx")

# (id, text, target seconds)
SEGS = [
    ("A", "Apprelab teaches digital skills in short lessons.", 2.50),
    ("B", "Every lesson ends with a real task and instant AI feedback.", 3.90),
    ("C", "I'd love your mentorship to help us scale.", 2.80),
]
START, GAP = 0.25, 0.10


def synth(text, length_scale, out):
    cmd = [sys.executable, "-m", "piper", "-m", VOICE, "-f", out,
           "--length-scale", f"{length_scale:.3f}"]
    p = subprocess.run(cmd, input=text.encode(), capture_output=True)
    if p.returncode != 0 or not os.path.exists(out):
        raise SystemExit("piper failed: " + p.stderr.decode()[-300:])


def read_wav(path):
    with wave.open(path) as w:
        n, ch = w.getnframes(), w.getnchannels()
        data = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
        rate = w.getframerate()
    if ch == 2:
        data = data.reshape(-1, 2).mean(axis=1)
    return data, rate


def fit(text, target, tag):
    """Synth once, then re-synth with a corrected length-scale to hit `target`."""
    tmp = A("build", f"seg_{tag}_0.wav")
    synth(text, 1.0, tmp)
    data, rate = read_wav(tmp)
    got = len(data) / rate
    ls = min(1.75, max(0.62, target / got))
    tmp2 = A("build", f"seg_{tag}.wav")
    synth(text, ls, tmp2)
    data, rate = read_wav(tmp2)
    # one correction pass: piper's ls->duration mapping is close to linear but not exact
    got2 = len(data) / rate
    if abs(got2 - target) > 0.06:
        ls2 = min(1.75, max(0.62, ls * target / got2))
        synth(text, ls2, tmp2)
        data, rate = read_wav(tmp2)
        ls = ls2
    return data, rate, ls


def place(track, data, rate, at):
    idx = int(round(at * SR))
    n = len(data)
    if idx + n > len(track):
        n = len(track) - idx
        data = data[:n]
    # gentle 20 ms fades so cuts never click
    f = min(int(0.02 * SR), n // 4)
    if f:
        ramp = np.linspace(0, 1, f, dtype=np.float32)
        data = data.copy()
        data[:f] *= ramp
        data[-f:] *= ramp[::-1]
    track[idx:idx + n] += data
    return at + n / SR


def main():
    os.makedirs(A("build"), exist_ok=True)
    track = np.zeros(int(SR * DUR), dtype=np.float32)
    times, t = {}, START
    for tag, text, target in SEGS:
        data, rate, ls = fit(text, target, tag)
        if rate != SR:
            data = np.interp(np.linspace(0, 1, int(len(data) * SR / rate), endpoint=False),
                             np.linspace(0, 1, len(data), endpoint=False), data)
        end = place(track, data, SR, t)
        times[tag] = [round(t, 3), round(end, 3)]
        print(f"{tag}: target {target:.2f}s  got {end - t:.2f}s  (ls={ls:.2f})")
        t = end + GAP

    peak = float(np.max(np.abs(track))) or 1.0
    track *= 0.89 / peak
    pcm = (np.clip(track, -1, 1) * 32767).astype("<i2")
    stereo = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(A("build", "narration.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(stereo.tobytes())

    times["_end"] = round(t - GAP, 3)
    json.dump(times, open(A("build", "times.json"), "w"), indent=1)
    print("speech ends at", times["_end"], "s -> fits" if times["_end"] <= DUR else "TOO LONG")


if __name__ == "__main__":
    main()
