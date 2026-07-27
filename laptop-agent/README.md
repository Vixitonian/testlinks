# Laptop Agent

A visible, background Electron app that identifies a laptop, keeps a
connection to SupaBein, and applies `BLOCK` / `ALLOW` internet commands.
This is component 1 of the two-part system described in the project
brief:

```
Phone App  →  SupaBein (shared datastore)  ←  polled directly by Laptop Agent (this folder)
```

There's no middle server anymore — both this agent and `../phone-app`
talk straight to SupaBein's Data API (project 79) with no credential at
all (anon access, scoped by SupaBein's own row policies to just the
`devices`/`commands`/`settings` tables — see "Talks directly to
SupaBein" below). An earlier version of this project ran a small Node
server (`../cloud-api`) in between; it was removed once the agent's
poll-timeout issues traced back to that server's free-hosting-tier cold
starts, and direct access turned out to be simpler anyway.

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
- **Talks to SupaBein directly**: polls SupaBein's Data API over HTTPS on
  an interval (default 10s) — no server in between, no credential
  embedded (see "Talks directly to SupaBein" below).
- **Receives and applies commands**: `BLOCK` / `ALLOW`, from the phone app
  (via SupaBein), the tray menu, or the local dashboard — all paths go
  through the same `Controller`, so behavior and logging are identical
  regardless of source.
- **Quit and Allow are passphrase-gated**: prevents casually disabling
  the agent or lifting a block from the tray/dashboard. Block itself
  needs no passphrase — only quitting or un-blocking does. This is a
  light deterrent, not a security boundary — anyone with admin/root on
  the machine can always stop it via the OS. See "Shared passphrase"
  below for how this passphrase also lives in the phone app.

## Talks directly to SupaBein

`src/supabein.js` is the entire client: three tables in SupaBein project
`79`, no server in between, no credential embedded in this app at all.

```
devices:
  device_uuid      VARCHAR(36)   not null, unique
  hostname         VARCHAR(255)  not null
  platform         VARCHAR(32)   not null
  os_release       VARCHAR(64)
  username         VARCHAR(128)
  internet_blocked BOOLEAN       not null, default false
  last_seen        DATETIME

commands:
  device_uuid  VARCHAR(36)  not null
  command      VARCHAR(32)  not null        -- "BLOCK" | "ALLOW"
  status       VARCHAR(32)  not null, default 'pending'  -- pending|delivered|acked|failed
  acked_at     DATETIME
  error        TEXT

settings:
  setting_key  VARCHAR(64)   not null, unique   -- currently just "passphrase_hash"
  value        VARCHAR(255)  not null
```
(Every SupaBein table also gets an auto `id` and `created_at` for free.)

The `anon` role (i.e. **no** `Authorization` header at all) was granted
`SELECT`/`INSERT`/`UPDATE` on `devices` and `commands`, and
`SELECT`/`UPDATE` only on `settings` (no anon `INSERT` — the one settings
row is pre-seeded; clients can only change its value, not create new
rows). `DELETE` is denied everywhere for `anon`. Every other table in
this SupaBein project has zero policies, so this access can't reach
anything beyond these three tables regardless — see SupaBein's own docs:
an unpolicied table denies every operation to anyone but the project
owner's token, by default.

Each poll (`Connection._tick()` in `src/connection.js`) does, directly
against SupaBein:
1. **register** (once, lazily, retried until it succeeds) — find-or-insert
   this device's row in `devices` keyed on `device_uuid`.
2. **heartbeat** — update that row's `internet_blocked`/`last_seen`.
3. **sync passphrase** — read `settings` for `passphrase_hash`; if it
   differs from the locally cached value, update the local cache (see
   "Shared passphrase" below).
4. **check for a command** — find the oldest `commands` row for this
   device with `status = "pending"`; if found, mark it `delivered`, apply
   it via `Controller`, then mark it `acked` or `failed`.

The phone app does the mirror image directly too: lists `devices` +
`commands` to render status (including an in-flight `pending`/`delivered`
state so the UI doesn't look like nothing happened while a command is
still working its way to the device), and inserts into `commands` with
`status: "pending"` to send `BLOCK`/`ALLOW`.

**Security tradeoff, stated plainly**: because this is anon/no-credential
access, anyone who discovers this SupaBein project's Data API URL (the
project id and table names are visible in this public repo) can read the
device list and insert/update rows in these three tables directly,
bypassing both apps' UI entirely — there's no API-key gate at all
anymore, unlike the earlier `cloud-api` design. This was a deliberate,
explicit choice (see git history) in exchange for removing a server that
had its own reliability problems (a free-hosting-tier cold-start delay
was the actual root cause of earlier "still not connecting" reports) and
for a much simpler two-component system. If that tradeoff stops being
acceptable, the fix is real per-user authentication via SupaBein's
`authenticated` role (login-backed, not anon) — not built, see "Next
steps" below.

## Shared passphrase

The passphrase gating Quit and Allow (this app) and the phone app's login
screen is the **same value**, stored as the `settings` row's
`passphrase_hash` (SHA-256 hex) rather than duplicated as separate
hardcoded constants in each app. The phone app has a "Change passcode"
screen (gear icon, top right, once unlocked) that updates this row
directly; this agent picks up the change on its next poll (step 3 above)
and caches it locally in `config.json`'s `quitPassphraseHash` so
passphrase checks stay instant and work offline using the last-synced
value, rather than requiring a live SupaBein round trip every time someone
types a passphrase into the tray/dashboard prompt.

## Blocking allow-lists SupaBein, so remote ALLOW keeps working

`BLOCK` doesn't just cut everything — `controller.js` reads a **hardcoded**
allow-list from `config.json` (`serverAllowIps` + `serverAllowPort`, set
up once via `scripts/resolve-server-ips.js` — see "Running it" below) and
passes it to the platform module, which blocks all other traffic by
default but carves out an explicit exception for that IP/port plus
outbound DNS:

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

**Why hardcoded instead of resolved live via DNS at block-time** (an
earlier version of this fix did that): it's simpler and more predictable
— no DNS-failure fallback path to reason about, no dependency on Node's
`dns` module behaving identically across three OSes at the exact moment
`BLOCK` fires. The tradeoff is the flip side of that predictability: if
the server's IP ever changes, `config.json` needs a manual update
(`node scripts/resolve-server-ips.js <serverBaseUrl>`, paste the result
in) — nothing detects that automatically.

**Residual limitations, by design choice or known gap:**
- If `serverAllowIps` is empty (not configured yet), `BLOCK` falls back to
  a blanket block with no allow-list — logged clearly, and `BLOCK` still
  succeeds rather than erroring out. In that fallback case, this section's
  guarantee doesn't hold and you're back to relying on the auto-revert
  timer below.
- If SupaBein's IP changes and `config.json` isn't updated to match, the
  agent will silently keep allow-listing the *old*, no-longer-correct
  IP — same practical effect as the fallback above, just without a log
  warning, since nothing knows the hardcoded value has gone stale.
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
  main.js               Electron entry point — wires everything together
  service-main.js       Headless entry point for the Windows Service install (see below)
  state.js               Shared in-memory state + change events
  controller.js           Applies BLOCK/ALLOW, owns the auto-revert timer
  connection.js            Polls SupaBein directly — register/heartbeat/passphrase-sync/command
  supabein.js               Thin anon Data API client (list/findOne/insert/update)
  time.js                    nowMysqlUtc() — UTC DATETIME formatting for last_seen etc.
  device.js                   Stable device identity
  config.js                    Local settings (poll interval, allow-list, cached passphrase hash, auto-revert minutes)
  logger.js                     Rotating file + console logger
  autostart.js                   Login-item registration (cross-platform, Electron build only)
  tray.js                         Tray icon + menu
  network/
    index.js                      Picks the right backend for process.platform
    target.js                      DNS-resolves a URL to {ips, port} — used by scripts/resolve-server-ips.js, not at block-time
    windows.js                     Default-deny firewall policy + allow rules for the configured serverAllowIps
    macos.js                       pf ruleset: deny-all + pass rules for the configured target, elevated via sudo-prompt
    linux.js                       iptables OUTPUT/INPUT chains with RETURN exceptions for the configured target
  ui/
    dashboard.html/js/css          Status window (opened from the tray); Allow opens the passphrase prompt
    prompt.html/js/css             Purpose-aware passphrase prompt, shared by Quit and Allow
  preload.js                      contextBridge API exposed to renderers
scripts/
  generate-icons.js              Generates the tray/app PNG icons (no external assets)
  resolve-server-ips.js          One-time setup: prints the serverAllowIps/serverAllowPort to paste into config.json
  install-service.js             Installs the Windows Service (see below)
  uninstall-service.js           Removes it
  build-service-installer.sh     Builds the turnkey service installer (see below)
build/
  service-installer.nsi          NSIS source for LaptopAgentService-Setup.exe
  stage/                          Build output, gitignored — staged files before compiling
  node-windows-deps/               Build output, gitignored — isolated node-windows dependency resolve
runtime/
  node.exe                       Portable Node.js runtime, gitignored — downloaded by the build script
```

## Tamper-resistant install for a child's account (Windows Service)

The default build (`npm start` / the NSIS installer) is a **per-user**
Electron app: it starts at login for whichever account launches it, shows
a tray icon, and can be quit from that tray menu (passphrase-gated, but a
standard user account can still find the process and end it via Task
Manager, since it runs under their own login session). That's fine for a
parent's own machine; it's not the right shape for a child's account where
the goal is that they can't casually stop or remove it.

For that case, install `src/service-main.js` as a real **Windows
Service** instead:

- Runs as **SYSTEM**, not as the logged-in user — starts at boot, before
  anyone logs in, and keeps running across every login session on the
  machine, not just one account's.
- **No tray icon and no dashboard window** — not because either was
  hidden, but because Windows Services run in Session 0, isolated from
  any interactive desktop, and structurally cannot show UI at all. There
  is nothing to toggle here; this is just what a service is.
- **Cannot be stopped or uninstalled by a standard (non-admin) account** —
  the Services Control Manager itself enforces this (`services.msc`,
  `sc stop`, `sc delete` all require admin credentials for a
  SYSTEM-owned service). This is the actual tamper-resistance, not a
  passphrase — a standard account has no path to it at all, the same way
  it can't stop any other Windows system service.
- `install-service.js` also locks down the `ProgramData\Laptop Agent`
  config/log folder (via `icacls`) so a standard account gets Access
  Denied trying to open or hand-edit `config.json`/`device.json` — see
  "What this does and doesn't hide" below for exactly what that does and
  doesn't cover.

**What stays honest and visible, unchanged from the rest of this
project:** the service is named **"Laptop Agent"** — that's exactly what
appears in `services.msc`, Task Manager's *Services* tab, `sc query`, and
`tasklist`. Nothing about the service name, executable, or folder is
disguised or hidden from anyone who looks (including the child, if they
know to check Services — they just can't do anything about it from a
standard account). This project won't build a version that hides from
Task Manager or fakes a different name; see the intro above.

### Installing it — turnkey installer (recommended)

`LaptopAgentService-Setup.exe` (built via `npm run build:service-installer`,
see "Building the installer" below) is a self-contained NSIS installer —
nothing needs to be pre-installed on the target machine, not even Node.js.
It bundles a portable copy of the Node.js runtime (`runtime/node.exe`)
purely to run this app; nothing about that runtime is exposed or usable
as a general-purpose Node install afterward.

1. On the target Windows machine, run `LaptopAgentService-Setup.exe` and
   click through it — it'll prompt for admin elevation (a UAC prompt),
   which is required to register a Windows Service.
2. The installer copies its files to `Program Files\Laptop Agent Service`,
   then runs `scripts/install-service.js` (using its own bundled
   `node.exe`, not any system Node) to register and start the service —
   you'll see this happening live in the installer's details/log view.
3. Confirm it's running: open `services.msc` and look for "Laptop Agent"
   (status "Running", startup type "Automatic").
4. It reads `config.json` from `%ProgramData%\Laptop Agent\config.json` —
   hardcoded defaults apply (see `src/config.js`), so no manual setup is
   needed for it to reach SupaBein.

To remove it: use "Laptop Agent Service" in Windows' *Add or remove
programs*, or run `Program Files\Laptop Agent Service\Uninstall.exe`
directly (also requires admin).

**System requirement**: WinSW (the service wrapper `node-windows` uses
under the hood, bundled in the installer) is a small .NET application, so
the target machine needs .NET Framework — present by default on any
Windows 10/11 install; only relevant on a heavily stripped-down or very
old Windows build.

#### Building the installer

Requires `makensis` (NSIS) on `PATH`, and network access once (to
download the portable Node.js runtime the first time):
```bash
npm run build:service-installer
```
Downloads `runtime/node.exe` if not already present, resolves
`node-windows`'s full dependency tree in an isolated scratch install
(**not** just `node_modules/node-windows` alone — its own dependencies,
`xml`/`yargs`/etc., get hoisted to the top level by npm and are easy to
miss; `wrapper.js`, the script that actually keeps running *inside* the
installed service via WinSW, needs all of them present at runtime, not
just at install time), stages everything into `build/stage/`, and
compiles `build/service-installer.nsi` into
`dist/LaptopAgentService-Setup.exe`. See `scripts/build-service-installer.sh`
for the exact staged file list — deliberately just `service-main.js` and
the core modules it needs (`config.js`, `device.js`, `state.js`,
`controller.js`, `connection.js`, `supabein.js`, `time.js`, `logger.js`,
`network/{index,target,windows}.js`), not the Electron/UI files
(`main.js`, `tray.js`, `preload.js`, `autostart.js`, `ui/`), which
`require("electron")` and aren't needed or usable in a headless service.

### Installing from source (alternative)

If you'd rather not use the prebuilt installer — e.g. building on a
machine that already has Node.js — the underlying steps are exposed
directly. From an **elevated** (Run as Administrator) terminal, in this
folder:
```
npm install
npm run service:install
```
This pulls in `node-windows` (an optional, Windows-only dependency —
harmless if `npm install` can't build it on macOS/Linux, since nothing
else here depends on it) and registers + starts the service using
whatever `node` is already on `PATH`, rather than a bundled copy. Same
`config.json` location and defaults as above.

To remove it later (also requires an elevated terminal):
```
npm run service:uninstall
```
This unregisters the service but deliberately leaves the ProgramData
folder in place (config/logs); delete it manually as Administrator if you
want no trace left at all.

### What this does and doesn't cover

- **Covers**: casual removal (Task Manager "End task", uninstalling via
  Settings/Programs, deleting the tray-app shortcut, editing
  `config.json` to point it at nothing) — none of these work from a
  standard child account against a real Windows Service.
- **Doesn't cover**: an account with local admin rights (or physical
  access plus a way to boot into another OS / Safe Mode with a different
  admin account) can always stop or remove any Windows service, including
  this one — that's true of literally every piece of endpoint software on
  Windows, not a gap specific to this project. The earlier clarifying
  answer that the kids' accounts are standard (non-admin) is what makes
  this protection meaningful here.
- **Doesn't hide anything** — deliberately. The service name, the
  ProgramData folder's existence (just not its contents), and the
  process's presence in Task Manager are all exactly as discoverable as
  any other legitimate background service. If a design goal is ever "the
  child should not be able to find out this exists," that's a different
  and explicitly declined kind of build — see the intro above.

### Not tested on a real Windows machine

Like the rest of this project's OS-level integrations, `service-main.js`'s
core logic (`Config`, `loadOrCreateDevice`, `AgentState`, `Controller`,
`Connection`) was verified headlessly here by direct invocation against
the real live SupaBein project — same modules, same code path as the
Electron build, just without Electron wrapping them.

The installer itself was built and inspected, not run: `makensis`
compiled `build/service-installer.nsi` cleanly, and the resulting
`LaptopAgentService-Setup.exe` was unpacked (via `7z l`, since NSIS
archives are inspectable without a Windows machine) and confirmed to
contain exactly the intended files at the intended relative paths —
`runtime/node.exe`, the full `node-windows` dependency tree (18 packages;
an earlier version of the build script shipped `node-windows` alone,
missing its own hoisted `xml`/`yargs` dependencies that `wrapper.js`
needs at service runtime — caught by resolving module paths from the
staged tree with plain Node before rebuilding), and the trimmed `src/`
module set. `node-windows`'s actual service registration (the WinSW XML
generation, `winsw.exe install`/`start`, and the Session-0 no-UI running
service), the `icacls` hardening, and the installer's own UAC/wizard flow
were **not** run against a real Windows Service Control Manager from this
environment (no Windows machine available here) — install it on an
actual machine and confirm "Laptop Agent" shows Running in `services.msc`
before relying on this for a child's account, the same caveat as this
README's firewall commands above.

## Running it

```bash
npm install       # pulls electron, electron-builder, sudo-prompt
npm start         # launches the tray app
```

No server URL/API key to configure — `src/supabein.js` already points at
the live SupaBein project. If you ever deploy your own copy against a
different SupaBein project, update `PROJECT_ID`/`BASE` there (and in
`../phone-app/supabein.js` to match), then re-run:
```bash
node scripts/resolve-server-ips.js https://supabein.dxinnovationhub.com
```
and paste the printed `serverAllowIps`/`serverAllowPort` into
`config.json`, so `BLOCK` can allow-list SupaBein (see "Blocking
allow-lists SupaBein" above). Re-run this if SupaBein's IP ever changes.

First launch creates `config.json`, `device.json`, and a `logs/` folder in
the OS's standard per-app data directory (e.g. `~/.config/laptop-agent` on
Linux, `~/Library/Application Support/Laptop Agent` on macOS,
`%APPDATA%\Laptop Agent` on Windows).

Quit/Allow passphrase defaults to the value hardcoded in `src/config.js`,
but is really governed by SupaBein's shared `settings` row once this
agent has synced at least once — see "Shared passphrase" above. Change it
from the phone app's "Change passcode" screen, not locally.

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

The `connection.js` polling logic (register → heartbeat → passphrase sync
→ apply command → ack, retry-on-failure, one-command-per-tick) was proven
correct end-to-end against the real live SupaBein project directly — not
a stub, not a mock: register/heartbeat confirmed via a real `Connection`
instance (controller mocked, so no real firewall commands ran), the
`settings` row's anon `SELECT`/`INSERT`/`UPDATE`/blocked-`DELETE`
behavior confirmed with real HTTP calls, and `_syncPassphrase()` confirmed
to actually correct a deliberately-stale local cache to match the live
`settings` value. All test rows were cleaned up afterward.

`network/target.js`'s DNS resolution (used by `scripts/resolve-server-ips.js`,
not at block-time — see above) was run for real against SupaBein's actual
production domain, correctly returning its current IP and defaulting the
port correctly for https/http/custom ports.
`controller.js`'s wiring was verified end-to-end with `network` mocked: a
configured `serverAllowIps` produces the expected `{ips, port}` passed
into `network.block()`, and an empty/missing one correctly falls back to
`null` (blanket block) with a logged warning while `BLOCK` still reports
success rather than erroring out.

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
   handle SupaBein's IP rotating mid-block (see the residual limitations
   above).
2. Real per-user authentication (SupaBein's `authenticated`/login-backed
   role) if the current anon/no-credential access ever needs to be locked
   down further — see "Talks directly to SupaBein"'s security tradeoff
   note above.
3. Later: per-domain rules/categories, scheduling, and real activity
   monitoring (the current build has no traffic inspection — that needs a
   local proxy or OS-level DNS/connection logging, deliberately deferred
   per the project's own MVP phasing).
