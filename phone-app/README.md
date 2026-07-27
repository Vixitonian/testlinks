# Phone App (PWA)

The control panel — component 2 of the phone-app → SupaBein → laptop-agent
system. An installable Progressive Web App: no app store, no build step,
just static files. Works on any phone's browser and can be "Added to Home
Screen" for an app-like icon and standalone window.

There's no middle server — this app talks straight to SupaBein's Data API
(project 79), same as `../laptop-agent` does. See "Talks directly to
SupaBein" below.

## What it does

- **Passcode lock screen**: on every launch, the app shows a passcode
  prompt before anything else — the same shared passcode that gates the
  laptop agent's Allow/Quit actions (see "Shared passcode" below). See
  "Security note on the passcode lock screen" below for exactly what this
  does and doesn't protect against.
- **No setup step beyond the passcode**: once unlocked, the device list is
  already live — no server URL or key to configure, see "Talks directly
  to SupaBein" below.
- **Empty state**: if nothing's registered yet, shows "No devices yet"
  instead of an error or a blank screen.
- **Device list**: hostname, platform, username, an online/offline dot
  (computed client-side from the last-heartbeat threshold), and a status
  pill.
- **Block / Allow**: one button per device that flips to whichever action
  applies. While a command is in flight (sent but not yet confirmed by
  the device), the pill shows an amber "Blocking…"/"Allowing…" state and
  the button disables — this isn't optimistic UI, it's SupaBein's own
  `commands.status` field, so it can't lie about something having worked
  before the laptop actually confirms it.
- **Change passcode**: gear icon, top right, once unlocked — updates the
  shared passcode everywhere (see "Shared passcode" below).
- **Auto-refreshes** every 5 seconds. No push notifications (would need a
  push service wired in — not built).
- **Installable**: manifest + service worker cache the static shell so the
  app loads even when offline (device data obviously still needs a live
  connection).

## Live deployment

Hosted on the same SupaBein project as the datastore, via its static
Sites & Deploys feature: **https://supabein.dxinnovationhub.com/sites/s49/current/**

### Icons are embedded as data URIs, not separate files

SupaBein's site-deploy file-upload endpoint's WAF blocks raw binary image
content outright — confirmed by testing: even a minimal valid 1x1 PNG or
GIF gets a 403, regardless of the `Content-Type` header sent, while the
exact same bytes base64-encoded as a `.txt` file upload fine. So instead
of uploading `icons/*.png` as separate files, `scripts/embed-icons.js`
reads them and rewrites `manifest.json`'s icon entries and `index.html`'s
`<link rel="icon">`/`apple-touch-icon` tags to reference
`data:image/png;base64,...` URIs directly — those are just text inside
files that upload fine. Run it after regenerating icons:
```bash
node scripts/generate-icons.js   # regenerate icons/*.png if you change them
node scripts/embed-icons.js      # re-embed them into manifest.json + index.html
```
The `icons/*.png` files stay in the repo as the source `embed-icons.js`
reads from — they're just never deployed as standalone files.

## Running it locally

Any static file server works — there's no build step:
```bash
python3 -m http.server 8080          # or: npx serve, nginx, GitHub Pages, Netlify, etc.
```
Then open it on a phone (must be HTTPS or localhost for the service
worker to register — most static hosts give you HTTPS for free). It talks
straight to the live SupaBein project hardcoded in `supabein.js`
(`PROJECT_ID`/`BASE`) — edit those and redeploy if you want a different
deployment to point at a different SupaBein project.

## Talks directly to SupaBein

`supabein.js` is the entire client: no server in between, no credential
embedded in this app at all. It calls SupaBein's Data API with **no**
`Authorization` header (anon access), against three tables in project
`79` — `devices`, `commands`, `settings` — each scoped by SupaBein's own
row policies to exactly what this app and `../laptop-agent` need
(`SELECT`/`INSERT`/`UPDATE` on `devices`/`commands`, `SELECT`/`UPDATE`
only on `settings`; `DELETE` denied everywhere for anon). See
`../laptop-agent/README.md`'s "Talks directly to SupaBein" section for
the full schema and the security tradeoff this implies (worth reading —
in short: this access has no credential gate at all beyond knowing the
project id and table names, which are visible in this public repo).

`refresh()` lists `devices` + `commands`, joins them client-side (latest
command per `device_uuid`) to compute `online`/`pending_command`/
`last_command_failed` — the same logic the old `cloud-api` server used to
do, just run here instead. `onToggle()` inserts a `commands` row with
`status: "pending"` to send `BLOCK`/`ALLOW`.

## Shared passcode

The passcode gating this app's login screen and `../laptop-agent`'s
Quit/Allow actions is the **same value** — stored as SupaBein's `settings`
table (`setting_key: "passphrase_hash"`), not duplicated as separate
hardcoded constants in each app. The "Change passcode" screen (gear icon,
top right) requires the current passcode, hashes the new one
(SHA-256, via `crypto.subtle`), and updates that row directly. The laptop
agent picks up the change on its next poll (a few seconds, see its
README) and caches it locally so its own checks stay instant/offline-capable.

## Security note on the passcode lock screen

The login check fetches the current hash from SupaBein's `settings` table
and compares it (SHA-256, client-side) to what was typed in, before the
login screen hides and `refresh()` starts polling. This is the same class
of protection as the laptop agent's Quit/Allow passphrase — **a
deterrent, not a security boundary**: the check happens in code anyone
can view-source, so a determined user with browser dev tools could call
`bootMainScreen()` directly and skip it entirely, or just call the
SupaBein Data API directly (see "Talks directly to SupaBein" above — that
access exists regardless of whether this login screen is ever shown).
What it actually stops is casual access — someone picking up an unlocked
phone and opening the app, or a kid finding the home-screen icon.

The lock is checked via `sessionStorage`, so it's required again every
time the app is opened fresh (most standalone/home-screen launches start
a new session) rather than remembered permanently — closer to a "PIN to
open the app" than a one-time login.

## What's verified

**UI mechanics**, driven in a real headless browser (Playwright) against
this app served locally: the login screen shows by default, a wrong
passcode shows an inline error and stays locked, a correct one hides the
login screen and reveals the main screen, and `sessionStorage` correctly
keeps it unlocked across a reload within the same session.

**The actual SupaBein-backed logic** — the login hash check, the
`devices`+`commands` join that computes `online`/`pending_command`/
`last_command_failed`, and the change-passcode update+revert round
trip — was verified with a Node script making the exact same HTTP calls
`supabein.js`/`app.js` make (same URLs, same anon/no-credential headers,
same request bodies), run directly against the real live SupaBein
project, not fixtures or a mock. All test/temporary values were cleaned
up or reverted afterward.

**Known gap**: this sandbox's Chromium still cannot complete a TLS
connection to any external host (confirmed again for
supabein.dxinnovationhub.com specifically) — so the full in-browser flow
(open app → login against the real SupaBein `settings` row → see the real
device list → Block/Allow → change passcode) was not exercised end-to-end
in an actual browser from within this environment. The two verification
approaches above cover the UI logic and the backend logic separately, but
not stitched together in one real browser session. If something looks
different on an actual phone than what's described above, that gap is
why — test it there before relying on it, same caveat as
`../laptop-agent/README.md`'s firewall commands.

## Not built yet

Push notifications, per-device activity/history view, categories/rules
beyond a flat Block/Allow, and real per-user authentication (SupaBein's
`authenticated`/login-backed role, instead of today's anon/no-credential
access — see `../laptop-agent/README.md`'s security tradeoff note) — all
deliberately deferred per the project's MVP phasing.
