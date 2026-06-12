<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('coordinator');
$user = $_SESSION['user'];
$terminal_id = (int)($_GET['terminal_id'] ?? 0);
if (!$terminal_id) { header('Location: dashboard.php'); exit; }
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manifest — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <div class="sidebar">
    <div class="sidebar-brand">Bus Mobilisation<small>Coordinator</small></div>
    <nav class="sidebar-nav">
      <a href="dashboard.php"><span class="icon">&#8592;</span> Dashboard</a>
      <a href="manifest.php?terminal_id=<?= $terminal_id ?>" class="active"><span class="icon">&#128203;</span> Manifest</a>
    </nav>
    <div class="sidebar-footer">
      <strong><?= htmlspecialchars($user['name']) ?></strong>
      <a href="../logout.php" style="color:rgba(255,255,255,.6);font-size:12px;">Sign out</a>
    </div>
  </div>
  <div class="main-content">
    <!-- Terminal header -->
    <div id="terminal-header" class="page-header">
      <h1>Manifest</h1>
    </div>

    <!-- Live headcount counter -->
    <div class="headcount-counter" id="hc-counter">
      <div class="hc-item"><div class="hc-val" id="cnt-boarded">0</div><div class="hc-lbl">Boarded</div></div>
      <div class="hc-item"><div class="hc-val" id="cnt-absent">0</div><div class="hc-lbl">Absent</div></div>
      <div class="hc-item"><div class="hc-val" id="cnt-unticked">0</div><div class="hc-lbl">Unticked</div></div>
      <div class="hc-item"><div class="hc-val" id="cnt-total">0</div><div class="hc-lbl">Total</div></div>
    </div>

    <!-- Search -->
    <div style="margin-bottom:14px;">
      <input type="text" id="manifest-search" class="form-control" placeholder="Search name…" oninput="filterManifest()">
    </div>

    <!-- Manifest list -->
    <div id="manifest-list">
      <div class="text-muted">Loading manifest…</div>
    </div>

    <!-- Headcount submit -->
    <div class="card" id="hc-submit-card" style="margin-top:22px;">
      <div class="card-header"><h2>Submit Headcount Slip</h2></div>
      <div id="hc-already-submitted" class="hidden">
        <div class="alert alert-success" id="hc-submitted-msg"></div>
      </div>
      <div id="hc-submit-form">
        <p class="text-muted" style="margin-bottom:14px;font-size:14px;">Submit this when the bus departs. Counts are pre-filled from manifest ticks but you can adjust.</p>
        <div class="form-row">
          <div class="form-group"><label>Boarded Count</label>
            <input type="number" id="hc-boarded-input" class="form-control" min="0"></div>
          <div class="form-group"><label>Absent Count</label>
            <input type="number" id="hc-absent-input" class="form-control" min="0"></div>
          <div class="form-group"><label>Actual Departure Time</label>
            <input type="time" id="hc-depart-input" class="form-control"></div>
        </div>
        <button class="btn btn-primary" onclick="submitHeadcount()">Submit Headcount Slip</button>
      </div>
    </div>
  </div>
</div>

<!-- Confirm modal -->
<div class="modal-overlay hidden" id="hc-modal">
  <div class="modal-box">
    <h2>Confirm Headcount Slip</h2>
    <p style="font-size:14px;margin-bottom:18px;">Are you sure? This cannot be undone.</p>
    <div id="hc-modal-summary" style="font-size:15px;font-weight:600;margin-bottom:16px;"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('hc-modal').classList.add('hidden')">Cancel</button>
      <button class="btn btn-primary" id="hc-confirm-btn" onclick="doSubmitHeadcount()">Confirm &amp; Submit</button>
    </div>
  </div>
</div>

<div id="toast-container" class="toast-container"></div>

<script src="../assets/js/utils.js"></script>
<script src="../assets/js/coordinator-manifest.js"></script>
<script>
const TERMINAL_ID = <?= $terminal_id ?>;
init(TERMINAL_ID);
</script>
</body>
</html>
