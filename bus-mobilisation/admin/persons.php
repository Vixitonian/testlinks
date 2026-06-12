<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Persons — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header"><h1>Mobilised Persons</h1><p>Import and manage the mobilised persons list</p></div>

    <div class="card" style="padding:14px 20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <label style="font-weight:600;white-space:nowrap;">Event:</label>
        <select id="event-select" class="form-control" style="max-width:320px;" onchange="onEventChange()">
          <option value="">— Select event —</option>
        </select>
      </div>
    </div>

    <!-- Import -->
    <div class="card">
      <div class="card-header">
        <h2>Import from CSV</h2>
        <a href="../sample/persons_template.csv" class="btn btn-sm btn-outline" download>Download Template</a>
      </div>
      <div id="import-result" class="alert alert-success hidden"></div>
      <div id="import-error" class="alert alert-danger hidden"></div>
      <div style="display:flex;gap:12px;align-items:flex-end;">
        <div class="form-group" style="flex:1;margin:0;">
          <label>CSV File (columns: full_name, phone)</label>
          <input type="file" id="csv-file" class="form-control" accept=".csv">
        </div>
        <button class="btn btn-primary" onclick="importCSV()">Import</button>
      </div>
    </div>

    <!-- Filter + search -->
    <div class="card">
      <div class="card-header">
        <h2>Persons List</h2>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="search" class="form-control" style="width:200px;" placeholder="Search name/phone…" oninput="filterTable()">
          <select id="status-filter" class="form-control" style="width:160px;" onchange="loadPersons()">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="confirmed">Confirmed</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Terminal</th><th>Status</th><th>Calls</th><th>SMS</th></tr></thead>
          <tbody id="persons-tbody"><tr><td colspan="7" class="text-muted">Select an event to view persons.</td></tr></tbody>
        </table>
      </div>
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
  const stored = activeEventId(); if (stored) { sel.value=stored; loadPersons(); }
}

function onEventChange() {
  const id = document.getElementById('event-select').value;
  if (id) setActiveEvent(id);
  loadPersons();
}

async function loadPersons() {
  const event_id = document.getElementById('event-select').value;
  if (!event_id) return;
  const status = document.getElementById('status-filter').value;
  let url = `/api/persons.php?action=list&event_id=${event_id}`;
  if (status) url += '&status=' + status;
  const res = await fetchJSON(url);
  const tbody = document.getElementById('persons-tbody');
  if (!res.ok || !res.data.length) { tbody.innerHTML='<tr><td colspan="7" class="text-muted">No persons found.</td></tr>'; return; }
  tbody.innerHTML = res.data.map((p,i) => `
    <tr data-name="${escHtml(p.full_name).toLowerCase()}" data-phone="${p.phone}">
      <td>${i+1}</td>
      <td><strong>${escHtml(p.full_name)}</strong></td>
      <td>${escHtml(p.phone)}</td>
      <td>${p.terminal_name ? escHtml(p.terminal_name) : '<span class="text-muted">Unassigned</span>'}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${p.call_attempts}</td>
      <td>
        ${p.confirmation_sent ? '<span style="color:var(--success)">&#10003; Sent</span>' :
          p.fallback_sent     ? '<span style="color:var(--warning)">Fallback sent</span>' : '—'}
      </td>
    </tr>
  `).join('');
  filterTable();
}

function filterTable() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#persons-tbody tr').forEach(tr => {
    const match = !q || tr.dataset.name?.includes(q) || tr.dataset.phone?.includes(q);
    tr.style.display = match ? '' : 'none';
  });
}

async function importCSV() {
  const event_id = document.getElementById('event-select').value;
  const file = document.getElementById('csv-file').files[0];
  const resultEl = document.getElementById('import-result');
  const errEl    = document.getElementById('import-error');
  resultEl.classList.add('hidden'); errEl.classList.add('hidden');
  if (!event_id) { errEl.textContent='Select an event first'; errEl.classList.remove('hidden'); return; }
  if (!file) { errEl.textContent='Choose a CSV file'; errEl.classList.remove('hidden'); return; }
  const fd = new FormData();
  fd.append('event_id', event_id);
  fd.append('csv_file', file);
  const res = await fetchJSON('/api/persons.php?action=import', { method:'POST', body:fd });
  if (res.ok) {
    const d = res.data;
    resultEl.textContent = `Imported: ${d.imported}, Skipped: ${d.skipped}` + (d.errors.length ? `. Issues: ${d.errors.slice(0,3).join('; ')}` : '');
    resultEl.classList.remove('hidden');
    document.getElementById('csv-file').value='';
    loadPersons();
  } else { errEl.textContent=res.error; errEl.classList.remove('hidden'); }
}

init();
</script>
</body>
</html>
