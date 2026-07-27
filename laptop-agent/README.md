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

## Blocking allow-lists the control server, so remote ALLOW keeps working

`BLOCK` doesn't just cut everything — `controller.js` first resolves the
control server's current IP(s) (`network/target.js`, fresh DNS lookup
every time, since cloud hosts can rotate IPs) and passes that to the
platform module, which blocks all other traffic by default but carves out
an explicit exception for that IP/port plus outbound DNS:

- **Windows**: flips the Windows Firewall's *default policy* to
  block inbound/outbound, then adds explicit ALLOW rules for the
  server + DNS. (Not "add a block rule ahead of an allow rule" — Windows
  Firewall evaluates an explicit block as taking precedence over an
  explicit allow for the same traffic regardless of order, so that
  wouldn't reliably work. Flipping the default policy sidesteps that
  precedence question entirely.)
- **macOS**: loads a complete `pf` (packet filter) ruleset — deny
  everything, `pass` rules for the server + DNS, `skip` on loopback —
  replacing the earlier approach of disabling network services outright,
  which had no way to let anything through selectively at all.
- **Linux**: two dedicated `iptables` chains hooked into
  OUTPUT/INPUT, with `RETURN` exceptions for loopback, the server, and
  DNS before the final `DROP` — replacing `nmcli networking off`, which
  was the same all-or-nothing problem as macOS's old approach.

This means the agent's heartbeat loop keeps working even while "blocked,"
so a remote `ALLOW` from the phone app can actually arrive and get
applied — closing the gap this project started with (see the git history
for how that gap was diagnosed before this fix existed).

**Residual limitations, by design choice or known gap:**
- If DNS resolution fails when `BLOCK` is applied (bad `serverBaseUrl`,
  transient DNS issue, nothing configured yet), it falls back to a
  blanket block with no allow-list — logged clearly, and `BLOCK` still
  succeeds rather than erroring out. In that fallback case, this
  paragraph's guarantee doesn't hold and you're back to relying on the
  auto-revert timer below.
- The allow-list is resolved once, at the moment `BLOCK` is applied — not
  re-checked periodically for the duration of a block. If the server's IP
  changes *while already blocked* (uncommon, but possible on some hosts),
  the agent won't notice until the next `BLOCK`/`ALLOW` cycle. Periodic
  re-resolution while blocked would close this but isn't built.
- DNS itself (port 53, any destination) stays open throughout a block, as
  the practical way to keep hostname resolution working without needing
  to rewrite the agent's HTTP client to connect by raw IP + manual
  SNI/Host-header override. This is a narrow, well-understood exception
  (the same one virtually every "allow-list" firewall configuration
  makes) — not a meaningful hole for general browsing.

As a safety net regardless of all of the above: every `BLOCK` still arms
an **auto-revert timer** (`autoRevertMinutes` in `config.json`, default
60) that automatically calls `ALLOW` when it elapses. You can also always
unblock locally via the tray menu or dashboard, which don't depend on the
network being up at all.

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
    target.js                 Resolves the control server's IP(s) to allow-list
    windows.js                  Default-deny firewall policy + allow rules for target.js's result
    macos.js                     pf ruleset: deny-all + pass rules for the target, elevated via sudo-prompt
    linux.js                      iptables OUTPUT/INPUT chains with RETURN exceptions for the target
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

`network/target.js`'s DNS resolution was run for real against the actual
production hosts (`cloud-api` on Render, and separately SupaBein's own
domain), correctly returning multiple IPs where a host has more than one
A record and defaulting the port correctly for https/http/custom ports.
`controller.js`'s wiring was verified end-to-end with `network` mocked: a
real resolvable `serverBaseUrl` produces the expected `{ips, port}` passed
into `network.block()`, and an intentionally unresolvable one correctly
falls back to `null` (blanket block) with a logged warning while `BLOCK`
still reports success rather than erroring out.

Every exact command sequence each platform module generates — the
Windows firewall-policy-flip + allow rules, the macOS `pf` ruleset content
(including the with-target and null-fallback variants), and the Linux
`iptables` chain setup — was verified with `child_process.exec` and
`sudo-prompt` both mocked, confirming precisely what would be sent to the
real OS tools: correct IPs/ports in the allow rules, DNS carved out on
both TCP/UDP 53, loopback exempted, no `action=block`-type rule used on
Windows (the precedence problem this whole design avoids), and the
null-target fallback correctly omitting the server-specific allow rules
while still defaulting to deny.

**Not exercised for real**: the actual `netsh` / `pfctl` / `iptables`
commands were never run for real during development — doing so inside a
shared sandbox would have risked cutting that environment's own network
(especially `iptables`, which this exact sandbox's own connectivity could
plausibly depend on). **Test the real block/allow behavior — especially
that a remote `ALLOW` genuinely arrives while "blocked" — on an actual
machine of each target OS before relying on it**, ideally with a way to
regain physical access in case something behaves unexpectedly.

## Next steps (not built yet)

1. Periodic re-resolution of the allow-list while a block is active, to
   handle the control server's IP rotating mid-block (see the residual
   limitations above).
2. Deploy `../cloud-api` somewhere it can stay running (see its README),
   and `../phone-app` to any static host, then point this agent's
   `config.json` at the deployed API.
3. Later: per-domain rules/categories, scheduling, and real activity
   monitoring (the current build has no traffic inspection — that needs a
   local proxy or OS-level DNS/connection logging, deliberately deferred
   per the project's own MVP phasing).
