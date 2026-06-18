<?php
/**
 * SupaBein AI Builder
 * Upload this file to your cPanel public_html (or any folder).
 * Visit it in the browser, describe your project, and it provisions everything.
 *
 * Config: edit the three constants below, or set them as cPanel ENV vars.
 */

define('SUPABEIN_BASE',     getenv('SUPABEIN_BASE')     ?: 'http://supabein.dxinnovationhub.com/api/v1');
define('SUPABEIN_EMAIL',    getenv('SUPABEIN_EMAIL')    ?: 'your@email.com');
define('SUPABEIN_PASSWORD', getenv('SUPABEIN_PASSWORD') ?: 'yourpassword');
define('GEMINI_API_KEY',    getenv('GEMINI_API_KEY')    ?: 'your_gemini_api_key');
define('GEMINI_MODEL',      'gemini-2.5-flash');

// ─── SupaBein API helper ───────────────────────────────────────────────────────

function supabein(string $method, string $path, $body = null, string $token = null): array {
    $url = SUPABEIN_BASE . $path;
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) throw new RuntimeException("cURL error: $err");

    $data = json_decode($raw, true);
    if ($code >= 400) {
        $msg = $data['message'] ?? $data['error'] ?? $raw;
        throw new RuntimeException("SupaBein HTTP $code: $msg");
    }
    return $data ?? [];
}

// ─── Gemini API helper ────────────────────────────────────────────────────────

function ask_gemini(string $prompt, string $system): string {
    $url     = "https://generativelanguage.googleapis.com/v1beta/models/" . GEMINI_MODEL . ":generateContent";
    $payload = [
        'system_instruction' => ['parts' => [['text' => $system]]],
        'contents'           => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
        'generationConfig'   => ['temperature' => 0.1, 'maxOutputTokens' => 8192],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . GEMINI_API_KEY,
        ],
        CURLOPT_TIMEOUT => 60,
    ]);

    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) throw new RuntimeException("Gemini cURL error: $err");

    $data = json_decode($raw, true);
    if ($code >= 400) {
        $msg = $data['error']['message'] ?? $raw;
        // Auto-fallback to gemini-2.5-flash if 3.5 is overloaded
        if ($code === 503 && GEMINI_MODEL === 'gemini-3.5-flash') {
            return ask_gemini_model($prompt, $system, 'gemini-2.5-flash');
        }
        throw new RuntimeException("Gemini HTTP $code: $msg");
    }

    return trim($data['candidates'][0]['content']['parts'][0]['text'] ?? '');
}

// ─── System prompt: full SupaBein API docs ────────────────────────────────────

function supabein_system_prompt(): string {
    return <<<'PROMPT'
You are a SupaBein expert. SupaBein is a Backend-as-a-Service with auth, MySQL-backed tables, a data API, file storage, and site hosting.

Your job: given a project description, return ONLY a valid JSON object describing the project schema. No explanation, no markdown, no code fences — raw JSON only.

JSON format:
{
  "project_name": "string",
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {"name": "col_name", "type": "VARCHAR(255)|TEXT|INT|BIGINT|BOOLEAN|DECIMAL(10,2)|DATETIME|DATE|TIMESTAMP|JSON|FLOAT", "nullable": true|false, "default": "optional_default_or_null"}
      ],
      "policies": [
        {"api_role": "anon|authenticated", "operation": "SELECT|INSERT|UPDATE|DELETE", "allowed": true|false, "constraint_sql": "optional, e.g. user_id = :current_user_id or status = 'published'"}
      ]
    }
  ]
}

Rules:
- Do NOT include id or created_at columns — they are added automatically.
- Use user_id INT on any table that belongs to a user.
- Anon role: usually SELECT only on public data, nothing else.
- Authenticated role: full CRUD, with constraint_sql "user_id = :current_user_id" on UPDATE/DELETE for user-owned rows.
- Tables that are truly public (like categories, tags) allow anon SELECT.
- Include 2–5 realistic tables for the described project.
- Return ONLY the JSON object, nothing else.
PROMPT;
}

// ─── Provision project from schema ───────────────────────────────────────────

function provision(array $schema, string $token): array {
    $log     = [];
    $project = supabein('POST', '/projects', ['name' => $schema['project_name']], $token);
    $pid     = $project['id'];
    $log[]   = "✓ Project \"{$schema['project_name']}\" created (ID: $pid)";

    foreach ($schema['tables'] as $table) {
        $tname = $table['name'];
        supabein('POST', "/projects/$pid/tables", ['name' => $tname], $token);
        $log[] = "✓ Table \"$tname\" created";

        foreach ($table['columns'] as $col) {
            $body = [
                'name'     => $col['name'],
                'type'     => $col['type'],
                'nullable' => $col['nullable'] ?? true,
            ];
            if (!empty($col['default'])) $body['default'] = $col['default'];
            supabein('POST', "/projects/$pid/tables/$tname/columns", $body, $token);
            $log[] = "  + column {$col['name']} ({$col['type']})";
        }

        if (!empty($table['policies'])) {
            $policies = array_map(function($p) {
                $out = [
                    'api_role'  => $p['api_role'],
                    'operation' => $p['operation'],
                    'allowed'   => $p['allowed'],
                ];
                if (!empty($p['constraint_sql'])) $out['constraint_sql'] = $p['constraint_sql'];
                return $out;
            }, $table['policies']);
            supabein('PUT', "/projects/$pid/tables/$tname/policies", $policies, $token);
            $log[] = "  ✓ Policies set on \"$tname\"";
        }
    }

    return [
        'log'         => $log,
        'project_id'  => $pid,
        'anon_key'    => $project['anon_key'],
        'service_key' => $project['service_key'],
        'schema'      => $schema,
    ];
}

// ─── Handle POST ──────────────────────────────────────────────────────────────

$result = null;
$error  = null;
$schema_json = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $description = trim($_POST['description'] ?? '');

    if (!$description) {
        $error = 'Please describe your project.';
    } else {
        try {
            // 1. Login to SupaBein
            try {
                $auth = supabein('POST', '/auth/signup', ['email' => SUPABEIN_EMAIL, 'password' => SUPABEIN_PASSWORD]);
            } catch (RuntimeException $e) {
                $auth = supabein('POST', '/auth/login', ['email' => SUPABEIN_EMAIL, 'password' => SUPABEIN_PASSWORD]);
            }
            $token = $auth['token'];

            // 2. Ask Gemini for schema
            $raw_schema = ask_gemini(
                "Build this project on SupaBein:\n\n$description",
                supabein_system_prompt()
            );

            // Strip markdown fences if Gemini adds them
            $raw_schema = preg_replace('/^```(?:json)?\s*/m', '', $raw_schema);
            $raw_schema = preg_replace('/\s*```$/m', '', $raw_schema);

            $schema = json_decode(trim($raw_schema), true);
            if (!$schema || empty($schema['tables'])) {
                throw new RuntimeException("Gemini returned invalid JSON. Raw response:\n$raw_schema");
            }

            $schema_json = json_encode($schema, JSON_PRETTY_PRINT);

            // 3. Provision on SupaBein
            $result = provision($schema, $token);

        } catch (RuntimeException $e) {
            $error = $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SupaBein AI Builder</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #f4f6f9; color: #1a1a2e; min-height: 100vh; }

  header { background: #0f3460; color: #fff; padding: 1.2rem 2rem; display: flex; align-items: center; gap: .8rem; }
  header span.logo { background: #16db93; color: #0f3460; font-weight: 800; font-size: .85rem; padding: .3rem .5rem; border-radius: 4px; }
  header h1 { font-size: 1.2rem; font-weight: 600; }
  header small { opacity: .6; font-size: .8rem; }

  main { max-width: 860px; margin: 2rem auto; padding: 0 1rem; }

  .card { background: #fff; border-radius: 10px; padding: 1.8rem; box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 1.5rem; }
  .card h2 { font-size: 1rem; color: #0f3460; margin-bottom: 1rem; border-bottom: 2px solid #16db93; padding-bottom: .4rem; display: inline-block; }

  label { display: block; font-size: .85rem; font-weight: 600; margin-bottom: .4rem; color: #444; }
  textarea { width: 100%; border: 1.5px solid #ddd; border-radius: 6px; padding: .8rem; font-size: .95rem; resize: vertical; min-height: 130px; font-family: inherit; transition: border .2s; }
  textarea:focus { outline: none; border-color: #16db93; }

  .examples { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .6rem; }
  .example-btn { background: #f0f9f5; border: 1px solid #16db93; color: #0f3460; border-radius: 20px; padding: .3rem .8rem; font-size: .78rem; cursor: pointer; transition: background .15s; }
  .example-btn:hover { background: #16db93; }

  button[type=submit] { margin-top: 1.2rem; background: #16db93; color: #0f3460; border: none; border-radius: 6px; padding: .75rem 2rem; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background .2s; }
  button[type=submit]:hover { background: #13c47e; }
  button[type=submit]:disabled { opacity: .5; cursor: not-allowed; }

  .error { background: #fff0f0; border-left: 4px solid #e74c3c; padding: 1rem 1.2rem; border-radius: 6px; color: #c0392b; font-size: .9rem; white-space: pre-wrap; }

  .success-banner { background: #f0fdf7; border-left: 4px solid #16db93; padding: 1rem 1.2rem; border-radius: 6px; margin-bottom: 1rem; }
  .success-banner h3 { color: #0f3460; margin-bottom: .3rem; }
  .success-banner p  { font-size: .85rem; color: #555; }

  .key-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.2rem; }
  @media(max-width:600px) { .key-grid { grid-template-columns: 1fr; } }

  .key-box { background: #f8f9fa; border-radius: 6px; padding: .9rem; }
  .key-box .label { font-size: .7rem; font-weight: 700; text-transform: uppercase; color: #888; margin-bottom: .3rem; }
  .key-box .value { font-family: monospace; font-size: .78rem; word-break: break-all; color: #0f3460; }

  .log { background: #0f3460; color: #a8f0d0; border-radius: 6px; padding: 1rem; font-family: monospace; font-size: .82rem; line-height: 1.7; }

  .endpoints h3 { font-size: .85rem; font-weight: 700; color: #444; margin-bottom: .5rem; }
  .endpoint { display: flex; align-items: center; gap: .5rem; margin-bottom: .4rem; }
  .method { font-size: .7rem; font-weight: 700; padding: .15rem .45rem; border-radius: 4px; min-width: 42px; text-align: center; }
  .GET    { background: #e8f5e9; color: #2e7d32; }
  .POST   { background: #e3f2fd; color: #1565c0; }
  .PATCH  { background: #fff3e0; color: #e65100; }
  .DELETE { background: #fce4ec; color: #880e4f; }
  .endpoint code { font-size: .78rem; background: #f4f4f4; padding: .2rem .5rem; border-radius: 4px; word-break: break-all; }

  .schema-block { background: #1a1a2e; color: #a8f0d0; border-radius: 6px; padding: 1rem; font-family: monospace; font-size: .78rem; overflow-x: auto; line-height: 1.5; }

  .spinner { display: none; margin-left: .5rem; }
  .loading .spinner { display: inline-block; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<header>
  <span class="logo">SB</span>
  <div>
    <h1>SupaBein AI Builder</h1>
    <small>Powered by Gemini 2.5 Flash &mdash; describe a project, get a live backend</small>
  </div>
</header>

<main>

  <div class="card">
    <h2>Describe Your Project</h2>
    <form method="POST" id="form" onsubmit="startLoading()">
      <label for="description">What do you want to build?</label>
      <textarea name="description" id="description" placeholder="e.g. A task management app where users can create projects, add tasks with due dates and priorities, and mark them complete."><?= htmlspecialchars($_POST['description'] ?? '') ?></textarea>

      <div class="examples">
        <strong style="font-size:.78rem;color:#888;align-self:center">Try:</strong>
        <button type="button" class="example-btn" onclick="fill(this)">E-commerce store with products, orders and reviews</button>
        <button type="button" class="example-btn" onclick="fill(this)">Blog with posts, categories and comments</button>
        <button type="button" class="example-btn" onclick="fill(this)">Booking system for appointments with time slots</button>
        <button type="button" class="example-btn" onclick="fill(this)">Job board with listings, applications and companies</button>
      </div>

      <button type="submit" id="btn">
        &#x2728; Generate &amp; Provision
        <span class="spinner" id="spinner">&#x21BB;</span>
      </button>
    </form>
  </div>

  <?php if ($error): ?>
  <div class="card">
    <div class="error"><strong>Error:</strong> <?= nl2br(htmlspecialchars($error)) ?></div>
  </div>
  <?php endif; ?>

  <?php if ($result): ?>

  <div class="card">
    <div class="success-banner">
      <h3>&#x2714; Project provisioned on SupaBein!</h3>
      <p>Your backend is live. Use the keys below to connect your frontend.</p>
    </div>

    <div class="key-grid">
      <div class="key-box">
        <div class="label">Project ID</div>
        <div class="value"><?= $result['project_id'] ?></div>
      </div>
      <div class="key-box">
        <div class="label">anon_key &mdash; safe for frontend</div>
        <div class="value"><?= htmlspecialchars($result['anon_key']) ?></div>
      </div>
      <div class="key-box" style="grid-column:1/-1">
        <div class="label">service_key &mdash; server-side only, never expose</div>
        <div class="value"><?= htmlspecialchars($result['service_key']) ?></div>
      </div>
    </div>

    <div class="log">
<?php foreach ($result['log'] as $line): ?><?= htmlspecialchars($line) ?>
<?php endforeach; ?>
    </div>
  </div>

  <div class="card endpoints">
    <h2>Your API Endpoints</h2>
    <?php foreach ($result['schema']['tables'] as $t): ?>
    <h3 style="margin-top:.8rem;margin-bottom:.4rem"><?= htmlspecialchars($t['name']) ?></h3>
    <?php $base = SUPABEIN_BASE . '/data/' . $result['project_id'] . '/' . $t['name']; ?>
    <div class="endpoint"><span class="method GET">GET</span>   <code><?= $base ?>?limit=20&amp;offset=0</code></div>
    <div class="endpoint"><span class="method POST">POST</span>  <code><?= $base ?></code></div>
    <div class="endpoint"><span class="method GET">GET</span>   <code><?= $base ?>/{id}</code></div>
    <div class="endpoint"><span class="method PATCH">PATCH</span> <code><?= $base ?>/{id}</code></div>
    <div class="endpoint"><span class="method DELETE">DELETE</span><code><?= $base ?>/{id}</code></div>
    <?php endforeach; ?>
    <p style="margin-top:1rem;font-size:.78rem;color:#888">
      Use <code>Authorization: Bearer &lt;anon_key&gt;</code> for frontend calls.<br>
      Use <code>Authorization: Bearer &lt;service_key&gt;</code> on your server to bypass policies.
    </p>
  </div>

  <div class="card">
    <h2>Generated Schema (from Gemini)</h2>
    <pre class="schema-block"><?= htmlspecialchars($schema_json) ?></pre>
  </div>

  <?php endif; ?>

</main>

<script>
function fill(btn) {
  document.getElementById('description').value = btn.textContent.trim();
}
function startLoading() {
  document.getElementById('btn').disabled = true;
  document.getElementById('btn').classList.add('loading');
  document.getElementById('spinner').style.display = 'inline-block';
}
</script>
</body>
</html>
