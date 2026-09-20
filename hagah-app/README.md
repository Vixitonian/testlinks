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
  generate narration from a preloaded English voice using Google Cloud
  Text-to-Speech, proxied server-side through Supabein so the API key never
  reaches the browser. Both produce a real audio file that flows through the
  same mix/export pipeline, and both work on any device or browser (no
  microphone or screen-share permission needed for the voice option). A free
  "Quick preview" using the device's own voice is also available for an
  instant, zero-cost check before spending TTS quota.
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

### Preloaded-voice narration (Google Cloud Text-to-Speech)

"Generate narration" calls a Supabein **integration** named `google-tts`,
which proxies the request to Google Cloud's `text:synthesize` endpoint
server-side — the API key is stored as a locked secret and is never sent to
the browser. It's registered once per project:

```bash
curl -X POST "https://supabein.dxinnovationhub.com/api/v1/projects/<project_id>/integrations" \
  -H "Authorization: Bearer <your PAT>" -H "Content-Type: application/json" \
  -d '{
    "name": "google-tts",
    "base_url": "https://texttospeech.googleapis.com/v1/",
    "secret": "<your Google Cloud API key>",
    "auth_style": "query:key"
  }'
```

The app then calls `POST /projects/<project_id>/integrations/google-tts/proxy`
with `{"method":"POST","path":"text:synthesize","body":{...}}`, and Supabein
appends `?key=<secret>` before forwarding to Google. The response's
`audioContent` (base64 MP3) is decoded client-side into a `Blob`, just like a
microphone recording. Voices are currently limited to a curated English-only
list in `js/voices.js`; other languages can be added by extending that list
with any [Google Cloud TTS voice name](https://cloud.google.com/text-to-speech/docs/voices).

## Project structure

```
hagah-app/
├── index.html
├── css/style.css
├── js/
│   ├── books.js      # static list of Bible books + chapter counts
│   ├── voices.js      # curated English Google Cloud TTS voice list
│   ├── bible.js        # bible-api.com client
│   ├── supabein.js      # Supabein REST client (data, storage, TTS proxy)
│   ├── audio.js          # local preview, mic recording, mixing, MP3 encode
│   └── app.js            # UI wiring
└── vendor/lame.min.js   # lamejs MP3 encoder (vendored, MIT licensed)
```
