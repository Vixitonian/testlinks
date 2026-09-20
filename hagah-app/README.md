# Hagah

A vanilla HTML/CSS/JS app for meditating on Scripture out loud: build a
passage from one or more verses (even from different books), record
yourself narrating it, layer in background music, and save the result —
entirely in the browser, no build step, no frameworks. Two views: **Create**
(build and narrate a passage) and **My Creations** (browse, loop, and
delete saved recordings).

## Features

- **Multi-verse passages** — add any number of verse ranges from any
  books, in any order; they're read as one combined passage. Text is
  fetched live from the free [bible-api.com](https://bible-api.com) (World
  English Bible, public domain).
- **Listen first, then record** — an optional "Listen" button plays the
  passage through this device's own built-in voice, purely so you can hear
  it before reading it yourself. Browsers don't expose that voice as an
  audio file, so it's preview-only; **recording your own voice** via
  `MediaRecorder` is the only narration source that can be saved.
- **Background music** — pick any audio file from your device; it's mixed
  under your narration with independent volume control and an automatic
  fade-out, using the Web Audio API (`OfflineAudioContext`).
- **Preview** — hear your recorded narration mixed live with the
  background track at the chosen volumes before saving.
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
recording, listening, and previewing all work without it.

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

## Project structure

```
hagah-app/
├── index.html
├── css/style.css
├── js/
│   ├── books.js      # static list of Bible books + chapter counts
│   ├── bible.js        # bible-api.com client
│   ├── supabein.js       # Supabein REST client (data + storage)
│   ├── audio.js            # device-voice preview, mic recording, mixing, MP3 encode
│   └── app.js                # UI wiring (Create + My Creations views)
└── vendor/lame.min.js   # lamejs MP3 encoder (vendored, MIT licensed)
```
