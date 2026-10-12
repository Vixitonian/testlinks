# Apprelab whiteboard pitch (10 s)

Hand-drawn style whiteboard animation pitching **apprelab.com** to a potential mentor.
1920x1080, 30 fps, exactly 10.00 s, with voice-over.

## Result
`out/apprelab-whiteboard-pitch-10s.mp4`

## How it is built
| File | What it does |
|---|---|
| `make_audio.py` | Synthesises the narration with piper (offline TTS), squeezes each sentence to a target length so the whole read fits 10 s, writes `build/narration.wav` + `build/times.json` (beat times). |
| `hand.py` | Draws the marker-hand sprite (`assets/hand.png`). Nib is at `TIP`, which render.py uses as the rotation centre. |
| `render.py` | Builds the scene, writes ink progressively and pipes 300 raw frames into ffmpeg, then muxes the narration. |
| `assets/*.ttf` | Handwriting fonts (Permanent Marker, Patrick Hand, Architects Daughter, Google Fonts). |

## Rebuild
```bash
python3 -m piper.download_voices en_US-ryan-high --data-dir assets/voices   # once, ~110 MB (git-ignored)
python3 make_audio.py    # narration + beat times
python3 hand.py          # regenerates the hand sprite (only if hand.py changed)
python3 render.py        # 300 frames -> out/*.mp4
```

## Notes
- `edge-tts` is blocked from this server (HTTP 403), so narration uses **piper** (offline, en_US-ryan-high).
- Beats come from measured audio lengths, so editing narration re-times the drawing automatically.
