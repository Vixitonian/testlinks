let queueRefreshTimer = null;

async function init() {
  const res = await fetchJSON('/api/events.php?action=list');
  const sel = document.getElementById('event-select');
  if (res.ok) res.data.filter(e => e.status === 'active').forEach(e => {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.name + ' — ' + formatDate(e.event_date);
    sel.appendChild(o);
  });
  const stored = activeEventId();
  if (stored) { sel.value = stored; onEventChange(); }
}

async function onEventChange() {
  const id = document.getElementById('event-select').value;
  if (!id) return;
  setActiveEvent(id);
  // Load event info
  const res = await fetchJSON('/api/events.php?action=get&id=' + id);
  if (res.ok) {
    document.getElementById('ev-date').textContent   = formatDate(res.data.event_date);
    document.getElementById('ev-report').textContent = res.data.report_time;
    document.getElementById('ev-depart').textContent = res.data.departure_time;
    document.getElementById('event-banner').classList.remove('hidden');
    document.getElementById('event-banner').style.display = 'flex';
  }
  loadQueue();
  clearInterval(queueRefreshTimer);
  queueRefreshTimer = setInterval(loadQueue, 30000);
}

async function loadQueue() {
  const event_id = document.getElementById('event-select').value;
  if (!event_id) return;
  const statsRes = await fetchJSON('/api/events.php?action=stats&event_id=' + event_id);
  if (statsRes.ok) {
    const s = statsRes.data.stats;
    const total = parseInt(s.total) || 0;
    const confirmed = parseInt(s.confirmed) || 0;
    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    document.getElementById('queue-progress').style.width = pct + '%';
    document.getElementById('queue-progress-lbl').textContent = `${confirmed} / ${total} confirmed (${pct}%)`;
  }

  const res = await fetchJSON('/api/calls.php?action=queue&event_id=' + event_id);
  const tbody = document.getElementById('queue-tbody');
  if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Error loading queue.</td></tr>'; return; }
  if (!res.data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--success);font-weight:600;">&#10003; All persons in this event have been processed!</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map((p, i) => {
    const attempts = parseInt(p.call_attempts);
    const attColor = attempts === 0 ? '' : attempts === 1 ? 'color:var(--warning)' : 'color:var(--danger)';
    const smsIcon  = p.confirmation_sent ? '&#10003; SMS' : p.fallback_sent ? '&#9889;' : '';
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(p.full_name)}</strong></td>
      <td>${escHtml(p.phone)}</td>
      <td style="${attColor};font-weight:600;">${attempts}</td>
      <td>${p.terminal_name ? escHtml(p.terminal_name) : '<span class="text-muted">—</span>'} ${smsIcon}</td>
      <td>
        <a href="call.php?person_id=${p.id}&event_id=${event_id}" class="btn btn-sm btn-success">
          &#128222; Call
        </a>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('last-refresh').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

init();
