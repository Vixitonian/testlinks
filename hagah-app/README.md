# Hagah

A vanilla HTML/CSS/JS app for meditating on Scripture out loud: pick a
passage, record yourself reading it, blend in background music, and export
the result as an MP3 — entirely in the browser, no build step, no frameworks.

Optionally, recordings can be saved to your own [Supabein](https://supabein.dxinnovationhub.com/docs)
project so they show up in your library across devices.

## Features

- **Verse picker** — book/chapter/verse selector; text is fetched live from
  the free [bible-api.com](https://bible-api.com) (World English Bible,
  public domain).
- **Two narration sources** — record your own voice via `MediaRecorder`, or
  generate narration from a preloaded English voice using
  [Piper](https://github.com/rhasspy/piper), a neural text-to-speech model
  that runs entirely inside the browser tab via WebAssembly/ONNX Runtime —
  no server, no API key, no account, works offline after the one-time voice
  model download. Both sources produce a real audio file that flows through
  the same mix/export pipeline, and both work on any device or browser. A
  free "Quick preview" using the device's own built-in voice is also
  available for an instant check before running the neural model.
- **Preview together** — before exporting, play the narration (recorded or
  device voice) mixed live with the background track at the chosen volumes,
  so you can judge the balance without waiting for a full MP3 encode.
- **Background music** — pick any audio file from your device; it's mixed
  under your recording with independent volume control and an automatic
  fade-out, using the Web Audio API (`OfflineAudioContext`).
- **MP3 export** — the mixed result is encoded to a real `.mp3` file
  client-side with [lamejs](https://github.com/zhuker/lamejs) (vendored in
  `vendor/lame.min.js`), downloadable straight from the browser.
- **Library (optional)** — if connected to Supabein, exported MP3s are
  uploaded to your project's Storage and indexed in a `recordings` table so
  you can browse, play back, and delete them later.

## Running it

No build step — just serve the folder statically, e.g.:

```bash
cd hagah-app
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Recording requires HTTPS or `localhost`
(browser microphone permission rules).

## Connecting your Supabein project (optional)

Click **Settings** and enter:

- **Project ID** — your Supabein project's numeric id.
- **Personal access token** — a project-scoped PAT (`sb_pat_...`), created
  under your Supabein account at **Auth → Personal Access Tokens**, scoped
  to this one project.

The token is stored only in this browser's `localStorage` and is sent only
to `supabein.dxinnovationhub.com`. It is never written into any file in
this repository — **do not hardcode a token into the source**, since this
is a project-scoped credential with full owner access to that project's
data and files.

### Backend schema

This app expects a `recordings` table in your Supabein project with the
following columns (already provisioned for project `Hagah`, id `127`):

| column             | type          |
|--------------------|---------------|
| verse_ref          | VARCHAR(255)  |
| book               | VARCHAR(128)  |
| chapter            | INT           |
| verse_start        | INT           |
| verse_end          | INT           |
| verse_text         | TEXT          |
| background_track   | VARCHAR(255)  |
| audio_url          | TEXT          |
| duration_seconds   | FLOAT         |

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
this feature at all (Supabein is only used for the optional "Save to
library" step). `js/piper.js` is a small ES module bridge (loaded with
`<script type="module">`) that exposes `window.PiperTTS` for the rest of the
app's classic scripts to call.

The first time a given voice is used, its ONNX model (~60MB, hosted on
Hugging Face) downloads and is cached in the browser's Origin Private File
System — instant on every use after that, and it works offline once cached.
Voices are currently limited to a curated English-only list in
`js/voices.js`; more (including other languages) can be added from Piper's
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
│   ├── supabein.js      # Supabein REST client (data + storage only)
│   ├── audio.js          # local preview, mic recording, mixing, MP3 encode
│   ├── piper.js           # ES module bridge to local Piper neural TTS
│   └── app.js              # UI wiring
└── vendor/lame.min.js   # lamejs MP3 encoder (vendored, MIT licensed)
```
