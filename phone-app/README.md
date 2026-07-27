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

## Running it

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

Driven in a real browser (Playwright) against the actual `cloud-api`
server, itself backed by the real live SupaBein project — not fixtures,
not a mock. The full loop: setup screen → device list renders a real
seeded device → clicking Block Internet → the UI correctly shows the
"Blocking…" pending state → a simulated laptop-agent poll (the same
request shape the real agent sends) applies it and acks it → the UI's
next auto-refresh shows "Blocked" → and the same round-trip for Allow.
Settings re-open was also verified to prefill with the previously saved
values. All test data was removed from the live project afterward.

## Not built yet

Push notifications, per-device activity/history view, categories/rules
beyond a flat Block/Allow, and any authentication beyond the single admin
key (e.g. individual parent logins) — all deliberately deferred per the
project's MVP phasing.
