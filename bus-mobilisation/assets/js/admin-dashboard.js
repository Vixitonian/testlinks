let refreshInterval = null;

async function init() {
  // Load events into selector
  const res = await fetchJSON('/api/events.php?action=list');
  const sel = document.getElementById('event-select');
  if (res.ok && res.data.length) {
    res.data.forEach(ev => {
      const o = document.createElement('option');
      o.value = ev.id;
      o.textContent = `${ev.name} — ${formatDate(ev.event_date)} [${ev.status}]`;
      sel.appendChild(o);
    });
    // Restore last selected
    const stored = activeEventId();
    if (stored) sel.value = stored;
    if (sel.value) loadStats();
  }
  // Auto-refresh every 60s
  refreshInterval = setInterval(loadStats, 60000);
}

function onEventChange() {
  const id = document.getElementById('event-select').value;
  if (id) { setActiveEvent(id); loadStats(); }
}

async function loadStats() {
  const event_id = document.getElementById('event-select').value;
  if (!event_id) return;
  const res = await fetchJSON(`/api/events.php?action=stats&event_id=${event_id}`);
  if (!res.ok) { showToast('Failed to load stats', 'danger'); return; }

  const { stats, terminals, caller_activity, alerts } = res.data;

  // Pills
  document.getElementById('pill-total').textContent     = stats.total     || 0;
  document.getElementById('pill-pending').textContent   = stats.pending   || 0;
  document.getElementById('pill-assigned').textContent  = stats.assigned_unsent || 0;
  document.getElementById('pill-confirmed').textContent = stats.confirmed  || 0;
  document.getElementById('pill-nshow').textContent     = stats.no_show   || 0;

  // Progress
  const pct = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = `${stats.confirmed || 0} / ${stats.total || 0} confirmed (${pct}%)`;

  // Alerts
  const alertsEl = document.getElementById('alerts-section');
  alertsEl.innerHTML = '';
  if (alerts.no_coordinator > 0)
    alertsEl.innerHTML += `<div class="alert alert-warning">&#9888; ${alerts.no_coordinator} terminal(s) have no coordinator assigned.</div>`;
  if (alerts.needs_fallback > 0)
    alertsEl.innerHTML += `<div class="alert alert-warning">&#9888; ${alerts.needs_fallback} person(s) need a fallback SMS (2 unanswered calls).</div>`;
  if (alerts.assigned_unsent > 0)
    alertsEl.innerHTML += `<div class="alert alert-info">&#9432; ${alerts.assigned_unsent} person(s) assigned a terminal but confirmation SMS not yet sent.</div>`;

  // Terminals grid
  const grid = document.getElementById('terminals-grid');
  if (!terminals.length) { grid.innerHTML = '<p class="text-muted">No terminals for this event.</p>'; }
  else {
    grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
      ${terminals.map(t => `
        <div style="border:1.5px solid var(--border);border-radius:8px;padding:16px;">
          <div style="font-weight:700;font-size:15px;color:var(--primary);">${escHtml(t.name)}</div>
          <div style="font-size:12px;color:var(--muted);margin:3px 0 10px;">${escHtml(t.landmark)}</div>
          <div style="font-size:13px;">
            <b>Coordinator:</b> ${t.coordinator_name ? escHtml(t.coordinator_name) + ' &nbsp;' + escHtml(t.coordinator_phone) : '<span style="color:var(--danger)">Not assigned</span>'}
          </div>
          <div style="display:flex;gap:10px;margin-top:10px;font-size:13px;">
            <span>Confirmed: <b>${t.count_confirmed||0}</b></span>
            <span>Boarded: <b>${t.count_boarded||0}</b></span>
            <span>Absent: <b>${t.count_absent||0}</b></span>
          </div>
          <div style="margin-top:8px;font-size:12px;">
            Headcount slip: ${t.slip_submitted
              ? `<span style="color:var(--success);font-weight:600;">&#10003; Submitted ${t.slip_submitted.substring(11,16)}</span>`
              : '<span style="color:var(--warning);">&#8987; Pending</span>'}
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  // Caller activity
  const tbody = document.getElementById('caller-activity-body');
  if (!caller_activity.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No calls made today.</td></tr>';
  } else {
    tbody.innerHTML = caller_activity.map(c => `
      <tr>
        <td>${escHtml(c.name)}</td>
        <td>${c.total_calls}</td>
        <td style="color:var(--success);font-weight:600;">${c.answered}</td>
        <td style="color:var(--danger);">${c.no_answer}</td>
      </tr>
    `).join('');
  }

  document.getElementById('last-refreshed').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
}

init();
