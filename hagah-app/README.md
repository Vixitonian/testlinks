# Hagah

A vanilla HTML/CSS/JS app for meditating on Scripture out loud: build a
passage from one or more verses (even from different books), narrate it,
layer in background music, and save the result — entirely in the browser,
no build step, no frameworks. Two views: **Create** (build and narrate a
passage) and **My Creations** (browse, loop, and delete saved recordings).

## Features

- **Multi-verse passages** — add any number of verse ranges from any
  books, in any order; they're read as one combined passage. Text is
  fetched live from the free [bible-api.com](https://bible-api.com) (World
  English Bible, public domain).
- **Two narration sources** — record your own voice via `MediaRecorder`, or
  generate narration from a preloaded English voice using
  [Piper](https://github.com/rhasspy/piper), a neural text-to-speech model
  that runs entirely inside the browser tab via WebAssembly/ONNX Runtime —
  no server, no API key, no account, works offline after the one-time voice
  model download. Both sources produce a real audio file, and both work on
  any device or browser.
- **Background music** — pick any audio file from your device; it's mixed
  under your narration with independent volume control and an automatic
  fade-out, using the Web Audio API (`OfflineAudioContext`).
- **Preview** — hear the narration mixed live with the background track at
  the chosen volumes before saving.
- **Save & browse creations** — saving mixes, encodes, and uploads in one
  step (no separate "export" action); saved creations show up in **My
  Creations**, each with playback and a **Loop** toggle for repeated,
  meditative listening.

## Running it

No build step — just serve the folder statically, e.g.:

```bash
cd hagah-app
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Recording requires HTTPS or `localhost`
(browser microphone permission rules).

## Connecting your Supabein project

Click **⚙ Settings** and enter:

- **Project ID** — your Supabein project's numeric id.
- **Personal access token** — a project-scoped PAT (`sb_pat_...`), created
  under your Supabein account at **Auth → Personal Access Tokens**, scoped
  to this one project.

The token is stored only in this browser's `localStorage` and is sent only
to `supabein.dxinnovationhub.com`. It is never written into any file in
this repository — **do not hardcode a token into the source**, since this
is a project-scoped credential with full owner access to that project's
data and files. A connection is required to save and view creations;
narrating and previewing work without it.

### Backend schema

This app expects a `recordings` table in your Supabein project with the
following columns (already provisioned for project `Hagah`, id `127`):

| column             | type          |
|--------------------|---------------|
| verse_ref          | VARCHAR(255)  | combined reference, e.g. "John 3:16; Philippians 4:4-7"
| verse_text         | TEXT          | combined passage text
| verses_json        | JSON          | structured list of `{book, chapter, verse_start, verse_end, reference}`
| background_track   | VARCHAR(255)  |
| audio_url          | TEXT          |
| duration_seconds   | FLOAT         | (currently unused)
| book, chapter, verse_start, verse_end | — | legacy single-verse columns, unused since multi-verse support was added

Row-level security on this table denies `anon` and `authenticated` roles
for every operation — only a project-scoped PAT or service key (owner
access) can read or write it, since the app always calls the API with the
token you provide in Settings rather than a public anon key.

Uploaded audio files are stored in the `hagah-audio` bucket and served
publicly at `https://supabein.dxinnovationhub.com/api/v1/storage/<project_id>/hagah-audio/<filename>`.

### Preloaded-voice narration (local Piper neural TTS)

"Generate narration" uses [`@diffusionstudio/vits-web`](https://github.com/diffusion-studio/vits-web),
which runs a Piper (VITS) voice model fully client-side via WebAssembly and
ONNX Runtime Web — no Supabein connection, server, or API key required for
this feature at all (Supabein is only used for saving/browsing creations).
`js/piper.js` is a small ES module bridge (loaded with `<script type="module">`)
that exposes `window.PiperTTS` for the rest of the app's classic scripts to call.

The first time a given voice is used, its ONNX model (~60MB, hosted on
Hugging Face) downloads and is cached in the browser's Origin Private File
System — instant on every use after that, and it works offline once cached.
Voices are currently limited to a curated English-only list in
`js/voices.js` (Amy is the default "warm" recommendation); more (including
other languages) can be added from Piper's
[full voice catalog](https://github.com/rhasspy/piper/blob/master/VOICES.md)
by adding entries with the matching voice ID.

## Project structure

```
hagah-app/
├── index.html
├── css/style.css
├── js/
│   ├── books.js      # static list of Bible books + chapter counts
│   ├── voices.js      # curated English Piper voice IDs
│   ├── bible.js        # bible-api.com client
│   ├── supabein.js      # Supabein REST client (data + storage)
│   ├── audio.js          # mic recording, mixing, MP3 encode, live preview
│   ├── piper.js           # ES module bridge to local Piper neural TTS
│   └── app.js              # UI wiring (Create + My Creations views)
└── vendor/lame.min.js   # lamejs MP3 encoder (vendored, MIT licensed)
```
