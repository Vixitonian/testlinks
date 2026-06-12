<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Headcounts — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header"><h1>Headcount Reports</h1><p>Submitted departure slips per terminal</p></div>

    <div class="card" style="padding:14px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <label style="font-weight:600;white-space:nowrap;">Event:</label>
        <select id="event-select" class="form-control" style="max-width:320px;" onchange="loadHeadcounts()">
          <option value="">— Select event —</option>
        </select>
      </div>
    </div>

    <!-- Summary totals -->
    <div class="stats-row" id="hc-totals" style="display:none;">
      <div class="stat-pill success"><div class="label">Total Boarded</div><div class="value" id="total-boarded">0</div></div>
      <div class="stat-pill danger"><div class="label">Total Absent</div><div class="value" id="total-absent">0</div></div>
      <div class="stat-pill"><div class="label">Slips Submitted</div><div class="value" id="total-slips">0</div></div>
    </div>

    <div class="card">
      <div class="card-header"><h2>Headcount Slips</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Terminal</th><th>Coordinator</th><th>Boarded</th><th>Absent</th><th>Departure Time</th><th>Submitted At</th></tr></thead>
          <tbody id="hc-tbody"><tr><td colspan="6" class="text-muted">Select an event.</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Terminals with no slip yet -->
    <div class="card" id="pending-card" style="display:none;">
      <div class="card-header"><h2>Pending Slips</h2></div>
      <div id="pending-list"></div>
    </div>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script>
async function init() {
  const res = await fetchJSON('/api/events.php?action=list');
  const sel = document.getElementById('event-select');
  if (res.ok) res.data.forEach(e => {
    const o = document.createElement('option'); o.value=e.id; o.textContent=e.name+' — '+formatDate(e.event_date); sel.appendChild(o);
  });
  const stored = activeEventId(); if (stored) { sel.value=stored; loadHeadcounts(); }
}

async function loadHeadcounts() {
  const event_id = document.getElementById('event-select').value;
  if (!event_id) return;
  setActiveEvent(event_id);

  const [hcRes, tRes] = await Promise.all([
    fetchJSON('/api/headcount.php?action=list&event_id=' + event_id),
    fetchJSON('/api/terminals.php?action=list&event_id=' + event_id),
  ]);

  const tbody = document.getElementById('hc-tbody');
  if (!hcRes.ok || !hcRes.data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No slips submitted yet.</td></tr>';
    document.getElementById('hc-totals').style.display = 'none';
  } else {
    let totalBoarded=0, totalAbsent=0;
    tbody.innerHTML = hcRes.data.map(h => {
      totalBoarded += h.boarded_count; totalAbsent += h.absent_count;
      return `<tr>
        <td><strong>${escHtml(h.terminal_name)}</strong></td>
        <td>${escHtml(h.coordinator_name)}</td>
        <td style="color:var(--success);font-weight:700;">${h.boarded_count}</td>
        <td style="color:var(--danger);">${h.absent_count}</td>
        <td>${escHtml(h.actual_departure_time)}</td>
        <td>${formatDatetime(h.submitted_at)}</td>
      </tr>`;
    }).join('');
    document.getElementById('total-boarded').textContent = totalBoarded;
    document.getElementById('total-absent').textContent  = totalAbsent;
    document.getElementById('total-slips').textContent   = hcRes.data.length;
    document.getElementById('hc-totals').style.display   = 'flex';
  }

  // Show terminals without a slip
  if (tRes.ok) {
    const submittedIds = new Set((hcRes.data||[]).map(h => h.terminal_id));
    const pending = tRes.data.filter(t => !submittedIds.has(t.id));
    const pc = document.getElementById('pending-card');
    if (pending.length) {
      document.getElementById('pending-list').innerHTML = pending.map(t =>
        `<div class="alert alert-warning" style="margin-bottom:8px;">&#8987; <strong>${escHtml(t.name)}</strong> — Coordinator: ${t.coordinator_name || 'Unassigned'}</div>`
      ).join('');
      pc.style.display = 'block';
    } else { pc.style.display = 'none'; }
  }
}

init();
</script>
</body>
</html>
