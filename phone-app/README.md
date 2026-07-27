# Phone App (PWA)

The control panel — component 3 of the phone-app → cloud-server →
laptop-agent system. A installable Progressive Web App: no app store, no
build step, just static files. Works on any phone's browser and can be
"Added to Home Screen" for an app-like icon and standalone window.

## What it does

- **First run**: asks for your Cloud API's base URL and admin key, stored
  only in this browser's `localStorage` — **never baked into the shipped
  files**, so the static app itself carries no secret at all. Revisit any
  time via the ⚙ button.
- **Device list**: hostname, platform, username, an online/offline dot
  (derived from the server's last-heartbeat threshold), and a status pill.
- **Block / Allow**: one button per device that flips to whichever action
  applies. While a command is in flight (sent but not yet confirmed by
  the device), the pill shows an amber "Blocking…"/"Allowing…" state and
  the button disables — this isn't optimistic UI, it's the server's own
  `pending_command` field, so it can't lie about something having worked
  before the laptop actually confirms it.
- **Auto-refreshes** every 5 seconds. No push notifications (would need a
  push service wired into the cloud API — not built).
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
worker to register — most static hosts give you HTTPS for free) and
enter your Cloud API's URL + admin key when prompted.

## Security note on the admin key

It lives in this browser's `localStorage`, entered once by whoever sets
the phone up — not embedded in any file that gets deployed/served. That's
a meaningfully smaller blast radius than the SupaBein token the API server
holds (this key can only list devices and send Block/Allow — not read or
write arbitrary data), but it's still a real secret sitting in browser
storage: don't set this up on a shared/public device, and treat "someone
with access to this phone can see the key via devtools" as the actual
threat model rather than assuming it's uncrackable.

## What's verified

**Pre-deployment**, driven in a real browser (Playwright) against
`cloud-api` running locally but backed by the real live SupaBein project —
not fixtures, not a mock. The full loop: setup screen → device list
renders a real seeded device → clicking Block Internet → the UI correctly
shows the "Blocking…" pending state → a simulated laptop-agent poll (the
same request shape the real agent sends) applies it and acks it → the
UI's next auto-refresh shows "Blocked" → and the same round-trip for
Allow. Settings re-open was also verified to prefill with the previously
saved values. This is what caught the `pending_command` gap in the first
place.

**Post-deployment**, every live file (`index.html`, `manifest.json`,
`service-worker.js`, `app.js`, `styles.css`) was fetched from the real
public URL and confirmed byte-identical to the repo source, `manifest.json`
confirmed still valid JSON with all 3 icons present, and the full
register → heartbeat → command → pending-state → ack → confirmed-blocked
lifecycle was re-run directly against the real production Render API +
real SupaBein project (curl, not a browser — see note below).

**Known gap**: this sandbox's Chromium cannot complete a TLS connection to
*any* external host through its network setup (confirmed for both
supabein.dxinnovationhub.com and the Render API — full-page navigation
and in-page `fetch()` both get `ERR_CONNECTION_RESET`, while `curl` and
Node's own `fetch()` work fine against the same URLs). So the live,
publicly-hosted page has not itself been exercised in a real browser from
within this environment — only pre-deployment (via localhost) and
post-deployment (via curl/Node) verification were possible here. If
something looks different in an actual phone browser than what's
described above, that gap is why — test it there before relying on it.

All test data was removed from the live project afterward.

## Not built yet

Push notifications, per-device activity/history view, categories/rules
beyond a flat Block/Allow, and any authentication beyond the single admin
key (e.g. individual parent logins) — all deliberately deferred per the
project's MVP phasing.
