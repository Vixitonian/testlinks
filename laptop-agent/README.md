# Laptop Agent

A visible, background Electron app that identifies a laptop, keeps a live
connection to a (future) cloud server, and applies `BLOCK` / `ALLOW`
internet commands. This is component 1 of the three-part system described
in the project brief:

```
Phone App  →  Cloud Server  →  Laptop Agent   (this folder)
```

The cloud server now exists — see `../cloud-server` (plain PHP + MySQL,
built for ordinary cPanel hosting). The phone app is **not built yet** —
this agent is fully usable on its own via its tray menu / dashboard window
in the meantime.

**Intended use:** on a device you own or are authorized to manage, with the
person using it aware it's installed. The agent's name, tray icon, and
process name are always "Laptop Agent" — nothing about it is hidden or
disguised. It is not built to be silently installed on someone else's
machine.

## What it does

- **Identifies the laptop**: generates a stable UUID on first run (stored
  in the OS user-data folder), paired with hostname/platform/OS
  version/username. Survives restarts; a fresh id is only created if the
  user-data folder is wiped.
- **Runs in the background**: a tray icon (green = connected & allowed,
  red = blocked, gray = disconnected) is the primary UI. No window opens
  on launch; clicking the tray icon (or launching the app again) opens a
  small status dashboard.
- **Starts at login**: registers itself via Electron's login-item API on
  Windows/macOS, and via an XDG `~/.config/autostart/*.desktop` file on
  Linux (Electron's API doesn't cover most Linux desktops).
- **Connects to a server**: polls a plain PHP/MySQL backend over
  HTTPS on an interval (default 10s) rather than holding a socket open —
  this is what actually works on shared/cPanel hosting, which generally
  can't run a persistent daemon. See `../cloud-server`.
- **Receives and applies commands**: `BLOCK` / `ALLOW`, from the server,
  the tray menu, or the local dashboard — all three paths go through the
  same `Controller`, so behavior and logging are identical regardless of
  source.
- **Quit is passphrase-gated**: prevents casually disabling the agent from
  the tray. This is a light deterrent, not a security boundary — anyone
  with admin/root on the machine can always stop it via the OS. The real
  control point is meant to be the server + phone app, once built.

## Wire protocol

HTTP polling against `../cloud-server`'s endpoints (all POST, JSON, with
an `X-Api-Key` header matching the server's `DEVICE_API_KEY`):

```
agent -> server   POST /register.php   {device_uuid, hostname, platform, osRelease, username}  -> {ok}
agent -> server   POST /heartbeat.php  {device_uuid, internet_blocked}   -> {ok, command: {id, command}|null}
agent -> server   POST /ack.php        {device_uuid, command_id, ok, error?}  -> {ok}
```

`register.php` runs once at startup; `heartbeat.php` runs every
`pollIntervalMs` and doubles as "how am I doing" + "what should I do" in
one round trip, since shared hosting bills you (in load, if not money)
per request.

## Known limitation: blocking is all-or-nothing (for now)

`BLOCK` currently disables the OS network layer entirely (Windows Firewall
rules / macOS `networksetup` / Linux `nmcli networking off`). That also
severs the agent's own connection to the server — so today, a laptop
blocked by a remote command **cannot receive a remote `ALLOW`** until the
server exists with an allow-listing scheme (see "Next steps" below).

As a safety net so a laptop is never stranded: every `BLOCK` arms an
**auto-revert timer** (`autoRevertMinutes` in `config.json`, default 60)
that automatically calls `ALLOW` when it elapses, whoever issued the
original block. You can also always unblock locally via the tray menu or
dashboard, which don't depend on the network being up.

(This applies just as much to HTTP polling as it would have to a
WebSocket — a full network block stops the agent's heartbeat requests
from leaving the machine at all, regardless of transport.)

## Project layout

```
src/
  main.js          Electron entry point — wires everything together
  state.js          Shared in-memory state + change events
  controller.js      Applies BLOCK/ALLOW, owns the auto-revert timer
  connection.js       HTTP polling client to the cloud server
  device.js            Stable device identity
  config.js             Local settings (server base URL, API key, poll interval, quit passphrase, auto-revert minutes)
  logger.js               Rotating file + console logger
  autostart.js             Login-item registration (cross-platform)
  tray.js                   Tray icon + menu
  network/
    index.js                 Picks the right backend for process.platform
    windows.js                netsh advfirewall rules
    macos.js                   networksetup, elevated via sudo-prompt
    linux.js                    nmcli, elevated via sudo-prompt
  ui/
    dashboard.html/js/css       Status window (opened from the tray)
    prompt.html/js/css           Passphrase prompt for Quit
  preload.js                    contextBridge API exposed to renderers
scripts/
  generate-icons.js               Generates the tray/app PNG icons (no external assets)
```

## Running it

```bash
npm install       # pulls electron, electron-builder, sudo-prompt
npm start         # launches the tray app
```

Before it'll do anything useful against a real server, deploy
`../cloud-server` to your cPanel (see its README) and set `serverBaseUrl`
+ `apiKey` in this agent's `config.json` to match.

First launch creates `config.json`, `device.json`, and a `logs/` folder in
the OS's standard per-app data directory (e.g. `~/.config/laptop-agent` on
Linux, `~/Library/Application Support/Laptop Agent` on macOS,
`%APPDATA%\Laptop Agent` on Windows).

Default quit passphrase is **`changeme`** — change it before relying on
this for anything real (`config.set("quitPassphraseHash", ...)` via
`Config.setPassphrase()`, or hand-edit the hash in `config.json` using
`sha256("your phrase")`).

### Platform notes

- **Windows**: the packaged build requests admin elevation
  (`requestedExecutionLevel: requireAdministrator` in `package.json`) so
  `netsh advfirewall` calls succeed without per-command UAC prompts. This
  means Windows will show one UAC prompt at every login/launch.
- **macOS / Linux**: network commands elevate individually via
  `sudo-prompt` (a native OS password dialog), since these platforms don't
  have an Electron-level "always admin" equivalent. Expect a password
  prompt the first time `BLOCK`/`ALLOW` runs each session.
- Packaging installers (`npm run dist`, via `electron-builder`) is
  configured but not tested from this environment — do that from a real
  machine of each target OS.

## What's verified vs. not

Verified in an automated, sandboxed environment: the app boots without
crashing under a headless X server, creates its identity/config files
correctly, the dashboard UI renders and reflects state changes correctly
(screenshotted via CDP), and the auto-revert timer fires and calls
`allow()` correctly.

The `connection.js` HTTP polling client was verified against the **real,
unmodified `cloud-server` PHP files running on a real MariaDB instance** —
not a stub. The test: the agent registered, polled, and showed
"connected"; a script playing the role of the future phone app enqueued a
`BLOCK` via `/command.php` using the admin key; the agent's next poll
picked it up, applied it (network module mocked — see below), and acked
it; and the server's `/devices.php` correctly showed the device as
blocked afterward. That's the full phone→server→agent→server loop, proven
with real code on both ends.

**Not exercised for real**: the actual `netsh` / `networksetup` / `nmcli`
commands were never run for real during development — doing so inside a
shared sandbox would have risked cutting that environment's own network.
The command-building logic was verified with the network module mocked
out. **Test the real block/allow behavior on an actual machine before
relying on it**, ideally with a way to regain physical access in case
something behaves unexpectedly.

## Next steps (not built yet)

1. **Allow-listing fix** for the all-or-nothing block limitation above:
   instead of a blanket block, permit outbound traffic to the server's
   IP/port so a blocked laptop can still poll and receive `ALLOW`,
   removing the dependency on the auto-revert timer. Lives in both
   `network/*.php` here and the server's docs.
2. **Phone app**: device list, last-activity display, Block/Allow buttons
   — talks to `cloud-server`'s `/devices.php` and `/command.php`, never
   directly to the agent.
3. Later: per-domain rules/categories, scheduling, and real activity
   monitoring (the current build has no traffic inspection — that needs a
   local proxy or OS-level DNS/connection logging, deliberately deferred
   per the project's own MVP phasing).
