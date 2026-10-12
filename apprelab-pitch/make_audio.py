#!/usr/bin/env python3
"""make_audio.py beats.json OUT_DIR [--engine auto|supabein|edge|piper|espeak|none] [--voice V] [--rate +0%] [--gap 0.5] [--lead 0.5] [--split recording.mp3]

beats.json: qa.js output [{start,end,text}] or a plain list of strings.
Per-beat clips are looked up as OUT_DIR/b00.mp3 (.wav .m4a .ogg), so user recordings and any TTS output work.
Cascade for missing clips: supabein (only if env SUPABEIN_TOKEN is set) -> edge-tts -> piper (needs PIPER_MODEL=/path/model.onnx) -> espeak-ng (robotic, draft only).
Nothing available (usual in a sandbox: no network): writes narration_script.txt + narration.srt to paste into any
external TTS, exits 3. --split: ONE long recording -> beat windows by silence detection (approximate).
Success: narration.mp3 + timings.json ([{start,end,text}] -> paste into TIMINGS, set AUDIO_SRC).
ffmpeg is found on PATH, in $FFMPEG, or in the imageio-ffmpeg package (pip install imageio-ffmpeg). ffprobe is not needed."""
import json, os, re, shutil, subprocess, sys, time, urllib.request, urllib.parse, urllib.error
BR = os.environ.get("AUDIO_BITRATE", "96k")   # use 64k for narrations over 5 minutes

def _ffmpeg():
    p = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if p: return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None
FF = _ffmpeg()
if not FF: sys.exit("ffmpeg not found: pip install imageio-ffmpeg (or set FFMPEG=/path/to/ffmpeg)")

def sh(cmd, **k): return subprocess.run(cmd, capture_output=True, text=True, **k)
def dur(p):
    """Length in seconds, read from `ffmpeg -i` (so ffprobe is not needed)."""
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", sh([FF, "-hide_banner", "-i", p]).stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
def srt_t(t):
    ms = int(round(t * 1000)); return f"{ms//3600000:02d}:{ms%3600000//60000:02d}:{ms%60000//1000:02d},{ms%1000:03d}"
def find(d, i):
    for e in (".mp3", ".wav", ".m4a", ".ogg"):
        p = os.path.join(d, f"b{i:02d}{e}")
        if os.path.exists(p): return p

def speak(text):
    """Respell for the voice only (captions keep the original text): Apprelab.com -> Apprelab dot com."""
    return re.sub(r"\b([A-Za-z0-9-]+)\.(com|org|net|io|ng)\b", r"\1 dot \2", text)

def supabein(text, path, voice=None):
    """POST to the Supabein TTS API as its docs describe (https://supabein.dxinnovationhub.com/tts/docs).
    Token comes ONLY from env SUPABEIN_TOKEN and is masked in every message. Voice: env SUPABEIN_VOICE, else --voice, else the API default."""
    tok = os.environ.get("SUPABEIN_TOKEN")
    if not tok: return False
    url = os.environ.get("SUPABEIN_URL", "https://supabein.dxinnovationhub.com/tts/speak")
    if len(text) > 5000: print("WARNING: beat is", len(text), "characters; the API limit is 5000, split it"); return False
    form = {"text": speak(text), "token": tok}
    v = os.environ.get("SUPABEIN_VOICE") or voice
    if v: form["voice"] = v
    mask = lambda m: str(m).replace(tok, "***").replace(urllib.parse.quote(tok), "***")[:200]
    for attempt in (1, 2, 3):
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode(form).encode(), headers={"User-Agent": "whiteboard-skill"})
            with urllib.request.urlopen(req, timeout=90) as r: data = r.read()
            raw = path + ".raw"; open(raw, "wb").write(data)
            ok = len(data) > 500 and dur(raw) > 0
            if ok: ok = sh([FF, "-y", "-loglevel", "error", "-i", raw, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", BR, path]).returncode == 0
            os.remove(raw)
            if ok and os.path.getsize(path) > 500: return True
            print("supabein: reply was not playable audio. First bytes:", mask(data[:200])); return False
        except urllib.error.HTTPError as e:
            body = mask(e.read()[:200])
            if e.code == 401: print("supabein: 401, the token is wrong or missing. Ask the user for a valid token."); return False
            if e.code == 400: print("supabein: 400, bad request (empty or too-long text, or unknown voice; check /tts/voices.json):", body); return False
            print("supabein: HTTP %d (try %d): %s" % (e.code, attempt, body)); time.sleep(5 * attempt)
        except Exception as e:
            print("supabein error (try %d):" % attempt, type(e).__name__, mask(e)); time.sleep(5 * attempt)
    return False

def synth(engine, text, voice, rate, path):
    if engine == "supabein": return supabein(text, path, voice if voice != "en-US-AriaNeural" else None)
    if engine == "edge":
        exe = [shutil.which("edge-tts")] if shutil.which("edge-tts") else [sys.executable, "-m", "edge_tts"]
        r = sh(exe + ["--voice", voice, "--rate", rate, "--text", text, "--write-media", path], timeout=90)
    elif engine == "piper":
        m = os.environ.get("PIPER_MODEL")
        if not m: return False
        exe = [shutil.which("piper")] if shutil.which("piper") else [sys.executable, "-m", "piper"]
        r = subprocess.run(exe + ["-m", m, "--length-scale", os.environ.get("PIPER_LENGTH", "1.15"), "-f", path], input=text, capture_output=True, text=True, timeout=120)
    elif engine == "espeak":
        if not shutil.which("espeak-ng"): return False
        r = sh(["espeak-ng", "-v", "en", "-s", "150", "-w", path, text])
    else: return False
    return r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 500

def script_files(d, beats, texts):
    est, t = [], 0.0
    for i, x in enumerate(texts):
        s, e = (beats[i]["start"], beats[i]["end"]) if isinstance(beats[i], dict) and "start" in beats[i] else (t, t + len(x.split()) / 2.4 * 1.15 + 0.8)
        est.append((s, e, x)); t = e + 0.4
    with open(os.path.join(d, "narration.srt"), "w") as f:
        for i, (s, e, x) in enumerate(est): f.write(f"{i+1}\n{srt_t(s)} --> {srt_t(e)}\n{x}\n\n")
    with open(os.path.join(d, "narration_script.txt"), "w") as f:
        for i, (s, e, x) in enumerate(est):
            f.write(f"[BEAT {i+1:02d}  {int(s//60)}:{s%60:04.1f} - {int(e//60)}:{e%60:04.1f}]\n" + "\n".join(re.findall(r"[^.!?]+[.!?]*", x)) + "\n\n")

def stitch(d, files, texts, gap, lead):
    parts, timings, t = [], [], 0.0
    sil = lambda s, p: sh([FF, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", str(s), "-sample_fmt", "s16", p])
    sil(lead, os.path.join(d, "_lead.wav")); sil(gap, os.path.join(d, "_gap.wav"))
    for i, (f, x) in enumerate(zip(files, texts)):
        w = os.path.join(d, f"_n{i:02d}.wav"); sh([FF, "-y", "-loglevel", "error", "-i", f, "-ar", "44100", "-ac", "1", "-sample_fmt", "s16", w])
        sp = dur(w); timings.append({"start": round(t, 3), "end": round(t + lead + sp + gap, 3), "text": x}); parts.append(w); t += lead + sp + gap
    ab = lambda p: os.path.abspath(p)
    with open(os.path.join(d, "_list.txt"), "w") as L:
        for w in parts: L.write(f"file '{ab(os.path.join(d, '_lead.wav'))}'\nfile '{ab(w)}'\nfile '{ab(os.path.join(d, '_gap.wav'))}'\n")
    sh([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(d, "_list.txt"), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "libmp3lame", "-b:a", BR, os.path.join(d, "narration.mp3")])
    return timings, t

def split_recording(d, src, texts, gap):
    total = dur(src); r = sh([FF, "-i", src, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"])
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    gaps = [(b - a, (a + b) / 2) for a, b in zip(st, en) if a > .3 and b < total - .3]; need = len(texts) - 1
    if len(gaps) >= need: cuts = sorted(m for _, m in sorted(gaps, reverse=True)[:need])
    else:
        print(f"WARNING: found {len(gaps)} pauses for {need} beat gaps; falling back to word-count proportions (approximate)")
        w = [len(x.split()) for x in texts]; cuts, acc = [], 0
        for k in w[:-1]: acc += k; cuts.append(total * acc / sum(w))
    edges = [0.0] + cuts + [total + gap]
    sh([FF, "-y", "-loglevel", "error", "-i", src, "-c:a", "libmp3lame", "-b:a", BR, os.path.join(d, "narration.mp3")])
    return [{"start": round(edges[i], 3), "end": round(edges[i + 1], 3), "text": x} for i, x in enumerate(texts)]

def main():
    a = sys.argv[1:]; opt = lambda k, df=None: a[a.index("--" + k) + 1] if "--" + k in a else df
    beats = json.load(open(a[0])); d = a[1]; os.makedirs(d, exist_ok=True)
    texts = [b["text"] if isinstance(b, dict) else b for b in beats]
    eng, voice, rate, gap, lead = opt("engine", "auto"), opt("voice", "en-US-AriaNeural"), opt("rate", "+0%"), float(opt("gap", .5)), float(opt("lead", .5))
    if opt("split"):
        timings = split_recording(d, opt("split"), texts, gap)
    else:
        files = [find(d, i) for i in range(len(texts))]
        if not all(files):
            order = ((["supabein"] if os.environ.get("SUPABEIN_TOKEN") else []) + ["edge", "piper", "espeak"]) if eng == "auto" else [eng]
            for e in order:
                made = []
                for i, x in enumerate(texts):
                    if files[i]: continue
                    p = os.path.join(d, f"b{i:02d}.{'mp3' if e in ('edge', 'supabein') else 'wav'}")
                    if synth(e, x, voice, rate, p): made.append((i, p))
                    else: break
                else:
                    for i, p in made: files[i] = p
                    print("audio engine:", e, "(espeak is robotic: use for timing drafts only)" if e == "espeak" else ""); break
                for i, p in made:
                    if os.path.exists(p): os.remove(p)
        if not all(files):
            script_files(d, beats, texts)
            print("NO AUDIO ENGINE AVAILABLE. Wrote narration_script.txt and narration.srt in", d)
            print("Paste the script into an external TTS, then either save one clip per beat as b00.mp3, b01.mp3 ... in", d, "and re-run, or re-run with --split recording.mp3")
            sys.exit(3)
        timings, _ = stitch(d, files, texts, gap, lead)
    json.dump(timings, open(os.path.join(d, "timings.json"), "w"), indent=1)
    print("wrote narration.mp3 + timings.json:", len(timings), "beats,", round(timings[-1]["end"], 1), "s")

if __name__ == "__main__": main()
