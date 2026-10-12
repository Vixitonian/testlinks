# apprelab.com — 20-second whiteboard pitch (first principles)

A hand-drawn explainer pitching **apprelab.com** to a potential mentor, built in the
first-principles shape: *question → problem → principle → how the product applies it → proof → ask*.

## Deliverables

| File | What it is |
|---|---|
| `apprelab-pitch.mp4` | The finished 23 s video, 1920×1080, hand + marker + real narration |
| `apprelab-pitch.html` | Scrubbable page it is rendered from (open in a browser, press Play) |
| `apprelab-pitch.srt` | Captions matching the narration |
| `qa/contact_sheet.png`, `qa/b0*_*.png` | QA frames (two per beat) |
| `audio/narration.mp3`, `audio/timings.json` | Narration and the per-beat timings the page uses |

## The 6 beats (narration word for word)

| # | Line | Drawing |
|---|---|---|
| 1 | "Mentor, how does anyone really learn a skill? Not by watching." | headline + film icon, thinking stickman |
| 2 | "Finish the video, and nothing gets built." | film crossed out, empty box, "nothing built" |
| 3 | "First principle: skill comes from doing." | board wiped, headline written big |
| 4 | "So every Apprelab lesson ends in a real task." | clock + pencil icons, "3-7 min" → "a real task" |
| 5 | "AI grades it in seconds. Pass all, earn a verified badge." | chat + yellow badge icon (brand accent), "verified badge" |
| 6 | "That's apprelab.com. Will you mentor the next cohort?" | real apprelab logo (navy/yellow), URL, the ask |

Facts and visuals come from the live site: tagline *"practical online courses with real tasks and
verified badges"*, 3–7 minute lessons, AI feedback in seconds, verified badges, and the real
icon (`brand/apprelab-512.png`, navy `#010A45` + yellow, white "a" under a hard hat).

## Re-render it

```bash
python3 build_page.py                     # page from template + scene + timings + font + logo
node qa.js apprelab-pitch.html qa         # overlaps, margins, overruns -> qa/report.json
NODE_PATH=/home/deploy/.npm-global/lib/node_modules \
  node export.js apprelab-pitch.html apprelab-pitch.mp4 \
  --audio audio/narration.mp3 --captions apprelab-pitch.srt --workers 4
```

Change the words in `beats.json`, then `python3 make_audio.py beats.json audio --engine piper --gap .35 --lead .4`
(piper voice `en_US-ryan-medium`; `edge_tts` also works when the service is up) and re-run the steps above.

## Notes / limits

- Narration is a synthetic US voice (piper `en_US-ryan-medium`); edge-tts was unavailable when this was made.
- Beat 4 starts drawing ~0.6 s before its line on purpose, so the last stroke lands before the
  narration moves on. QA (`qa.js`) reports 0 overlaps, 0 errors, 0 overruns at the committed revision.
