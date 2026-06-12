<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_role('caller');
$user = $_SESSION['user'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Call Queue — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <div class="sidebar">
    <div class="sidebar-brand">Bus Mobilisation<small>Caller Dashboard</small></div>
    <nav class="sidebar-nav">
      <a href="dashboard.php" class="active"><span class="icon">&#128222;</span> Call Queue</a>
    </nav>
    <div class="sidebar-footer">
      <strong><?= htmlspecialchars($user['name']) ?></strong>
      <a href="../logout.php" style="color:rgba(255,255,255,.6);font-size:12px;">Sign out</a>
    </div>
  </div>
  <div class="main-content">
    <div class="page-header">
      <h1>Call Queue</h1>
      <p>Select an event, then work through your call list</p>
    </div>

    <div class="card" style="padding:14px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <label style="font-weight:600;white-space:nowrap;">Event:</label>
        <select id="event-select" class="form-control" style="max-width:320px;" onchange="onEventChange()">
          <option value="">— Select event —</option>
        </select>
        <button class="btn btn-sm btn-outline" onclick="loadQueue()">&#8635; Refresh</button>
        <span id="last-refresh" class="text-muted"></span>
      </div>
    </div>

    <!-- Event info banner -->
    <div id="event-banner" class="hidden" style="background:var(--primary);color:#fff;padding:14px 22px;border-radius:8px;margin-bottom:18px;font-size:14px;display:flex;gap:28px;flex-wrap:wrap;">
      <span><b>Date:</b> <span id="ev-date">—</span></span>
      <span><b>Report time:</b> <span id="ev-report">—</span></span>
      <span><b>Bus departs:</b> <span id="ev-depart">—</span></span>
    </div>

    <!-- Progress -->
    <div class="card" style="padding:16px 22px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-weight:600;">Queue progress</span>
        <span id="queue-progress-lbl" class="text-muted">—</span>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" id="queue-progress" style="width:0%"></div></div>
    </div>

    <!-- Queue table -->
    <div class="card">
      <div class="card-header"><h2>Persons to Call</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Attempts</th><th>Terminal</th><th>Action</th></tr></thead>
          <tbody id="queue-tbody"><tr><td colspan="6" class="text-muted">Select an event to load the queue.</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script src="../assets/js/caller-queue.js"></script>
</body>
</html>
