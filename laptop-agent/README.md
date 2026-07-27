# Laptop Agent

A visible, background Electron app that identifies a laptop, keeps a
connection to a cloud server, and applies `BLOCK` / `ALLOW` internet
commands. This is component 1 of the three-part system described in the
project brief:

```
Phone App  →  Cloud Server  →  Laptop Agent   (this folder)
```

The cloud server now exists — see `../cloud-api` (Node.js, backed by a
SupaBein project as the datastore, tested against that live project end
to end). The phone app also exists — see `../phone-app`. See "Cloud
server contract" below for the exact API `connection.js` calls; the agent
doesn't care how the server is implemented as long as it matches that
contract, but `../cloud-api` is the real one it's actually meant to talk to.

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
- **Connects to a server**: polls your API over HTTPS on an interval
  (default 10s) rather than holding a socket open — no persistent
  connection required server-side, so this works on literally any HTTP
  host: a serverless function, a small Express/Fastify app, whatever.
- **Receives and applies commands**: `BLOCK` / `ALLOW`, from the server,
  the tray menu, or the local dashboard — all three paths go through the
  same `Controller`, so behavior and logging are identical regardless of
  source.
- **Quit is passphrase-gated**: prevents casually disabling the agent from
  the tray. This is a light deterrent, not a security boundary — anyone
  with admin/root on the machine can always stop it via the OS. The real
  control point is meant to be the server + phone app.

## Cloud server contract

This is the exact API `src/connection.js` calls. Implement these 3
endpoints (in whatever you're building) and the agent works against it
unchanged. Two more (`GET /devices`, `POST /command`) aren't called by the
agent at all — they're for your phone app / admin UI to drive the same
data.

All bodies are JSON. Every request carries `X-Api-Key`; use **two
different keys** — one for the agent, one for admin/phone-app calls — so
a leaked agent config can't be used to command other devices.

**`POST /register`** — agent calls this once at startup. Upsert keyed on
`device_uuid`; safe to call repeatedly.
```
Request:  {device_uuid, hostname, platform, osRelease, username}
Response: {ok: true}
```

**`POST /heartbeat`** — agent calls this every `pollIntervalMs`. Update
the device's `last_seen`/`internet_blocked`, and in the *same response*
hand back at most one pending command — combining "status report" and
"what should I do" into one round trip. Mark the command `delivered`
(not yet `acked`) as soon as you hand it out, so a second heartbeat before
the ack arrives doesn't redeliver it.
```
Request:  {device_uuid, internet_blocked}
Response: {ok: true, command: {id, command} | null}   // command: "BLOCK" | "ALLOW"
```
404 if `device_uuid` hasn't been registered yet.

**`POST /ack`** — agent calls this right after attempting a delivered
command. Scope the update to `device_uuid` too, so one device can never
ack another's command id.
```
Request:  {device_uuid, command_id, ok, error?}
Response: {ok: true}
```

**`GET /devices`** *(for the phone app, not called by the agent)*
```
Response: {ok: true, devices: [{device_uuid, hostname, platform, username,
                                 internet_blocked, online, last_seen,
                                 pending_command, last_command_failed}, ...]}
```
"online" should mean "last_seen within a few multiples of the agent's
poll interval" — computed server-side/DB-side against its own clock, not
by mixing timezones between two systems. `pending_command` (`"BLOCK"` /
`"ALLOW"` / `null`) and `last_command_failed` (`{command, error}` / `null`)
let the phone app show an in-flight/failed state instead of silently
looking like nothing happened while a command is still working its way to
the device.

**`POST /command`** *(for the phone app, not called by the agent)* —
validate `command` against a whitelist (`BLOCK`/`ALLOW` only) and 404 on
an unknown `device_uuid` before inserting.
```
Request:  {device_uuid, command}
Response: {ok: true, id}
```

`../cloud-api` implements exactly this contract (Node.js, backed by
SupaBein) — see its README for the schema, deployment, and how it was
tested against the real live project.

## Known limitation: blocking is all-or-nothing (for now)

`BLOCK` currently disables the OS network layer entirely (Windows Firewall
rules / macOS `networksetup` / Linux `nmcli networking off`). That also
severs the agent's own connection to the server — so today, a laptop
blocked by a remote command **cannot receive a remote `ALLOW`** until your
server implements an allow-listing scheme (permit outbound traffic to the
server's own IP/port so a "blocked" laptop can still poll).

As a safety net so a laptop is never stranded: every `BLOCK` arms an
**auto-revert timer** (`autoRevertMinutes` in `config.json`, default 60)
that automatically calls `ALLOW` when it elapses, regardless of server
connectivity. You can also always unblock locally via the tray menu or
dashboard, which don't depend on the network being up.

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

Point it at `../cloud-api` (or any server implementing the contract
above): edit `config.json` (created on first run in the OS's per-app data
directory) and set `serverBaseUrl` to its base URL and `apiKey` to match
its `DEVICE_API_KEY`.

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

The `connection.js` polling logic (register → heartbeat → apply command →
ack, retry-on-failure, one-command-per-tick) was proven correct end-to-end
against `../cloud-api` running for real, backed by the real live SupaBein
project — not a stub, not a disposable copy. See `../cloud-api/README.md`
for the full test account.

**Not exercised for real**: the actual `netsh` / `networksetup` / `nmcli`
commands were never run for real during development — doing so inside a
shared sandbox would have risked cutting that environment's own network.
The command-building logic was verified with the network module mocked
out. **Test the real block/allow behavior on an actual machine before
relying on it**, ideally with a way to regain physical access in case
something behaves unexpectedly.

## Next steps (not built yet)

1. **Allow-listing fix** for the all-or-nothing block limitation: instead
   of a blanket block, permit outbound traffic to the server's IP/port so
   a blocked laptop can still poll and receive `ALLOW`, removing the
   dependency on the auto-revert timer.
2. Deploy `../cloud-api` somewhere it can stay running (see its README),
   and `../phone-app` to any static host, then point this agent's
   `config.json` at the deployed API.
3. Later: per-domain rules/categories, scheduling, and real activity
   monitoring (the current build has no traffic inspection — that needs a
   local proxy or OS-level DNS/connection logging, deliberately deferred
   per the project's own MVP phasing).
