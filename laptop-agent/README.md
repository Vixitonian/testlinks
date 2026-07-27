# Laptop Agent

A visible, background Electron app that identifies a laptop, keeps a live
connection to a (future) cloud server, and applies `BLOCK` / `ALLOW`
internet commands. This is component 1 of the three-part system described
in the project brief:

```
Phone App  →  Cloud Server  →  Laptop Agent   (this folder)
```

The server and phone app are **not built yet** — this agent is fully
self-contained and usable on its own via its tray menu / dashboard window
in the meantime, and is already wired for the server the moment one exists.

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
- **Connects to a server**: a `ws`/`wss` WebSocket client with automatic
  reconnect + exponential backoff, ready to point at a real server URL in
  `config.json` the moment one exists.
- **Receives and applies commands**: `BLOCK` / `ALLOW`, from the server,
  the tray menu, or the local dashboard — all three paths go through the
  same `Controller`, so behavior and logging are identical regardless of
  source.
- **Quit is passphrase-gated**: prevents casually disabling the agent from
  the tray. This is a light deterrent, not a security boundary — anyone
  with admin/root on the machine can always stop it via the OS. The real
  control point is meant to be the server + phone app, once built.

## Wire protocol (for the future server)

```
agent  -> server   {"type":"hello","device":{id,hostname,platform,...}}
agent  -> server   {"type":"status","internetBlocked":bool,"at":iso}
server -> agent    {"type":"command","command":"BLOCK"|"ALLOW","id":"..."}
agent  -> server   {"type":"ack","id":"...","ok":bool,"error":"..."}
```

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

## Project layout

```
src/
  main.js          Electron entry point — wires everything together
  state.js          Shared in-memory state + change events
  controller.js      Applies BLOCK/ALLOW, owns the auto-revert timer
  connection.js       WebSocket client to the cloud server
  device.js            Stable device identity
  config.js             Local settings (server URL, quit passphrase, auto-revert minutes)
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
npm install       # pulls electron, ws, electron-builder, sudo-prompt
npm start         # launches the tray app
```

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

Verified in an automated, sandboxed environment (see the project chat log
for details): the app boots without crashing under a headless X server,
creates its identity/config files correctly, the WebSocket client
connects/retries/backs off correctly, the full `hello → status → command →
ack → status` protocol round-trips correctly against a throwaway test
server, the auto-revert timer fires and calls `allow()` correctly, and the
dashboard UI renders and reflects state changes correctly (screenshotted
via CDP).

**Not exercised for real**: the actual `netsh` / `networksetup` / `nmcli`
commands were never run for real during development — doing so inside a
shared sandbox would have risked cutting that environment's own network.
The command-building logic was verified with the network module mocked
out. **Test the real block/allow behavior on an actual machine before
relying on it**, ideally with a way to regain physical access in case
something behaves unexpectedly.

## Next steps (not built yet)

1. **Cloud server**: accepts the agent's WebSocket connection, persists
   device + status history, exposes an API/WebSocket for the phone app,
   and relays `BLOCK`/`ALLOW` commands. Once it exists, update
   `serverUrl` in `config.json`.
2. **Allow-listing fix** for the all-or-nothing limitation above: instead
   of a blanket block, permit outbound traffic to the server's IP/port so
   `ALLOW` can always reach a "blocked" laptop remotely, removing the
   dependency on the auto-revert timer.
3. **Phone app**: device list, last-activity display, Block/Allow buttons
   — talks to the cloud server, never directly to the agent.
4. Later: per-domain rules/categories, scheduling, and real activity
   monitoring (the current build has no traffic inspection — that needs a
   local proxy or OS-level DNS/connection logging, deliberately deferred
   per the project's own MVP phasing).
