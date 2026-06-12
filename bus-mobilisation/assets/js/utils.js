const BASE = (() => {
  // Resolve API base relative to this script's location
  const s = document.currentScript?.src || '';
  const m = s.match(/^(.*\/bus-mobilisation)\//);
  return m ? m[1] : '/bus-mobilisation';
})();

async function fetchJSON(path, opts = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'same-origin',
    ...opts,
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
  return json;
}

function showToast(msg, type = 'success') {
  let wrap = document.getElementById('toast-container');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-container';
    wrap.className = 'toast-container';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (type !== 'success' ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

function roleBadge(role) {
  return `<span class="badge badge-${role}">${role}</span>`;
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDatetime(d) {
  if (!d) return '—';
  const dt = new Date(d.replace(' ', 'T') + 'Z');
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function checkAuth(expectedRole) {
  const res = await fetchJSON('/api/auth.php?action=me');
  if (!res.ok) {
    window.location.href = BASE + '/index.php';
    return null;
  }
  if (expectedRole && res.data.role !== expectedRole) {
    window.location.href = BASE + '/index.php';
    return null;
  }
  return res.data;
}

function activeEventId() {
  return localStorage.getItem('active_event_id');
}
function setActiveEvent(id) {
  localStorage.setItem('active_event_id', id);
}
