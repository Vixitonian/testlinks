<?php
/**
 * SupaBein AI Builder — Full Stack
 * 1. Describe your project
 * 2. Gemini designs the backend schema + generates a frontend
 * 3. PHP provisions the SupaBein backend (project, tables, columns, policies)
 * 4. PHP deploys the frontend to SupaBein Sites → you get a live URL
 *
 * Upload to cPanel public_html, edit the 4 constants below, visit in browser.
 */

define('SUPABEIN_BASE',     getenv('SUPABEIN_BASE')     ?: 'http://supabein.dxinnovationhub.com/api/v1');
define('SUPABEIN_EMAIL',    getenv('SUPABEIN_EMAIL')    ?: 'your@email.com');
define('SUPABEIN_PASSWORD', getenv('SUPABEIN_PASSWORD') ?: 'yourpassword');
define('GEMINI_API_KEY',    getenv('GEMINI_API_KEY')    ?: 'your_gemini_api_key');
define('GEMINI_MODEL',      'gemini-2.5-flash');

// ─── SupaBein JSON API helper ─────────────────────────────────────────────────

function supabein(string $method, string $path, $body = null, string $token = null): array {
    $url     = SUPABEIN_BASE . $path;
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));

    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) throw new RuntimeException("cURL error: $err");
    $data = json_decode($raw, true);
    if ($code >= 400) throw new RuntimeException("SupaBein HTTP $code: " . ($data['message'] ?? $data['error'] ?? $raw));
    return $data ?? [];
}

// ─── SupaBein file upload helper (multipart) ──────────────────────────────────

function supabein_upload(string $path, string $file_path, string $token): array {
    $url = SUPABEIN_BASE . $path;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token"],
        CURLOPT_POSTFIELDS     => [
            'zipfile' => new CURLFile($file_path, 'application/zip', 'deploy.zip'),
            'label'   => 'v1.0.0',
        ],
        CURLOPT_TIMEOUT => 60,
    ]);

    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) throw new RuntimeException("Upload cURL error: $err");
    $data = json_decode($raw, true);
    if ($code >= 400) throw new RuntimeException("SupaBein upload HTTP $code: " . ($data['message'] ?? $data['error'] ?? $raw));
    return $data ?? [];
}

// ─── Gemini API helper ────────────────────────────────────────────────────────

function ask_gemini(string $prompt, string $system, int $max_tokens = 8192): string {
    $models  = [GEMINI_MODEL, 'gemini-2.5-flash'];
    $last_ex = null;

    foreach ($models as $model) {
        $url     = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";
        $payload = [
            'system_instruction' => ['parts' => [['text' => $system]]],
            'contents'           => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig'   => ['temperature' => 0.2, 'maxOutputTokens' => $max_tokens],
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'x-goog-api-key: ' . GEMINI_API_KEY],
            CURLOPT_TIMEOUT        => 90,
        ]);

        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($err) throw new RuntimeException("Gemini cURL error: $err");

        $data = json_decode($raw, true);
        if ($code === 503) { $last_ex = "Gemini 503 on $model"; continue; } // try fallback
        if ($code >= 400)  throw new RuntimeException("Gemini HTTP $code: " . ($data['error']['message'] ?? $raw));

        return trim($data['candidates'][0]['content']['parts'][0]['text'] ?? '');
    }

    throw new RuntimeException("All Gemini models unavailable: $last_ex");
}

// ─── System prompt 1: Backend schema ─────────────────────────────────────────

function backend_prompt(): string {
    return <<<'PROMPT'
You are a SupaBein database architect. SupaBein is a Backend-as-a-Service with MySQL-backed tables and a REST data API.

Given a project description, return ONLY a raw JSON object — no explanation, no markdown fences.

Format:
{
  "project_name": "string",
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {"name": "col", "type": "VARCHAR(255)|TEXT|INT|BIGINT|BOOLEAN|DECIMAL(10,2)|DATETIME|DATE|TIMESTAMP|JSON|FLOAT", "nullable": true|false, "default": "value_or_null"}
      ],
      "policies": [
        {"api_role": "anon|authenticated", "operation": "SELECT|INSERT|UPDATE|DELETE", "allowed": true|false, "constraint_sql": "optional"}
      ]
    }
  ]
}

Rules:
- Do NOT add id or created_at — auto-created on every table.
- Add user_id INT (nullable: false) on tables owned by a user.
- Anon: SELECT only on public tables, blocked everywhere else.
- Authenticated: full CRUD; use constraint_sql "user_id = :current_user_id" on UPDATE/DELETE for user-owned rows.
- 2–5 realistic tables. Return raw JSON only.
PROMPT;
}

// ─── System prompt 2: Frontend HTML ──────────────────────────────────────────

function frontend_prompt(array $schema, int $pid, string $anon_key, string $base): string {
    $tables_json = json_encode($schema['tables'], JSON_PRETTY_PRINT);
    $project     = htmlspecialchars($schema['project_name']);

    return <<<PROMPT
You are an expert frontend developer. Generate a SINGLE complete index.html file for this project.

Project: {$project}
SupaBein Data API base: {$base}/data/{$pid}
Authorization header: Bearer {$anon_key}

Tables and columns:
{$tables_json}

Requirements:
- Everything in ONE index.html — all CSS and JS inline, zero external dependencies.
- Use fetch() with "Authorization: Bearer {$anon_key}" header on every API call.
- One tab/section per table in a top navigation.
- Each section shows: a table/list of existing records (fetched on load) + a form to add a new record.
- Include a delete button on each row (calls DELETE /data/{$pid}/table_name/id).
- Show loading spinners while fetching. Show user-friendly error messages on failure.
- Modern, clean design: white cards, subtle shadows, green accent (#16db93), dark navy header (#0f3460).
- Fully mobile responsive.
- The page title and h1 should be the project name.
- Return ONLY the raw HTML — no explanation, no markdown fences.
PROMPT;
}

// ─── Step 1: Provision backend ────────────────────────────────────────────────

function provision_backend(array $schema, string $token): array {
    $log     = [];
    $project = supabein('POST', '/projects', ['name' => $schema['project_name']], $token);
    $pid     = $project['id'];
    $log[]   = "✓ Project \"{$schema['project_name']}\" created (ID: $pid)";

    foreach ($schema['tables'] as $table) {
        $tname = $table['name'];
        supabein('POST', "/projects/$pid/tables", ['name' => $tname], $token);
        $log[] = "✓ Table \"$tname\" created";

        foreach ($table['columns'] as $col) {
            $body = ['name' => $col['name'], 'type' => $col['type'], 'nullable' => $col['nullable'] ?? true];
            if (!empty($col['default'])) $body['default'] = $col['default'];
            supabein('POST', "/projects/$pid/tables/$tname/columns", $body, $token);
            $log[] = "  + column {$col['name']} ({$col['type']})";
        }

        if (!empty($table['policies'])) {
            $policies = array_map(function ($p) {
                $out = ['api_role' => $p['api_role'], 'operation' => $p['operation'], 'allowed' => $p['allowed']];
                if (!empty($p['constraint_sql'])) $out['constraint_sql'] = $p['constraint_sql'];
                return $out;
            }, $table['policies']);
            supabein('PUT', "/projects/$pid/tables/$tname/policies", $policies, $token);
            $log[] = "  ✓ Policies set on \"$tname\"";
        }
    }

    return ['log' => $log, 'project_id' => $pid, 'anon_key' => $project['anon_key'], 'service_key' => $project['service_key']];
}

// ─── Step 2: Deploy frontend ──────────────────────────────────────────────────

function deploy_frontend(string $html, int $pid, string $project_name, string $token): array {
    // Derive a safe subdomain from the project name
    $subdomain = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $project_name));
    $subdomain = trim(preg_replace('/-+/', '-', $subdomain), '-');
    $subdomain = substr($subdomain, 0, 40) ?: 'my-project';

    // Create a site
    $site    = supabein('POST', "/projects/$pid/sites", ['subdomain' => $subdomain, 'spa_mode' => false], $token);
    $site_id = $site['id'];

    // Zip the HTML (files at root, not in a subfolder)
    if (!class_exists('ZipArchive')) throw new RuntimeException('ZipArchive not available on this PHP install.');
    $zip_path = tempnam(sys_get_temp_dir(), 'sb_deploy_') . '.zip';
    $zip = new ZipArchive();
    if ($zip->open($zip_path, ZipArchive::CREATE) !== true) throw new RuntimeException('Could not create zip file.');
    $zip->addFromString('index.html', $html);
    $zip->close();

    // Upload and deploy
    $deploy = supabein_upload("/projects/$pid/sites/$site_id/deploys", $zip_path, $token);
    unlink($zip_path);

    // Build the live URL from SUPABEIN_BASE
    $parsed   = parse_url(SUPABEIN_BASE);
    $origin   = $parsed['scheme'] . '://' . $parsed['host'] . (!empty($parsed['port']) ? ':' . $parsed['port'] : '');
    $live_url = "$origin/sites/s{$site_id}/current/";

    return ['site_id' => $site_id, 'subdomain' => $subdomain, 'deploy_id' => $deploy['id'] ?? null, 'live_url' => $live_url];
}

// ─── POST handler ─────────────────────────────────────────────────────────────

$result = null;
$error  = null;
$steps  = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $description = trim($_POST['description'] ?? '');

    if (!$description) {
        $error = 'Please describe your project.';
    } else {
        try {
            // Auth
            $steps[] = ['label' => 'Authenticating with SupaBein...', 'status' => 'running'];
            try {
                $auth = supabein('POST', '/auth/signup', ['email' => SUPABEIN_EMAIL, 'password' => SUPABEIN_PASSWORD]);
            } catch (RuntimeException $e) {
                $auth = supabein('POST', '/auth/login', ['email' => SUPABEIN_EMAIL, 'password' => SUPABEIN_PASSWORD]);
            }
            $token = $auth['token'];
            $steps[count($steps)-1]['status'] = 'done';

            // Gemini: backend schema
            $steps[] = ['label' => 'Asking Gemini to design the backend schema...', 'status' => 'running'];
            $raw = ask_gemini("Build this project on SupaBein:\n\n$description", backend_prompt());
            $raw = preg_replace('/^```(?:json)?\s*/m', '', trim($raw));
            $raw = preg_replace('/\s*```$/m', '', $raw);
            $schema = json_decode(trim($raw), true);
            if (!$schema || empty($schema['tables'])) throw new RuntimeException("Gemini returned invalid schema JSON.\n\nRaw:\n$raw");
            $steps[count($steps)-1]['status'] = 'done';
            $steps[count($steps)-1]['detail'] = count($schema['tables']) . ' tables designed';

            // Provision backend
            $steps[] = ['label' => 'Provisioning backend on SupaBein...', 'status' => 'running'];
            $backend = provision_backend($schema, $token);
            $steps[count($steps)-1]['status'] = 'done';
            $steps[count($steps)-1]['detail'] = "Project ID: {$backend['project_id']}";

            // Gemini: frontend HTML
            $steps[] = ['label' => 'Asking Gemini to generate the frontend...', 'status' => 'running'];
            $html = ask_gemini(
                "Generate the frontend for:\n\n$description",
                frontend_prompt($schema, $backend['project_id'], $backend['anon_key'], SUPABEIN_BASE),
                16384
            );
            // Strip fences
            $html = preg_replace('/^```(?:html)?\s*/mi', '', trim($html));
            $html = preg_replace('/\s*```$/m', '', $html);
            $html = trim($html);
            $steps[count($steps)-1]['status'] = 'done';
            $steps[count($steps)-1]['detail'] = round(strlen($html) / 1024, 1) . ' KB generated';

            // Deploy frontend
            $steps[] = ['label' => 'Deploying frontend to SupaBein Sites...', 'status' => 'running'];
            $deploy = deploy_frontend($html, $backend['project_id'], $schema['project_name'], $token);
            $steps[count($steps)-1]['status'] = 'done';
            $steps[count($steps)-1]['detail'] = $deploy['live_url'];

            $result = array_merge($backend, ['schema' => $schema, 'deploy' => $deploy, 'frontend_html' => $html]);

        } catch (RuntimeException $e) {
            if (!empty($steps)) $steps[count($steps)-1]['status'] = 'error';
            $error = $e->getMessage();
        }
    }
}

// Helper: site base URL for display
$supabein_origin = '';
if ($p = parse_url(SUPABEIN_BASE)) {
    $supabein_origin = $p['scheme'] . '://' . $p['host'] . (!empty($p['port']) ? ':' . $p['port'] : '');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SupaBein AI Builder</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f4f6f9;color:#1a1a2e;min-height:100vh}

header{background:#0f3460;color:#fff;padding:1.2rem 2rem;display:flex;align-items:center;gap:.8rem}
header .logo{background:#16db93;color:#0f3460;font-weight:800;font-size:.85rem;padding:.3rem .5rem;border-radius:4px}
header h1{font-size:1.2rem;font-weight:600}
header small{opacity:.6;font-size:.8rem}

main{max-width:900px;margin:2rem auto;padding:0 1rem}

.card{background:#fff;border-radius:10px;padding:1.8rem;box-shadow:0 2px 12px rgba(0,0,0,.07);margin-bottom:1.5rem}
.card h2{font-size:1rem;color:#0f3460;margin-bottom:1rem;border-bottom:2px solid #16db93;padding-bottom:.4rem;display:inline-block}

label{display:block;font-size:.85rem;font-weight:600;margin-bottom:.4rem;color:#444}
textarea{width:100%;border:1.5px solid #ddd;border-radius:6px;padding:.8rem;font-size:.95rem;resize:vertical;min-height:130px;font-family:inherit;transition:border .2s}
textarea:focus{outline:none;border-color:#16db93}

.examples{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem}
.ex-btn{background:#f0f9f5;border:1px solid #16db93;color:#0f3460;border-radius:20px;padding:.3rem .8rem;font-size:.78rem;cursor:pointer;transition:background .15s}
.ex-btn:hover{background:#16db93}

button[type=submit]{margin-top:1.2rem;background:#16db93;color:#0f3460;border:none;border-radius:6px;padding:.75rem 2rem;font-size:1rem;font-weight:700;cursor:pointer;transition:background .2s}
button[type=submit]:hover{background:#13c47e}
button[type=submit]:disabled{opacity:.5;cursor:not-allowed}

.error{background:#fff0f0;border-left:4px solid #e74c3c;padding:1rem 1.2rem;border-radius:6px;color:#c0392b;font-size:.9rem;white-space:pre-wrap}

/* Steps */
.steps{list-style:none;margin-bottom:1.2rem}
.steps li{display:flex;align-items:flex-start;gap:.7rem;padding:.5rem 0;border-bottom:1px solid #f0f0f0;font-size:.88rem}
.steps li:last-child{border-bottom:none}
.step-icon{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.7rem;margin-top:.1rem}
.step-done{background:#16db93;color:#0f3460}
.step-error{background:#e74c3c;color:#fff}
.step-run{background:#f0f0f0;color:#888;animation:pulse 1s infinite}
.step-text{flex:1}
.step-detail{font-size:.76rem;color:#888;margin-top:.1rem}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

/* Live URL banner */
.live-banner{background:linear-gradient(135deg,#0f3460,#16313e);color:#fff;border-radius:10px;padding:1.5rem 2rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1.2rem}
.live-banner .icon{font-size:2rem}
.live-banner h3{font-size:1rem;margin-bottom:.3rem}
.live-banner a{color:#16db93;font-size:1rem;font-weight:700;word-break:break-all}
.live-banner a:hover{text-decoration:underline}

/* Keys */
.key-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem}
@media(max-width:600px){.key-grid{grid-template-columns:1fr}}
.key-box{background:#f8f9fa;border-radius:6px;padding:.9rem}
.key-box .klabel{font-size:.7rem;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:.3rem}
.key-box .kvalue{font-family:monospace;font-size:.78rem;word-break:break-all;color:#0f3460}

/* Log */
.log{background:#0f3460;color:#a8f0d0;border-radius:6px;padding:1rem;font-family:monospace;font-size:.8rem;line-height:1.8;white-space:pre-wrap}

/* Endpoints */
.endpoint{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
.method{font-size:.7rem;font-weight:700;padding:.15rem .45rem;border-radius:4px;min-width:50px;text-align:center}
.GET{background:#e8f5e9;color:#2e7d32}
.POST{background:#e3f2fd;color:#1565c0}
.PATCH{background:#fff3e0;color:#e65100}
.DELETE{background:#fce4ec;color:#880e4f}
.endpoint code{font-size:.78rem;background:#f4f4f4;padding:.2rem .5rem;border-radius:4px;word-break:break-all}

/* Schema */
.schema-block{background:#1a1a2e;color:#a8f0d0;border-radius:6px;padding:1rem;font-family:monospace;font-size:.78rem;overflow-x:auto;line-height:1.5;white-space:pre}

/* HTML preview */
.html-preview{background:#1a1a2e;color:#cfd8e3;border-radius:6px;padding:1rem;font-family:monospace;font-size:.74rem;overflow:auto;max-height:300px;line-height:1.5;white-space:pre}
.copy-btn{float:right;background:#16db93;color:#0f3460;border:none;border-radius:4px;padding:.25rem .7rem;font-size:.75rem;font-weight:700;cursor:pointer}
</style>
</head>
<body>

<header>
  <span class="logo">SB</span>
  <div>
    <h1>SupaBein AI Builder</h1>
    <small>Gemini 2.5 Flash &mdash; backend + frontend + deploy in one click</small>
  </div>
</header>

<main>

<div class="card">
  <h2>Describe Your Project</h2>
  <form method="POST" id="frm" onsubmit="go()">
    <label for="desc">What do you want to build?</label>
    <textarea name="description" id="desc" placeholder="e.g. A task management app where users can create projects, add tasks with due dates and priorities, and mark them complete."><?= htmlspecialchars($_POST['description'] ?? '') ?></textarea>
    <div class="examples">
      <strong style="font-size:.78rem;color:#888;align-self:center">Try:</strong>
      <button type="button" class="ex-btn" onclick="fill(this)">E-commerce store with products, orders and reviews</button>
      <button type="button" class="ex-btn" onclick="fill(this)">Blog with posts, categories and comments</button>
      <button type="button" class="ex-btn" onclick="fill(this)">Job board with listings, applications and companies</button>
      <button type="button" class="ex-btn" onclick="fill(this)">Booking system for appointments with time slots</button>
    </div>
    <button type="submit" id="btn">&#x2728; Generate, Provision &amp; Deploy</button>
  </form>
</div>

<?php if (!empty($steps)): ?>
<div class="card">
  <h2>Build Progress</h2>
  <ul class="steps">
    <?php foreach ($steps as $s):
      $icon = $s['status'] === 'done' ? '✓' : ($s['status'] === 'error' ? '✕' : '…');
      $cls  = 'step-' . $s['status'];
    ?>
    <li>
      <span class="step-icon <?= $cls ?>"><?= $icon ?></span>
      <div class="step-text">
        <?= htmlspecialchars($s['label']) ?>
        <?php if (!empty($s['detail'])): ?>
        <div class="step-detail"><?= htmlspecialchars($s['detail']) ?></div>
        <?php endif; ?>
      </div>
    </li>
    <?php endforeach; ?>
  </ul>
</div>
<?php endif; ?>

<?php if ($error): ?>
<div class="card"><div class="error"><strong>Error:</strong> <?= nl2br(htmlspecialchars($error)) ?></div></div>
<?php endif; ?>

<?php if ($result): ?>

<!-- Live URL -->
<div class="live-banner">
  <div class="icon">&#x1F680;</div>
  <div>
    <h3>Your project is live!</h3>
    <a href="<?= htmlspecialchars($result['deploy']['live_url']) ?>" target="_blank">
      <?= htmlspecialchars($result['deploy']['live_url']) ?>
    </a>
  </div>
</div>

<!-- Keys -->
<div class="card">
  <h2>API Keys</h2>
  <div class="key-grid">
    <div class="key-box">
      <div class="klabel">Project ID</div>
      <div class="kvalue"><?= $result['project_id'] ?></div>
    </div>
    <div class="key-box">
      <div class="klabel">anon_key — safe for frontend</div>
      <div class="kvalue"><?= htmlspecialchars($result['anon_key']) ?></div>
    </div>
    <div class="key-box" style="grid-column:1/-1">
      <div class="klabel">service_key — server only, never expose publicly</div>
      <div class="kvalue"><?= htmlspecialchars($result['service_key']) ?></div>
    </div>
  </div>
  <div class="log"><?php foreach ($result['log'] as $l) echo htmlspecialchars($l) . "\n"; ?></div>
</div>

<!-- Endpoints -->
<div class="card">
  <h2>API Endpoints</h2>
  <?php foreach ($result['schema']['tables'] as $t):
    $base = SUPABEIN_BASE . '/data/' . $result['project_id'] . '/' . $t['name']; ?>
  <h3 style="font-size:.85rem;font-weight:700;color:#444;margin:.8rem 0 .4rem"><?= htmlspecialchars($t['name']) ?></h3>
  <div class="endpoint"><span class="method GET">GET</span><code><?= $base ?>?limit=20&amp;offset=0</code></div>
  <div class="endpoint"><span class="method POST">POST</span><code><?= $base ?></code></div>
  <div class="endpoint"><span class="method GET">GET</span><code><?= $base ?>/{id}</code></div>
  <div class="endpoint"><span class="method PATCH">PATCH</span><code><?= $base ?>/{id}</code></div>
  <div class="endpoint"><span class="method DELETE">DELETE</span><code><?= $base ?>/{id}</code></div>
  <?php endforeach; ?>
  <p style="margin-top:1rem;font-size:.78rem;color:#888">
    Frontend uses <code>anon_key</code>. Server-side scripts use <code>service_key</code>.
  </p>
</div>

<!-- Generated HTML -->
<div class="card">
  <h2>Generated Frontend HTML
    <button class="copy-btn" onclick="copyHtml()">Copy</button>
  </h2>
  <div class="html-preview" id="html-preview"><?= htmlspecialchars($result['frontend_html']) ?></div>
</div>

<!-- Schema -->
<div class="card">
  <h2>Backend Schema (from Gemini)</h2>
  <pre class="schema-block"><?= htmlspecialchars(json_encode($result['schema'], JSON_PRETTY_PRINT)) ?></pre>
</div>

<?php endif; ?>
</main>

<script>
function fill(btn){ document.getElementById('desc').value = btn.textContent.trim(); }
function go(){
  document.getElementById('btn').disabled = true;
  document.getElementById('btn').textContent = '⏳ Building… this takes ~30 seconds';
}
function copyHtml(){
  const text = document.getElementById('html-preview').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.textContent = 'Copied!';
    setTimeout(()=> btn.textContent='Copy', 2000);
  });
}
</script>
</body>
</html>
