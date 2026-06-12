<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_role('coordinator');
$user = $_SESSION['user'];

// Find terminal(s) for this coordinator
$db = get_db();
$st = $db->prepare("
    SELECT t.*, e.name AS event_name, e.event_date, e.report_time, e.departure_time
    FROM terminals t
    JOIN events e ON t.event_id = e.id
    WHERE t.coordinator_id = ? AND e.status = 'active'
    ORDER BY e.event_date DESC
");
$st->execute([$user['id']]);
$terminals = $st->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coordinator Dashboard — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <div class="sidebar">
    <div class="sidebar-brand">Bus Mobilisation<small>Coordinator</small></div>
    <nav class="sidebar-nav">
      <a href="dashboard.php" class="active"><span class="icon">&#9638;</span> Dashboard</a>
      <?php foreach ($terminals as $t): ?>
        <a href="manifest.php?terminal_id=<?= $t['id'] ?>"><span class="icon">&#128203;</span> <?= htmlspecialchars($t['name']) ?></a>
      <?php endforeach; ?>
    </nav>
    <div class="sidebar-footer">
      <strong><?= htmlspecialchars($user['name']) ?></strong>
      <a href="../logout.php" style="color:rgba(255,255,255,.6);font-size:12px;">Sign out</a>
    </div>
  </div>
  <div class="main-content">
    <div class="page-header">
      <h1>Coordinator Dashboard</h1>
      <p>Night-before checklist and pre-event preparation</p>
    </div>

    <?php if (empty($terminals)): ?>
    <div class="alert alert-warning">
      No active terminals assigned to you. Contact the admin to assign a terminal.
    </div>
    <?php else: ?>
    <?php foreach ($terminals as $t): ?>
    <div class="card">
      <div class="card-header">
        <h2><?= htmlspecialchars($t['name']) ?> — <?= htmlspecialchars($t['event_name']) ?></h2>
        <a href="manifest.php?terminal_id=<?= $t['id'] ?>" class="btn btn-primary">Open Manifest &rarr;</a>
      </div>

      <!-- Event info -->
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:18px;font-size:14px;">
        <div><b>Event Date:</b> <?= htmlspecialchars(date('D d M Y', strtotime($t['event_date']))) ?></div>
        <div><b>Report Time:</b> <?= htmlspecialchars($t['report_time']) ?></div>
        <div><b>Bus Departs:</b> <?= htmlspecialchars($t['departure_time']) ?></div>
        <div><b>Landmark:</b> <?= htmlspecialchars($t['landmark']) ?></div>
      </div>

      <!-- Bus info -->
      <div style="margin-bottom:18px;">
        <label class="form-group" style="font-weight:600;font-size:14px;">Bus / Driver Info</label>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <textarea id="bus-info-<?= $t['id'] ?>" class="form-control" rows="2"
            placeholder="e.g. Driver: John — 0801234567 | Blue coaster, plate AKD-123-YY"
            style="flex:1;"><?= htmlspecialchars($t['bus_info'] ?? '') ?></textarea>
          <button class="btn btn-primary btn-sm" onclick="saveBusInfo(<?= $t['id'] ?>)">Save</button>
        </div>
      </div>

      <!-- Checklist -->
      <div style="margin-bottom:18px;">
        <p style="font-weight:600;font-size:14px;margin-bottom:10px;">Night-Before Checklist</p>
        <label style="display:flex;gap:10px;align-items:center;font-size:14px;margin-bottom:8px;">
          <input type="checkbox" onchange="this.parentElement.style.textDecoration=this.checked?'line-through':''">
          Confirm bus and driver — update bus info above
        </label>
        <label style="display:flex;gap:10px;align-items:center;font-size:14px;margin-bottom:8px;">
          <input type="checkbox" onchange="this.parentElement.style.textDecoration=this.checked?'line-through':''">
          Text base your confirmed count for this terminal
        </label>
        <label style="display:flex;gap:10px;align-items:center;font-size:14px;margin-bottom:8px;">
          <input type="checkbox" onchange="this.parentElement.style.textDecoration=this.checked?'line-through':''">
          Call anyone not yet confirmed (see list below)
        </label>
        <label style="display:flex;gap:10px;align-items:center;font-size:14px;">
          <input type="checkbox" onchange="this.parentElement.style.textDecoration=this.checked?'line-through':''">
          Arrive at landmark 30 mins before report time
        </label>
      </div>

      <!-- Unconfirmed persons -->
      <div>
        <p style="font-weight:600;font-size:14px;margin-bottom:10px;">Unconfirmed Persons (call to verify)</p>
        <div id="unconf-<?= $t['id'] ?>" class="text-muted">Loading…</div>
      </div>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script>
async function loadUnconfirmed(terminalId) {
  const res = await fetchJSON(`/api/manifest.php?action=get&terminal_id=${terminalId}`);
  const el = document.getElementById('unconf-' + terminalId);
  if (!res.ok) { el.textContent = 'Error loading.'; return; }
  const unconf = res.data.persons.filter(p => !p.confirmation_sent || p.boarded === null);
  if (!unconf.length) { el.innerHTML = '<span style="color:var(--success);">&#10003; All persons confirmed.</span>'; return; }
  el.innerHTML = unconf.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;font-size:14px;"><strong>${escHtml(p.full_name)}</strong></div>
      <a href="tel:${escHtml(p.phone)}" class="btn btn-sm btn-success">&#128222; ${escHtml(p.phone)}</a>
    </div>
  `).join('');
}

// Terminal data embedded from PHP for bus_info save
const TERMINAL_DATA = <?= json_encode(array_column($terminals, null, 'id')) ?>;

async function saveBusInfo(terminalId) {
  const val  = document.getElementById('bus-info-' + terminalId).value;
  const term = TERMINAL_DATA[terminalId];
  if (!term) { showToast('Terminal data not found', 'danger'); return; }
  const fd = new FormData();
  fd.append('id',             terminalId);
  fd.append('name',           term.name);
  fd.append('area',           term.area);
  fd.append('landmark',       term.landmark);
  fd.append('coordinator_id', term.coordinator_id || '');
  fd.append('bus_info',       val);
  const res = await fetchJSON('/api/terminals.php?action=update', { method:'POST', body:fd });
  if (res.ok) showToast('Bus info saved'); else showToast(res.error, 'danger');
}

// Load unconfirmed for each terminal
<?php foreach ($terminals as $t): ?>
loadUnconfirmed(<?= $t['id'] ?>);
<?php endforeach; ?>
</script>
</body>
</html>
