# Cloud Server (PHP + MySQL, for cPanel)

The middle layer between the phone app and the laptop agent — see
`../laptop-agent`. Built as plain PHP + MySQL specifically because shared
cPanel hosting generally can't run a persistent process (no raw
WebSocket server, no custom daemons). Instead, the laptop agent **polls**
this API on an interval (default every 10s, see `pollIntervalMs` in the
agent's config).

```
Phone app  →  these PHP endpoints  →  MySQL  ←  polled by the laptop agent
```

Every line of this was tested against a real, disposable MariaDB instance
before being committed — not just written and assumed correct. See
"What's verified" at the bottom.

## Deploying to your cPanel

1. **Create the database.** In cPanel → *MySQL® Databases*: create a
   database and a user, add the user to the database with **All
   Privileges**. cPanel will prefix both names with your account username
   (e.g. `myuser_agent`).
2. **Upload these files.** Via *File Manager* or FTP, upload everything in
   this folder into a subdirectory under `public_html`, e.g.
   `public_html/agent-api/`. That makes the endpoints reachable at
   `https://yourdomain.com/agent-api/register.php`, etc.
3. **Configure it.** Copy `config.example.php` to `config.php` (same
   folder) and fill in:
   - `DB_DSN` / `DB_USER` / `DB_PASS` — the database you just created
   - `DEVICE_API_KEY` and `ADMIN_API_KEY` — two different random strings.
     Generate each with `php -r "echo bin2hex(random_bytes(32));"` (cPanel
     has a Terminal feature under *Advanced*, or run it on any machine
     with PHP and paste the result in).
4. **Create the tables.** In cPanel → *phpMyAdmin*, select your new
   database, open the **SQL** tab, paste in the contents of `schema.sql`,
   run it.
5. **Confirm HTTPS.** cPanel's AutoSSL (free, usually on by default) should
   already cover your domain. Don't point the agent at a plain `http://`
   URL — the API key would travel in cleartext.
6. **Point the agent at it.** In the laptop agent's `config.json`, set
   `serverBaseUrl` to `https://yourdomain.com/agent-api` and `apiKey` to
   the same value as `DEVICE_API_KEY` above.

That's it — no build step, no Composer, no Node.js required on the server
side. Just PHP files + two MySQL tables.

## Endpoints

All bodies/responses are JSON. Device-facing endpoints require the header
`X-Api-Key: <DEVICE_API_KEY>`; admin/phone-facing endpoints require
`X-Api-Key: <ADMIN_API_KEY>` — deliberately two different secrets, so a
leaked agent config can't be used to command *other* devices.

| Endpoint | Method | Caller | Body | Response |
|---|---|---|---|---|
| `/register.php` | POST | agent | `{device_uuid, hostname, platform, osRelease?, username?}` | `{ok}` |
| `/heartbeat.php` | POST | agent | `{device_uuid, internet_blocked}` | `{ok, command: {id, command}\|null}` |
| `/ack.php` | POST | agent | `{device_uuid, command_id, ok, error?}` | `{ok}` |
| `/devices.php` | GET | phone app | — | `{ok, devices: [{device_uuid, hostname, platform, username, internet_blocked, online, last_seen_at}, ...]}` |
| `/command.php` | POST | phone app | `{device_uuid, command: "BLOCK"\|"ALLOW"}` | `{ok, id}` |

`register.php` is an upsert (safe to call every agent startup).
`heartbeat.php` delivers **at most one** pending command per call and
immediately marks it `delivered` so a slow ack doesn't cause the same
command to be handed out twice. `command.php` validates the command value
against a whitelist and 404s on an unknown `device_uuid`.

## Schema

```sql
devices: id, device_uuid (unique), hostname, platform, os_release,
         username, internet_blocked, last_seen_at, created_at

commands: id, device_uuid, command, status (pending|delivered|acked|failed),
          created_at, acked_at, error
```

"Online" in `devices.php` is computed as `last_seen_at` within
`ONLINE_THRESHOLD_SECONDS` (config.php, default 30s — a few missed
heartbeats' worth) — computed with MySQL's own `NOW()` against
`last_seen_at`, not PHP's clock, so it can't drift out of sync with
whatever timezone the DB server itself is configured with.

## Known limitation (shared with the laptop agent)

A `BLOCK` command cuts the laptop's network entirely, including its
ability to poll this server — so a subsequent `ALLOW` command can't be
picked up until the block is lifted some other way. The agent has a local
auto-revert safety timer for this today. The real fix belongs here: have
`BLOCK`'s underlying network action allow-list this server's own IP/port
so heartbeats keep working even while "blocked." Not built yet — flagged
in both READMEs.

## What's verified vs. not

Every endpoint was exercised against a **real, disposable MariaDB
instance** (not SQLite or a mock) running the exact `schema.sql` in this
folder, via 20 assertions covering: register → heartbeat → command
enqueue → delivery → duplicate-delivery prevention → ack → cross-device
ack rejection → auth failures (wrong key, no key, wrong key's role) →
method/validation guards (wrong HTTP verb, missing fields, invalid JSON,
unregistered device). All passed.

Separately, the actual laptop-agent `Connection` class (unmodified,
`src/connection.js`) was run against this same real PHP+MariaDB stack:
register → heartbeat → a simulated "phone app" enqueuing `BLOCK` via
`/command.php` → the agent picking it up on its next poll → applying it
(with the OS network module mocked, to avoid touching the test
environment's own network) → acking → `/devices.php` correctly reflecting
`internet_blocked: true`. This confirms the full phone→server→agent→server
loop works, short of the real OS-level firewall toggle and an actual phone
UI, neither of which exist yet.

One real bug this testing caught and fixed: `heartbeat.php` originally
used `rowCount() === 0` after an `UPDATE` to detect "device not
registered." MySQL's default `rowCount()` reports rows *changed*, not
rows *matched* — so a heartbeat landing in the same second as
`register.php`'s insert (identical `internet_blocked` value, `last_seen_at`
unchanged at second-level precision) reported 0 affected rows and was
misread as a missing device. Fixed via the `PDO::MYSQL_ATTR_FOUND_ROWS`
connection option in `includes/db.php`, which makes `rowCount()` mean
"rows matched" everywhere it's used. Exactly the kind of bug that looks
fine on paper and only shows up under a real database — which is why this
got run against one instead of just read over.

## Not built yet

The phone app itself (a UI on top of `/devices.php` and `/command.php`),
and the allow-list fix for the limitation above.
