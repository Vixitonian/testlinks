<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Events — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header"><h1>Events</h1><p>Manage conferences and event dates</p></div>

    <!-- Create form -->
    <div class="card">
      <div class="card-header"><h2>Create New Event</h2></div>
      <div id="event-form-error" class="alert alert-danger hidden"></div>
      <div class="form-row">
        <div class="form-group flex-1"><label>Event / Conference Name</label>
          <input type="text" id="f-name" class="form-control" placeholder="e.g. National Conference 2025"></div>
        <div class="form-group"><label>Event Date</label>
          <input type="date" id="f-date" class="form-control"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Report Time (24h)</label>
          <input type="time" id="f-report" class="form-control"></div>
        <div class="form-group"><label>Departure Time (24h)</label>
          <input type="time" id="f-depart" class="form-control"></div>
      </div>
      <button class="btn btn-primary" onclick="createEvent()">Create Event</button>
    </div>

    <!-- Events table -->
    <div class="card">
      <div class="card-header"><h2>All Events</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Date</th><th>Report Time</th><th>Departure</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="events-tbody"><tr><td colspan="6" class="text-muted">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script>
async function loadEvents() {
  const res = await fetchJSON('/api/events.php?action=list');
  const tbody = document.getElementById('events-tbody');
  if (!res.ok || !res.data.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No events yet.</td></tr>'; return; }
  tbody.innerHTML = res.data.map(e => `
    <tr id="row-${e.id}">
      <td><strong>${escHtml(e.name)}</strong></td>
      <td>${formatDate(e.event_date)}</td>
      <td>${e.report_time}</td>
      <td>${e.departure_time}</td>
      <td>${statusBadge(e.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editEvent(${e.id},'${escHtml(e.name)}','${e.event_date}','${e.report_time}','${e.departure_time}')">Edit</button>
        ${e.status==='active' ? `<button class="btn btn-sm btn-warning" onclick="archiveEvent(${e.id})">Archive</button>` : ''}
        <button class="btn btn-sm btn-primary" onclick="setActiveEvent('${e.id}');window.location.href='dashboard.php'">View Stats</button>
      </td>
    </tr>
  `).join('');
}

async function createEvent() {
  const fd = new FormData();
  fd.append('name',           document.getElementById('f-name').value.trim());
  fd.append('event_date',     document.getElementById('f-date').value);
  fd.append('report_time',    document.getElementById('f-report').value);
  fd.append('departure_time', document.getElementById('f-depart').value);
  const res = await fetchJSON('/api/events.php?action=create', { method:'POST', body:fd });
  const err = document.getElementById('event-form-error');
  if (res.ok) {
    showToast('Event created!');
    ['f-name','f-date','f-report','f-depart'].forEach(id => document.getElementById(id).value = '');
    err.classList.add('hidden');
    loadEvents();
  } else {
    err.textContent = res.error; err.classList.remove('hidden');
  }
}

function editEvent(id, name, date, report, depart) {
  const newName   = prompt('Event name:', name);
  if (newName === null) return;
  const newDate   = prompt('Event date (YYYY-MM-DD):', date);
  if (newDate === null) return;
  const newReport = prompt('Report time (HH:MM):', report);
  if (newReport === null) return;
  const newDepart = prompt('Departure time (HH:MM):', depart);
  if (newDepart === null) return;
  const fd = new FormData();
  fd.append('id', id); fd.append('name', newName); fd.append('event_date', newDate);
  fd.append('report_time', newReport); fd.append('departure_time', newDepart);
  fetchJSON('/api/events.php?action=update', { method:'POST', body:fd }).then(res => {
    if (res.ok) { showToast('Updated'); loadEvents(); }
    else showToast(res.error, 'danger');
  });
}

async function archiveEvent(id) {
  if (!confirm('Archive this event?')) return;
  const fd = new FormData(); fd.append('id', id);
  const res = await fetchJSON('/api/events.php?action=archive', { method:'POST', body:fd });
  if (res.ok) { showToast('Archived'); loadEvents(); }
  else showToast(res.error, 'danger');
}

loadEvents();
</script>
</body>
</html>
