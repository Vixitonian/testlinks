<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Terminals — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header"><h1>Terminals</h1><p>Pickup points and coordinator assignments</p></div>

    <div class="card" style="padding:14px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <label style="font-weight:600;white-space:nowrap;">Event:</label>
        <select id="event-select" class="form-control" style="max-width:320px;" onchange="loadAll()">
          <option value="">— Select event —</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2>Add Terminal</h2></div>
      <div class="form-row">
        <div class="form-group flex-1"><label>Terminal Name</label>
          <input type="text" id="t-name" class="form-control" placeholder="e.g. Terminal A"></div>
        <div class="form-group flex-1"><label>Area (short)</label>
          <input type="text" id="t-area" class="form-control" placeholder="e.g. Lekki"></div>
      </div>
      <div class="form-group"><label>Landmark (full, used in SMS)</label>
        <input type="text" id="t-landmark" class="form-control" placeholder="e.g. Total Filling Station, Lekki Phase 1"></div>
      <div class="form-group"><label>Coordinator</label>
        <select id="t-coord" class="form-control"><option value="">— Assign later —</option></select>
      </div>
      <button class="btn btn-primary" onclick="addTerminal()">Add Terminal</button>
    </div>

    <div class="card">
      <div class="card-header"><h2>Terminals</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Area</th><th>Landmark</th><th>Coordinator</th><th>Bus Info</th><th>Actions</th></tr></thead>
          <tbody id="term-tbody"><tr><td colspan="6" class="text-muted">Select an event.</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script>
let coordinators = [];

async function init() {
  const evRes = await fetchJSON('/api/events.php?action=list');
  const sel = document.getElementById('event-select');
  if (evRes.ok) evRes.data.filter(e=>e.status==='active').forEach(e => {
    const o = document.createElement('option'); o.value = e.id; o.textContent = e.name + ' — ' + formatDate(e.event_date); sel.appendChild(o);
  });
  const stored = activeEventId(); if (stored) sel.value = stored;

  const cRes = await fetchJSON('/api/users.php?action=list&role=coordinator');
  if (cRes.ok) {
    coordinators = cRes.data;
    const coord = document.getElementById('t-coord');
    cRes.data.forEach(u => { const o = document.createElement('option'); o.value=u.id; o.textContent=u.name+' ('+u.phone+')'; coord.appendChild(o); });
  }
  if (sel.value) loadAll();
}

async function loadAll() {
  const event_id = document.getElementById('event-select').value;
  if (!event_id) return;
  setActiveEvent(event_id);
  const res = await fetchJSON('/api/terminals.php?action=list&event_id=' + event_id);
  const tbody = document.getElementById('term-tbody');
  if (!res.ok || !res.data.length) { tbody.innerHTML='<tr><td colspan="6" class="text-muted">No terminals yet.</td></tr>'; return; }
  tbody.innerHTML = res.data.map(t => `
    <tr>
      <td><strong>${escHtml(t.name)}</strong></td>
      <td>${escHtml(t.area)}</td>
      <td style="max-width:200px;">${escHtml(t.landmark)}</td>
      <td>${t.coordinator_name ? escHtml(t.coordinator_name)+'<br><small>'+escHtml(t.coordinator_phone)+'</small>' : '<span style="color:var(--danger)">Unassigned</span>'}</td>
      <td style="max-width:160px;font-size:13px;">${t.bus_info ? escHtml(t.bus_info) : '<span class="text-muted">—</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick='openEdit(${JSON.stringify(t)})'>Edit</button>
        <button class="btn btn-sm btn-danger" onclick="delTerminal(${t.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function addTerminal() {
  const event_id = document.getElementById('event-select').value;
  if (!event_id) { showToast('Select an event first','warning'); return; }
  const fd = new FormData();
  fd.append('event_id', event_id);
  fd.append('name',           document.getElementById('t-name').value.trim());
  fd.append('area',           document.getElementById('t-area').value.trim());
  fd.append('landmark',       document.getElementById('t-landmark').value.trim());
  fd.append('coordinator_id', document.getElementById('t-coord').value);
  const res = await fetchJSON('/api/terminals.php?action=create', { method:'POST', body:fd });
  if (res.ok) { showToast('Terminal added'); ['t-name','t-area','t-landmark'].forEach(id=>document.getElementById(id).value=''); loadAll(); }
  else showToast(res.error,'danger');
}

function openEdit(t) {
  const newName  = prompt('Terminal name:', t.name); if(newName===null) return;
  const newArea  = prompt('Area:', t.area); if(newArea===null) return;
  const newLand  = prompt('Landmark:', t.landmark); if(newLand===null) return;
  const opts     = coordinators.map(c=>`${c.id}:${c.name}`).join(', ');
  const newCoord = prompt(`Coordinator ID (${opts}):`, t.coordinator_id||''); if(newCoord===null) return;
  const newBus   = prompt('Bus info (driver/plate):', t.bus_info||''); if(newBus===null) return;
  const fd = new FormData();
  fd.append('id', t.id); fd.append('name', newName); fd.append('area', newArea);
  fd.append('landmark', newLand); fd.append('coordinator_id', newCoord); fd.append('bus_info', newBus);
  fetchJSON('/api/terminals.php?action=update', { method:'POST', body:fd }).then(res => {
    if(res.ok) { showToast('Updated'); loadAll(); } else showToast(res.error,'danger');
  });
}

async function delTerminal(id) {
  if (!confirm('Delete this terminal?')) return;
  const fd = new FormData(); fd.append('id', id);
  const res = await fetchJSON('/api/terminals.php?action=delete', { method:'POST', body:fd });
  if (res.ok) { showToast('Deleted'); loadAll(); } else showToast(res.error, 'danger');
}

init();
</script>
</body>
</html>
