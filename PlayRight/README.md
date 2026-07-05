# PlayRight

A stateless Playwright (Chromium) browser-automation microservice, built with
Node.js + Express, designed to run on Render and be called from a Laravel
application hosted on Namecheap cPanel (or anywhere else that can make an
HTTP request).

## Endpoints

### `GET /health`

Liveness check.

```json
{
  "success": true,
  "status": "ok",
  "uptimeSeconds": 12.3,
  "activeRuns": 1,
  "queued": 0,
  "maxConcurrentRuns": 3,
  "timestamp": "2026-07-05T00:00:00.000Z"
}
```

`activeRuns`/`queued` are useful for checking whether the service is under
load (see [Concurrency](#concurrency) below).

### `POST /run`

Runs a sequence of browser actions against a page and returns a structured
JSON result.

Request body:

```json
{
  "url": "https://example.com",
  "timeout": 15000,
  "actions": [
    { "type": "goto" },
    { "type": "click", "selector": "#login" },
    { "type": "fill", "selector": "#email", "value": "user@example.com" },
    { "type": "extractText", "selector": "h1", "key": "heading" }
  ]
}
```

- `url` (required, string) — page to load. Used automatically by a `goto`
  action that doesn't specify its own `value`/`url`.
- `actions` (required, non-empty array) — steps to run in order, each
  `{ "type": "...", ... }`.
- `timeout` (optional, ms) — per-action timeout override (default 15000, max
  60000, configurable via env vars — see below).

Response:

```json
{
  "success": true,
  "steps": [
    { "type": "goto", "url": "https://example.com", "ok": true },
    { "type": "click", "selector": "#login", "ok": true },
    { "type": "extractText", "selector": "h1", "key": "heading", "ok": true }
  ],
  "data": { "heading": "Example Domain" },
  "errors": []
}
```

If any step throws (element not found, assertion failed, navigation error,
etc.), execution stops, `success` is `false`, the failing step gets an
`error` message, and `errors` lists it. The HTTP status is still `200`
(client errors like a missing `url`/`actions` return `400`); this keeps the
contract predictable for the Laravel side — always check the `success` field.

#### Supported action types

| type | fields | notes |
|---|---|---|
| `goto` | `value` or `url` (optional, defaults to top-level `url`), `waitUntil` | navigates the page |
| `click` | `selector` | |
| `fill` | `selector`, `value` | clears and types |
| `type` | `selector`, `value`, `delay` (ms per key) | simulates real keystrokes |
| `press` | `key`, `selector` (optional) | key on an element, or globally if no selector |
| `select` | `selector`, `value` (string or array) | `<select>` option(s) |
| `check` | `selector` | checkbox/radio |
| `uncheck` | `selector` | checkbox |
| `wait` | `selector` (optional, waits for `state`, default `visible`) or `value` (ms) | |
| `screenshot` | `selector` (optional, full page if omitted), `fullPage`, `key` | base64 PNG in `data[key]` (default key `"screenshot"`) |
| `extractText` | `selector`, `key` (optional, defaults to selector) | `innerText` into `data[key]` |
| `extractHTML` | `selector`, `key` (optional) | `innerHTML` into `data[key]` |
| `evaluate` | `script` (JS expression string), `key` (optional) | runs inside the sandboxed page context, result into `data[key]` |
| `assertText` | `selector`, `value`, `mode` (`"contains"` default or `"equals"`) | throws if it doesn't match |
| `assertVisible` | `selector` | throws if not visible |

## 1. Deploying to Render

This folder lives inside the `testlinks` monorepo at `PlayRight/`. To deploy
it as its own Render Web Service:

1. Push this branch/folder to GitHub (already done if you're reading this
   from the repo).
2. In the [Render Dashboard](https://dashboard.render.com), click
   **New +** → **Web Service**.
3. Connect the `testlinks` GitHub repository (grant Render access to the
   `Vixitonian` account/org if it's not listed yet).
4. Configure:
   - **Root Directory**: `PlayRight`
   - **Runtime**: `Docker` (it will pick up `PlayRight/Dockerfile`)
   - **Branch**: your deploy branch (e.g. `main`)
   - **Instance Type**: `Free` is enough to start
   - **Health Check Path**: `/health`
5. Add environment variables (Settings → Environment):
   - `API_KEY` — a long random secret; the Laravel app must send it back on
     every request (strongly recommended since this service will be public).
   - `CORS_ORIGIN` — optional, defaults to `*`.
6. Click **Create Web Service**. Render builds the Docker image and deploys.
   Your service will be reachable at `https://<service-name>.onrender.com`.

Alternatively, a `render.yaml` Blueprint is included in this folder — if you
copy it to the repository root (or point a Render Blueprint's root directory
here), Render can create the service automatically from it.

> Note: Render's free plan spins containers down when idle, so the first
> request after inactivity will be slow (cold start + browser launch). If
> that's a problem, upgrade the instance type or add an external uptime
> pinger hitting `/health`.

## 2. Installing Playwright (local development)

```bash
cd PlayRight
npm install                 # runs "playwright install --with-deps chromium" via postinstall
cp .env.example .env        # optional, for local env vars
npm start                   # listens on PORT (default 3000)
```

If `--with-deps` fails locally (it needs root/apt on Linux), it falls back to
`playwright install chromium`, which installs the browser binary without OS
packages — fine on most desktop dev machines.

## 3. Testing the API

```bash
# Health check
curl http://localhost:3000/health

# Run a basic sequence
curl -s -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "actions": [
      { "type": "goto" },
      { "type": "extractText", "selector": "h1", "key": "heading" }
    ]
  }' | jq
```

## 4. Example cURL requests

**Login flow with a screenshot:**

```bash
curl -s -X POST https://playright.onrender.com/run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PLAYRIGHT_API_KEY" \
  -d '{
    "url": "https://example.com/login",
    "actions": [
      { "type": "goto" },
      { "type": "fill", "selector": "#email", "value": "user@example.com" },
      { "type": "fill", "selector": "#password", "value": "secret" },
      { "type": "click", "selector": "#submit" },
      { "type": "wait", "selector": "#dashboard" },
      { "type": "screenshot", "key": "dashboard" }
    ]
  }'
```

**Assertion-only smoke test:**

```bash
curl -s -X POST https://playright.onrender.com/run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PLAYRIGHT_API_KEY" \
  -d '{
    "url": "https://example.com",
    "actions": [
      { "type": "goto" },
      { "type": "assertVisible", "selector": "h1" },
      { "type": "assertText", "selector": "h1", "value": "Example Domain" }
    ]
  }'
```

## 5. Calling PlayRight from Laravel

Use Laravel's HTTP client (`Illuminate\Support\Facades\Http`), which is
available out of the box on any Laravel app (works fine under cPanel/PHP-FPM
as long as the `curl` PHP extension is enabled, which it is by default on
Namecheap's shared hosting).

```php
use Illuminate\Support\Facades\Http;

$response = Http::timeout(30)
    ->withHeaders([
        'x-api-key' => config('services.playright.key'),
    ])
    ->post(config('services.playright.url') . '/run', [
        'url' => 'https://example.com/login',
        'actions' => [
            ['type' => 'goto'],
            ['type' => 'fill', 'selector' => '#email', 'value' => $email],
            ['type' => 'fill', 'selector' => '#password', 'value' => $password],
            ['type' => 'click', 'selector' => '#submit'],
            ['type' => 'wait', 'selector' => '#dashboard'],
            ['type' => 'extractText', 'selector' => '#dashboard h1', 'key' => 'welcomeText'],
        ],
    ]);

if ($response->successful() && $response->json('success')) {
    $welcomeText = $response->json('data.welcomeText');
} else {
    // $response->json('errors') has the failure details
    report('PlayRight run failed: ' . json_encode($response->json('errors')));
}
```

Add the service URL/key to `config/services.php`:

```php
'playright' => [
    'url' => env('PLAYRIGHT_URL', 'https://playright.onrender.com'),
    'key' => env('PLAYRIGHT_API_KEY'),
],
```

And to `.env` on the Laravel side:

```
PLAYRIGHT_URL=https://playright.onrender.com
PLAYRIGHT_API_KEY=<same value as Render's API_KEY env var>
```

Because the service is stateless (a fresh, isolated browser context per
request), you can call it concurrently from multiple Laravel jobs/requests
without them interfering with each other.

## Concurrency

Multiple callers are served **in parallel, not one-at-a-time**: every
`/run` request gets its own isolated `BrowserContext` (separate cookies,
storage, cache) on a single shared Chromium process, and all the Playwright
calls are async I/O — nothing blocks Node's event loop while a page loads.

That said, each concurrent browser context costs real memory, and Render's
free plan only has 512MB RAM — enough simultaneous contexts will OOM-crash
the container for every user, not just the extra ones. So the service caps
true parallelism at `MAX_CONCURRENT_RUNS` (default `3`): requests within the
limit run immediately and concurrently; anything beyond that waits in a
short FIFO queue (up to `QUEUE_TIMEOUT_MS`, default 20s) for a slot to free
up, rather than being rejected outright or crashing the box. If the queue
wait is exceeded, the caller gets `503` with a `Retry-After` header instead
of a hung request.

Check current load anytime via `GET /health` (`activeRuns`, `queued`,
`maxConcurrentRuns`). If you're consistently seeing requests queue, either:

- upgrade the Render instance type (more RAM/CPU) and raise
  `MAX_CONCURRENT_RUNS` to match, or
- run multiple Render instances behind a load balancer for horizontal
  scaling (safe since the service holds no state between requests).

## Configuration reference

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | set automatically by Render |
| `API_KEY` | *(none)* | if set, required on `/run` via `x-api-key` or `Authorization: Bearer` |
| `CORS_ORIGIN` | `*` | restrict cross-origin access if needed |
| `MAX_BODY_SIZE` | `2mb` | request body size limit |
| `DEFAULT_ACTION_TIMEOUT_MS` | `15000` | per-action timeout when not specified in the request |
| `MAX_ACTION_TIMEOUT_MS` | `60000` | upper bound on a caller-supplied `timeout` |
| `RUN_TIMEOUT_MS` | `90000` | hard ceiling for an entire `/run` call |
| `MAX_CONCURRENT_RUNS` | `3` | how many `/run` calls execute in parallel before queueing |
| `QUEUE_TIMEOUT_MS` | `20000` | how long a queued request waits for a free slot before `503` |
