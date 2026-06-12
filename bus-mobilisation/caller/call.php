<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('caller');
$user = $_SESSION['user'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Call — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
<style>
.script-box { background:#f8f9fa; border-left:4px solid var(--primary); padding:14px 18px; border-radius:6px; font-size:14px; line-height:1.7; color:var(--text-sm); margin-bottom:18px; font-style:italic; }
.script-box strong { color:var(--primary); font-style:normal; }
</style>
</head>
<body>
<div class="page-wrap">
  <div class="sidebar">
    <div class="sidebar-brand">Bus Mobilisation<small>Caller</small></div>
    <nav class="sidebar-nav">
      <a href="dashboard.php"><span class="icon">&#8592;</span> Back to Queue</a>
    </nav>
    <div class="sidebar-footer">
      <strong><?= htmlspecialchars($user['name']) ?></strong>
      <a href="../logout.php" style="color:rgba(255,255,255,.6);font-size:12px;">Sign out</a>
    </div>
  </div>
  <div class="main-content" style="max-width:620px;">

    <div id="toast-container" class="toast-container"></div>

    <!-- Person card -->
    <div class="call-person-card" id="person-card">
      <div class="text-muted">Loading…</div>
    </div>

    <!-- Call script -->
    <div class="script-box" id="call-script" style="display:none;">
      <strong>Call script:</strong><br>
      Good morning, <strong id="script-name">—</strong>. Calling from the <strong id="script-event">—</strong> team — you're confirmed for <strong id="script-date">—</strong>.<br>
      We're running buses from fixed pickup points so transport is sorted.<br>
      Which of these is nearest you: <span id="script-terminals" style="color:var(--primary);font-style:normal;font-weight:600;">—</span>?
    </div>

    <!-- Dial button area -->
    <div id="dial-area" style="text-align:center;margin-bottom:22px;display:none;">
      <a id="dial-btn" href="#" class="btn-call" onclick="onDialClick(event)">
        &#128222; Call —
      </a>
      <p class="text-muted" style="margin-top:10px;font-size:13px;">Tapping will open your phone dialer. Come back here to log the outcome.</p>
    </div>

    <!-- Outcome buttons -->
    <div id="outcome-area" class="hidden card" style="text-align:center;padding:24px;">
      <p style="font-weight:600;margin-bottom:16px;">What was the outcome of this call?</p>
      <div class="outcome-buttons">
        <button class="btn btn-success btn-lg" onclick="handleOutcome('answered')">&#10003; Answered</button>
        <button class="btn btn-danger"          onclick="handleOutcome('no_answer')">&#10007; No Answer</button>
      </div>
    </div>

    <!-- Terminal selection (after answered) -->
    <div id="terminal-area" class="hidden card" style="padding:22px;">
      <p style="font-weight:600;margin-bottom:12px;">Which terminal did they choose?</p>
      <div class="form-group">
        <select id="terminal-select" class="form-control">
          <option value="">— Select terminal —</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="confirmTerminal()">Assign Terminal &amp; Continue</button>
    </div>

    <!-- Confirmation SMS button -->
    <div id="sms-confirm-area" class="hidden card" style="padding:22px;text-align:center;">
      <div class="alert alert-success" style="margin-bottom:16px;" id="sms-confirm-msg"></div>
      <button class="btn btn-success btn-lg" id="sms-confirm-btn" onclick="sendConfirmationSMS()">
        &#128172; Send Confirmation SMS
      </button>
      <p class="text-muted" style="margin-top:10px;font-size:13px;">Sends terminal, report time, coordinator contact to the person.</p>
    </div>

    <!-- Fallback SMS -->
    <div id="fallback-area" class="hidden card" style="padding:22px;background:#fffbf0;border:1.5px solid var(--accent);">
      <div class="alert alert-warning" style="margin-bottom:14px;">
        <strong>2 unanswered attempts</strong> — Send a fallback SMS asking them to call back.
      </div>
      <button class="btn btn-warning btn-lg" id="fallback-btn" onclick="sendFallbackSMS()">
        &#128172; Send Fallback SMS
      </button>
    </div>

    <!-- Already confirmed -->
    <div id="already-confirmed" class="hidden card" style="padding:22px;text-align:center;">
      <div class="alert alert-success">&#10003; Confirmation SMS already sent to this person.</div>
      <a href="dashboard.php" class="btn btn-primary">Back to Queue</a>
    </div>

    <!-- Navigation -->
    <div id="nav-area" class="hidden" style="text-align:center;margin-top:18px;">
      <a href="dashboard.php" class="btn btn-outline">&#8592; Back to Queue</a>
    </div>
  </div>
</div>

<script src="../assets/js/utils.js"></script>
<script src="../assets/js/caller-call.js"></script>
</body>
</html>
