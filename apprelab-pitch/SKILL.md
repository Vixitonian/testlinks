---
name: whiteboard-animation
description: Whiteboard, doodle, hand-drawn explainer, animated pitch, lesson, kids' explainer or vertical short, delivered as a narrated MP4 plus the scrubbable HTML+SVG page it is rendered from. Story and narration first, voice generated per beat BEFORE drawing, a real hand and pen, handwritten text, stickman, stickers, real logos and photos revealed stroke by stroke, loose "talking and sketching" layouts, QA of every scene. Use whenever the user asks for a whiteboard animation, doodle video, sketch explainer, animated storyboard, marketing or pitch video, a lesson drawn on screen, or an MP4 of any of these, even if they never say "whiteboard".
---

# Whiteboard animation (kit + playbook)

The kit is in `{KIT}`: `template.html` (engine, hand, stickman, 40 stickers, camera, captions, controls, layout check), `make_audio.py` (voice per beat), `qa.js` (screenshots + layout report), `export.js` (frame-exact MP4), `prep_asset.py` (logo/photo -> data URI), `embed_font.py`. Copy what you need into the project; never edit the kit itself.

## 0. Why the rules are what they are
| Truth | So |
|---|---|
| People remember stories, not feature lists | Write the narration FIRST, as a story with an end in mind. Pictures serve the words. |
| The voice already says the sentence | The picture adds what words cannot: relationship, scale, a face, an example. Never caption yourself. |
| Real whiteboards have no grid | Loose layouts where the idea is a story, organized where it is a structure (section 3). Never legibility-breaking. |
| The pen is the pointer | Tip exactly on the ink; the hand never covers what was just written. |
| Sync is cheapest when audio is the clock | Generate per-beat audio first, then draw inside each clip's real window. |
| A video bakes in what the renderer saw | Embed the handwriting font before QA and export, or the MP4 shows a serif. |
| A token is a password | Use it only as an environment variable for one command; never in a file, the HTML, a log, a QA report or the reply. |
| People share videos | Default deliverable = MP4 (plus the HTML). HTML only if export cannot run, and say exactly why. |
| Measured is not beautiful | Duration and bounding boxes pass while the composition is bad. Review every scene with `view_image`. |

## 1. Workflow (in order)
1. **Brief.** Subject, audience, length (10 s = about 25 words; 30 s = 70; 60 s = 140; 90 s = 200; 3 min = 430 at 2.4 words/s), 16:9 or 9:16, brand colors/logo, call to action. Topic only? State assumptions in one line and go. Use names and URLs EXACTLY as the user typed them; never "correct" a spelling.
2. **Research (2 minutes).** `web_fetch` the real site: what it is in one line, who it is for, 2 to 3 real numbers or claims, brand colors (hex from the CSS or theme-color), the logo URL. Ask for logos and photos you cannot fetch; never guess them.
3. **End state.** One sentence: "After this the viewer will know / feel / do ____."
4. **Narration** (section 2), read aloud before any drawing. Approved script from the user? Use it as is.
5. **Beat sheet** (`storyboard.md`): per beat the narration (22 to 35 words, fewer for short videos), what is drawn (3 to 7 things), mode (organized/loose), assets, camera. A picture is an icon, sketch, figure or real image, never only a bullet list.
6. **Voice first** (section 6): write the exact beat strings to `beats.json`, run `make_audio.py`, get `narration.mp3` + `timings.json`.
7. **Build** from `{KIT}/template.html`: set `TIMINGS` and `AUDIO_SRC`, then `beat(text)` + draw. The `beat()` strings must equal `beats.json`, same order and count. Never type times by hand.
8. **Embed the font** (`embed_font.py page.html`, needs network once), then **QA**: `node qa.js page.html qa`, view `qa/contact_sheet.png` AND the key frames with `view_image` asking "balanced? anything overlapping, cut off, hidden under the hand, or empty?". Fix everything, at most 3 rounds.
9. **Export** (section 7): capability check, 2-second slice test, then the full run in the background.
10. **Deliver**: the MP4 path, the final frame as a PNG (so it shows in the chat), the HTML path, a three-line summary of the story, and an honest "Not verified" (you cannot hear the voice or watch it on a phone). Branch requested? One branch, the name the user gave; delete any stray one; `.gitignore` for scratch.

## 2. Narration first: story, not script
Aim: the viewer leans in, understands, remembers, acts. Arc (shares scale with length):
| Part | Share | Job |
|---|---|---|
| Hook | 8-10% | A person in a moment, or a question the viewer already has. |
| Tension | 15-20% | What is broken, with ONE concrete number or example. |
| Turn | 15% | The single insight, in a sentence a child could repeat. |
| Build | 40-45% | 2 to 4 steps of how it works; one running character or example. |
| Proof | 10% | A real result, a before/after, a small scene of it working. |
| Action | 8-10% | One concrete first step; the name or address spoken; callback to the hook. |
For a 10 second pitch compress to four beats: hook/problem, solution, proof with a real number, ask.
Rules: sentences of 14 words or fewer, vary the length, contractions, "you" and "we", concrete nouns and numbers, no jargon, one idea per beat. Name a character (a person or mascot) and keep them through the piece. Use contrast, a direct question, a small surprise, one callback. Kids: shorter, sound words ("Boom!"), repetition, a question they can answer aloud. Write for TTS: "Apprelab.com", numbers as spoken ("forty hours"), no symbols. Board text is 1 to 4 words; the voice carries the sentences. Tests: read aloud at pace; close your eyes (does it still make sense?); could each beat be one drawn scene?

## 3. Visual language: spine and scatter
| Content | Mode | How |
|---|---|---|
| Sequence, process, loop | Organized | row/column/snake, arrows, equal spacing, icon + 1 to 3 words |
| Comparison | Organized | two zones split by a drawn line, same-size objects |
| Story, metaphor, example, emotion | Loose | hero object large, placed by meaning, satellites via `put()`/`spot()`, doodle marks in gaps, tilt up to 3 degrees |
| Key point | Contrast | one object 2 to 3 times bigger, ringed, the rest quiet |
Every beat: one deliberate anchor (headline, hero, or character) + up to 3 spontaneous marks + whitespace. Vary headline position and tilt between beats. Use the whole frame: nothing more than 40 percent empty. Clear the board between beats (`{wipe:true}`) instead of stacking. Once per video do something human (scribble-out, quick re-draw). Colors: up to 4 accents with fixed meanings (red problem, green solution, blue the thing/brand, amber emphasis), or the brand's colors; never pure black or white. Layout guard rails (QA enforces): text 60 px from the edges, nothing in the bottom 140 px caption zone, no text/text, text/picture or stroke/text collisions, 2 text blocks per vertical band, arrows never touch text, the call to action is the largest element at the end with clear space around it.
Stickman: `figure(x,y,height,{color,expr})`, poses stand/wave/point/think/cheer/shrug/walk, expressions smile/sad/open/flat; `f.pose('cheer',{expr:'open'})`, `f.go(x,y,seconds)`, `bubble(text,cx,cy,{tail})`. One or two characters, match the face to the sentence.
Real images: `pic(name,cx,cy,width,{frame:'polaroid'|'tape'|'none'|'sticker',style:'poster'})`, 1 to 2 per beat with a handwritten label and an arrow or ring. All images are embedded as data URIs (`prep_asset.py logo.png --out logo.txt`, under 300 KB each, 4 MB total); no hotlinks. No logo? Write the name as a handwritten wordmark with `Wr()`.

## 4. The hand and pen (built into the engine; keep it that way)
Tip is the origin; text is written along its baseline; the hand leans with motion, lifts when travelling, parks bottom-right, never sits over the title. Tools: `tool('marker'|'pen'|'pencil'|'chalk'|'eraser')`. Hand size 8 to 12 percent of the board height (`KIT.handScale`). Pacing: quick, quick, slow; hand travel 0.2 to 0.5 s; text about 55 ms per character; no camera moves during strokes. Do NOT redraw the hand art: the engine's hand is final. `render(t)` must stay a pure function (no timers, no CSS animation) or scrubbing and export break.

## 5. API cheat sheet (all draw at the cursor `at` and advance it)
`beat(text,{keep,wipe})` start a beat; `Wr(text,x,y,size,color,{rotA,maxW})` handwritten text; `head(text)` headline with underline; `U(i)` underline, `Rg(i)` ring, `HL(i)` highlighter; `Rc(x,y,w,h,c)` rough box; `S(path,dur,c,w)` any stroke; `A(x1,y1,x2,y2,c,bend)` arrow; `Ck(x,y)` check; `icon(name,x,y,scale,{c})`, `put(name,label,region,{s,c})` icon + label in a free spot; `spot(w,h,region)` free place; `mark(kind,x,y,scale,c)` burst/sparkle/squig/spiral; `bubble`; `figure`; `pic`; `cam(x,y,w)` (w at least W/2); `endBeats()`. Stickers: book film speaker note phone coin bulb person check star clock heart house cloud sun gear mic camera chat search rocket trophy lock key flag pencil laptop badge megaphone calendar pin tree mountain smile bolt graph target coffee. Query switches: `?theme=chalk|kraft|blueprint`, `?fmt=vertical` (1080x1920, place with fractions of `W`/`H`), `?hand=0`.

## 6. Voice: best available, never fake audio (audio FIRST)
Order of engines (`make_audio.py` tries them for you):
0. **Supabein TTS**, only if the user gave a token. READ the live docs first, every time: `curl -s https://supabein.dxinnovationhub.com/tts/docs` (public; they are the authority and can change). As last checked: `POST /tts/speak` with form fields `text` (1 to 5000 characters, no SSML), `voice` (name from `/tts/voices.json`, default `en-US-AriaNeural`), `token`; returns MP3. 401 = wrong token (stop and ask), 400 = fix the request, 500 = wait and retry. Nigerian audience: `en-NG-EzinneNeural` or `en-NG-AbeoNeural`. One request at a time. Run: `SUPABEIN_TOKEN='...' python3 make_audio.py beats.json audio/ --engine supabein`. Never write the token anywhere; mask it in any error; tell the user to rotate it if it was pasted in chat. Network error or `x-deny-reason`: ask the user to allow `supabein.dxinnovationhub.com`, then fall back.
1. **Edge TTS** (`pip install edge-tts`): best free voices but often answers 403 from a server; if it does, stop trying.
2. **Piper offline** (`pip install piper-tts`; `python3 -m piper.download_voices en_US-ryan-high --data-dir assets/voices`; `PIPER_MODEL=assets/voices/en_US-ryan-high.onnx python3 make_audio.py beats.json audio/ --engine piper`). Default is brisk: `PIPER_LENGTH=1.15` is set by the script. Never stretch speech by more than 15 percent to fit a length: shorten or lengthen the script.
3. **espeak-ng**: robotic, timing drafts only.
4. **Nothing works**: the script writes `narration_script.txt` and `narration.srt` and exits 3. Paste the SRT into the reply in a code block for the user to feed to any TTS; they return one clip per beat (`b00.mp3`...) or one recording (`--split recording.mp3`). Say plainly that the video has no voice yet. The page still works with the browser voice plus captions.
Then paste `timings.json` start/end pairs into `TIMINGS`, set `AUDIO_SRC` (relative file, or a base64 `data:` URI under about 10 MB for a published page; `AUDIO_BITRATE=64k` over 5 minutes). Respelling for the voice only (`Apprelab.com` becomes "Apprelab dot com") is done by the script; captions keep the original.

## 7. Tooling on this server
- No `ffmpeg` or `ffprobe` on PATH: `pip install imageio-ffmpeg`; the kit scripts find it by themselves (or set `FFMPEG=...`). `ffprobe` is not needed.
- Node: `export NODE_PATH=$(npm root -g)` so `require('playwright')` works. Pillow for the contact sheet: `pip install pillow` (else set `PYTHON=` to a Python that has it).
- Capability check before promising a video: `node -e "require('playwright').chromium.launch().then(b=>{console.log('chromium ok');return b.close()})"`. Not ok? Deliver the HTML only, name the blocker in one line, and give the one `export.js` command the user can run on their own machine.
- In the sandboxed (embedded) chat nothing is global and only the project folder persists: `npm i playwright`, then `export NODE_PATH=$PWD/node_modules PLAYWRIGHT_BROWSERS_PATH=$PWD/.pw-browsers` and `npx playwright install chromium --only-shell`. The kit is in `.bein/kits/whiteboard`; `pip install pillow imageio-ffmpeg` works there.
- QA: `node qa.js page.html qa` (exit 1 on issues; screenshots mid and end of every beat; `qa/beats.json`).
- Export: `node export.js page.html out.mp4 --fps 24 --audio audio/narration.mp3`. Test first: `--from 1 --to 3` then extract one frame (`ffmpeg -ss 1 -i test.mp4 -frames:v 1 f.png`) and look at it (font, framing, hand). Full run in the background: about 4.7 minutes per minute of video at 1280x720 on 4 cores; `--fast` is 2 to 3 times quicker (freezes the line wobble; use for drafts and long videos); `--width 1920` is 1080p and about 2x slower; `--query "?fmt=vertical"` for 9:16. No real audio: `--captions srt` burns the captions in and say it is silent.
- Report duration, resolution, size and the audio stream only after the export ran.

## 8. Self-critique checklist
Story (end state, hook, turn, action; read aloud; 22 to 35 words per beat) / Spelling (names and URLs exactly as typed) / Pen (tip on the ink, hand never over new text) / Mix (organized where structure, loose where story; no two beats laid out alike) / Whole frame used, nothing over 40 percent empty / Assets (real logo or wordmark, framed, labeled) / Characters (named, 1 to 2) / Collisions (`qa.js` clean; contact sheet AND key frames viewed) / Rhythm (quick, quick, slow; pause after each key reveal; ends wide; last frame held at least 1 s) / Color (at most 4 meanings) / Fonts (Caveat actually renders) / Console (no errors) / Audio first (`TIMINGS` from real durations, `__overrun` empty, loudness ok, no clipping) / Token not anywhere / Video (capability check, slice frame viewed, `ffprobe`-style numbers reported) / Honesty (say what exists and what does not).

## 9. Common failures
| Symptom | Fix |
|---|---|
| Letters stacked on one spot, text invisible | Never hand-roll text reveals; use `Wr()` (it advances x per glyph and masks along the baseline) |
| MP4 text is a serif font | Font not embedded: run `embed_font.py`, re-export |
| Drawing outruns the audio | Cut items, shorten labels, add words; check `__overrun` |
| Looks robotic or messy | `rough()` shapes, tilt text up to 3 degrees, vary sizes, add marks; at most 2 text blocks per band and 3 marks |
| Scrub breaks after erase | Never mutate the DOM at runtime; visibility is a function of `t` |
| Picture blank | Asset not decoded or bad data URI (`console.warn('missing asset')`); keep files small |
| Export slow or times out | Use `export.js` as shipped (CDP + workers), in the background, `--fast` for drafts |
| edge-tts 403 | Blocked from this server: use piper or the Supabein voice |
| Video ends before the last drawing | `export.js` pads the audio and sets the length from the frames; do not change it |
| No Mac worker / no ffmpeg / no Chromium | Name the blocker, deliver the HTML, give the one export command |

## 10. Known limits (say them when relevant)
Voice quality and phone playback cannot be judged by you. Browser voices vary by device. Chalk, kraft and blueprint are color swaps only. Export speed depends on cores (about 0.75 s per frame per worker with the wobble on). `--split` works best on recordings with clear pauses. The Supabein docs can change: read them before each use.

## 11. Reply format
One line on what was built (MP4 duration, resolution, size, plus the HTML path), a small table of beats with timings, the voice used and what was not made, assumptions in one line. If the video could not be exported say so first, name the blocker, and give the HTML plus the export command. Never print the token. If no audio engine ran, include the SRT block for copy-paste.
