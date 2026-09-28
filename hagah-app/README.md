# Hagah

A vanilla HTML/CSS/JS app for meditating on Scripture out loud, styled like
a simple notes app: a list of your creations, and a single add/edit screen
to build a passage, narrate it, and save it — no build step, no frameworks.

## Features

- **List / Edit** — two screens only. The list shows your saved creations;
  tapping one (or the **+** button) opens the same add/edit screen, either
  pre-filled or blank.
- **Multi-verse passages** — add any number of verse ranges from any
  books, in any order; they're read as one combined passage. Text is
  fetched live from the free [bible-api.com](https://bible-api.com) (World
  English Bible, public domain).
- **Listen first, then record** — an optional "Listen" button plays the
  passage through this device's own built-in voice, purely so you can hear
  it before reading it yourself. Browsers don't expose that voice as an
  audio file, so it's preview-only; **recording your own voice** via
  `MediaRecorder` is the only narration source that can be saved.
- **Background music** — a bundled default meditation track
  (`assets/meditation-bg.mp3`, trimmed and re-encoded to ~1.4MB — see
  below), your own uploaded file, or none; mixed under your narration with
  independent volume control, using the Web Audio API
  (`OfflineAudioContext`).
- **Preview** — hear your recorded narration mixed live with the
  background track at the chosen volumes before saving.
- **Play & loop from the list** — each saved creation has its own play/pause
  button right in the list (no need to open it), plus a persistent
  mini-player at the bottom of the screen with a Loop toggle for repeated,
  meditative listening. Playback keeps going as you navigate between the
  list and the edit screen. The mini-player also registers with the
  [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API),
  so on mobile it shows lock-screen/notification controls and keeps
  playing when you background the app or lock the screen.
- **Editing** — reopening a saved creation lets you edit its verse list and
  save just that change (no audio touched), or record fresh narration to
  replace the saved audio entirely (old file is deleted from storage).
- **No settings screen** — the app connects to its Supabein project
  automatically; see below for how that's configured.

## Running it

No build step — just serve the folder statically, e.g.:

```bash
cd hagah-app
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Recording requires HTTPS or `localhost`
(browser microphone permission rules).

## Connecting to Supabein (no settings screen)

There's intentionally no in-app settings UI — the app just works, the way
a notes app doesn't ask you to log into your own notes every time. That
means the project connection lives in a config file instead:

1. Copy `js/config.example.js` to `js/config.js`.
2. Fill in your project ID and a project-scoped personal access token
   (`sb_pat_...`, created under your Supabein account at **Auth → Personal
   Access Tokens**, scoped to this one project).

**`js/config.js` is gitignored and must never be committed** — it holds a
credential with full owner access to this project's data and files. The
live deployed site has its own copy of this file baked in at deploy time;
it simply isn't part of the git history. If you fork or redeploy this app,
you must supply your own `js/config.js` before it will connect.

⚠️ **Trade-off to be aware of:** because this is a public static site with
no login, anyone who opens the deployed page and views its source can read
the token out of `js/config.js` and get full read/write access to this
Supabein project's tables and storage. The token is project-scoped (it
can't touch other Supabein projects), but within this project the exposure
is real. Rotate the token (delete + recreate under **Auth → Personal
Access Tokens**) if that risk is ever a concern.

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
token from `js/config.js` rather than a public anon key.

Uploaded audio files are stored in the `hagah-audio` bucket and served
publicly at `https://supabein.dxinnovationhub.com/api/v1/storage/<project_id>/hagah-audio/<filename>`.

### Default background music

`assets/meditation-bg.mp3` was trimmed from a much longer (~18 minute,
21MB) instrumental down to a 2-minute, half-second-faded loop and
re-encoded at 96kbps — about 1.4MB. The mixing code already loops any
background track shorter than the narration, so 2 minutes is plenty; the
trim was done locally with a decode → trim → re-encode pass through the
same Web Audio + lamejs pipeline the app itself uses, not a separate tool.

## Project structure

```
hagah-app/
├── index.html
├── css/style.css
├── assets/meditation-bg.mp3   # default background track
├── js/
│   ├── books.js      # static list of Bible books + chapter counts
│   ├── config.example.js  # template — copy to config.js (gitignored)
│   ├── bible.js        # bible-api.com client
│   ├── supabein.js       # Supabein REST client (data + storage)
│   ├── audio.js            # device-voice preview, mic recording, mixing, MP3 encode
│   └── app.js                # UI wiring (List + Edit views)
└── vendor/lame.min.js   # lamejs MP3 encoder (vendored, MIT licensed)
```
