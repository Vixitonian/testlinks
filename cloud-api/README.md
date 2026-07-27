# Cloud API

The middle layer between the phone app and the laptop agent — implements
the exact contract documented in `../laptop-agent/README.md`. Plain
Node.js, **zero npm dependencies** (uses Node 18+'s built-in `fetch`).

```
../phone-app  →  this server  →  SupaBein (datastore)  ←  polled by ../laptop-agent
```

Datastore is a SupaBein project (`devices` + `commands` tables). This
server holds SupaBein's privileged token server-side and is the *only*
thing that ever touches it — the phone app and laptop agent only ever
talk to this API, never to SupaBein directly.

## Why a project owner token (or service_key), and why it never leaves this server

SupaBein's Data API has three access levels: **anon** (no header,
subject to row policies), **authenticated** (a regular user's JWT/PAT,
also subject to policies), and **service_key or the project owner's own
JWT/PAT** (bypasses all policies — "trusted server-side code only," per
SupaBein's own docs). This server uses the latter, because there's no
reason for a phone browser or a laptop's local config file to ever be
capable of reading or writing arbitrary rows directly — every access this
system needs is mediated through the 5 narrow endpoints below, each with
its own validation. Both `devices` and `commands` were created here with
**zero policies granted to anon or authenticated** — direct client access
to SupaBein is not just discouraged, it's structurally impossible.

Two separate keys of this server's own gate every request instead:
`DEVICE_API_KEY` (the agent) and `ADMIN_API_KEY` (the phone app) — kept
different so a leaked agent config can't be used to command other
devices, and neither is anywhere near as powerful as the SupaBein token
if it did leak.

## Running it

```bash
cp .env.example .env    # fill in SUPABEIN_PROJECT_ID, SUPABEIN_TOKEN, and both API keys
npm start                # node server.js — no install step, no dependencies
```

Generate the two API keys with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Deploying

Any host that runs a long-lived Node process works: a small VPS,
Render/Railway, a Docker container, etc. Set the `.env.example` variables
as real environment variables via the host's dashboard rather than
shipping a `.env` file. (It wasn't built as a serverless function because
`/heartbeat` needs to be cheap and constant-latency at whatever polling
frequency the agent uses — a plain long-running process is the simplest
fit, but nothing here stops you from adapting the handlers into
serverless functions later if you'd rather.)

## SupaBein schema

Created via the project owner's token against project `shamlock` — for
reference/reproduction if you ever need to recreate it:

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
```

(Every SupaBein table also gets an auto `id` and `created_at` for free.)

## Endpoints

Same contract as `../laptop-agent/README.md`'s "Cloud server contract" —
repeated here with the one addition the phone app actually needs:

| Endpoint | Method | Caller | Notes |
|---|---|---|---|
| `/register` | POST | agent | Upsert by `device_uuid` |
| `/heartbeat` | POST | agent | Reports status, returns ≤1 pending command, marks it `delivered` |
| `/ack` | POST | agent | Scoped to `device_uuid` + `command_id` together |
| `/devices` | GET | phone app | See below |
| `/command` | POST | phone app | Validates `command` against `BLOCK`/`ALLOW`, 404s on unknown device |

**`/devices` also reports in-flight commands**, not just
`internet_blocked`: each device carries `pending_command` (`"BLOCK"`,
`"ALLOW"`, or `null` — set while the most recent command is
`pending`/`delivered`, i.e. sent but not yet confirmed by the device) and
`last_command_failed` (`{command, error}` or `null`). This exists because
`internet_blocked` only ever reflects what the device itself last
reported — a command can take up to the agent's poll interval to apply,
or fail outright, and the phone app needs to show that instead of
silently looking like nothing happened.

## What's verified

Every endpoint was tested against the **real, live SupaBein project**
(not a mock, not a different disposable instance) — 20 assertions
covering the full register → heartbeat → command → ack lifecycle,
duplicate-delivery prevention, cross-device ack rejection, and every
auth/validation guard.

Then the actual `../laptop-agent` `Connection` class (unmodified) was run
against this real running server end-to-end: register → heartbeat → a
simulated phone app enqueuing `BLOCK` via `/command` → the agent picking
it up on its next poll → applying it (OS network module mocked, to avoid
touching the test environment's own network) → acking → `/devices`
correctly reflecting the new state.

Then `../phone-app` itself was driven in a real browser (Playwright)
against this same live stack: full setup flow, device list rendering,
clicking Block → seeing the "Blocking…" pending state → a simulated agent
poll applying it → the UI auto-refreshing to show "Blocked" — and the
same for Allow. All against the real SupaBein project, not fixtures.

All test data was deleted from the live project afterward; nothing here
depends on data that existed during testing.

## Not built yet

The allow-listing fix mentioned in `../laptop-agent/README.md`'s "Known
limitation" (so a fully-blocked laptop can still receive a remote
`ALLOW`), and real activity/website monitoring (deliberately out of scope
per the project's MVP phasing).
