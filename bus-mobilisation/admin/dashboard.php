<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Dashboard — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Live overview of all mobilisation activity</p>
    </div>

    <!-- Event selector -->
    <div class="card" style="padding:14px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <label style="font-weight:600;color:var(--primary);white-space:nowrap;">Active Event:</label>
        <select id="event-select" class="form-control" style="max-width:320px;" onchange="onEventChange()">
          <option value="">— Select event —</option>
        </select>
        <button class="btn btn-sm btn-outline" onclick="loadStats()">&#8635; Refresh</button>
        <span id="last-refreshed" class="text-muted"></span>
      </div>
    </div>

    <!-- Alert banners -->
    <div id="alerts-section"></div>

    <!-- Pipeline pills -->
    <div class="stats-row" id="pipeline-pills">
      <div class="stat-pill"><div class="label">Total</div><div class="value" id="pill-total">—</div></div>
      <div class="stat-pill warning"><div class="label">Pending Call</div><div class="value" id="pill-pending">—</div></div>
      <div class="stat-pill accent"><div class="label">Assigned / No SMS</div><div class="value" id="pill-assigned">—</div></div>
      <div class="stat-pill success"><div class="label">Confirmed (SMS sent)</div><div class="value" id="pill-confirmed">—</div></div>
      <div class="stat-pill danger"><div class="label">No-show</div><div class="value" id="pill-nshow">—</div></div>
    </div>

    <!-- Progress bar -->
    <div class="card" style="padding:16px 22px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-weight:600;font-size:14px;">Confirmation Progress</span>
        <span id="progress-label" class="text-muted">—</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" id="progress-fill" style="width:0%"></div>
      </div>
    </div>

    <!-- Terminals grid -->
    <div class="card">
      <div class="card-header"><h2>Terminals</h2></div>
      <div id="terminals-grid" class="text-muted">Select an event to view terminals.</div>
    </div>

    <!-- Caller activity -->
    <div class="card">
      <div class="card-header"><h2>Caller Activity Today</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Caller</th><th>Calls Made</th><th>Answered</th><th>No Answer</th></tr></thead>
          <tbody id="caller-activity-body"><tr><td colspan="4" class="text-muted">No data yet.</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<div id="toast-container" class="toast-container"></div>

<script src="../assets/js/utils.js"></script>
<script src="../assets/js/admin-dashboard.js"></script>
</body>
</html>
