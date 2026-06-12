const params   = new URLSearchParams(window.location.search);
const personId = params.get('person_id');
const eventId  = params.get('event_id') || activeEventId();

let person    = null;
let terminals = [];
let callerId  = null;
let dialDone  = false;

async function init() {
  // Get current user
  const meRes = await fetchJSON('/api/auth.php?action=me');
  if (!meRes.ok) { window.location.href = '../index.php'; return; }
  callerId = meRes.data.id;

  if (!personId) { window.location.href = 'dashboard.php'; return; }

  // Load person details
  const pRes = await fetchJSON('/api/persons.php?action=get&id=' + personId);
  if (!pRes.ok) { showToast('Person not found', 'danger'); return; }
  person = pRes.data;

  // Load terminals
  const tRes = await fetchJSON('/api/terminals.php?action=list&event_id=' + (eventId || person.event_id));
  if (tRes.ok) terminals = tRes.data;

  renderCard();
}

function renderCard() {
  const card = document.getElementById('person-card');
  const attempts = parseInt(person.call_attempts);
  card.innerHTML = `
    <div class="person-name">${escHtml(person.full_name)}</div>
    <div class="person-phone">${escHtml(person.phone)}</div>
    <span class="attempt-badge">Attempt ${attempts + 1}</span>
    ${person.terminal_name ? `<div style="margin-top:10px;font-size:14px;color:var(--muted);">Terminal assigned: <strong>${escHtml(person.terminal_name)}</strong></div>` : ''}
  `;

  // Already confirmed
  if (person.confirmation_sent) {
    document.getElementById('already-confirmed').classList.remove('hidden');
    return;
  }

  // Load event info for script
  if (eventId || person.event_id) loadEventScript(eventId || person.event_id);

  // Dial button
  const dialBtn = document.getElementById('dial-btn');
  dialBtn.href = 'tel:' + person.phone;
  dialBtn.textContent = '📞 Call ' + person.full_name;
  document.getElementById('dial-area').style.display = 'block';

  // If already assigned + no SMS → jump straight to SMS button
  if (person.status === 'assigned' && !person.confirmation_sent && person.terminal_id) {
    showSmsConfirmArea();
  }
}

async function loadEventScript(eid) {
  const res = await fetchJSON('/api/events.php?action=get&id=' + eid);
  if (!res.ok) return;
  const ev = res.data;
  document.getElementById('script-name').textContent  = person.full_name;
  document.getElementById('script-event').textContent = ev.name;
  document.getElementById('script-date').textContent  = formatDate(ev.event_date);
  document.getElementById('script-terminals').textContent = terminals.map(t => t.area || t.name).join(', ');
  document.getElementById('call-script').style.display = 'block';
}

function onDialClick(e) {
  // Allow the tel: link to fire naturally, then show outcome buttons
  setTimeout(() => {
    document.getElementById('outcome-area').classList.remove('hidden');
    dialDone = true;
  }, 800);
}

async function handleOutcome(outcome) {
  document.getElementById('outcome-area').classList.add('hidden');

  if (outcome === 'answered') {
    // Populate terminal dropdown
    const sel = document.getElementById('terminal-select');
    sel.innerHTML = '<option value="">— Select terminal —</option>';
    terminals.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.name + ' — ' + t.area;
      sel.appendChild(o);
    });
    document.getElementById('terminal-area').classList.remove('hidden');
  } else {
    // no_answer: log it
    const fd = new FormData();
    fd.append('person_id',   personId);
    fd.append('caller_id',   callerId);
    fd.append('outcome',     'no_answer');
    const res = await fetchJSON('/api/calls.php?action=log_attempt', { method: 'POST', body: fd });
    if (!res.ok) { showToast(res.error || 'Error logging call', 'danger'); return; }
    const data = res.data;

    if (data.should_send_fallback) {
      document.getElementById('fallback-area').classList.remove('hidden');
    }
    document.getElementById('nav-area').classList.remove('hidden');
    showToast('Call logged — no answer', 'warning');
  }
}

async function confirmTerminal() {
  const terminal_id = document.getElementById('terminal-select').value;
  if (!terminal_id) { showToast('Select a terminal first', 'warning'); return; }

  const fd = new FormData();
  fd.append('person_id',   personId);
  fd.append('caller_id',   callerId);
  fd.append('outcome',     'answered');
  fd.append('terminal_id', terminal_id);
  const res = await fetchJSON('/api/calls.php?action=log_attempt', { method: 'POST', body: fd });
  if (!res.ok) { showToast(res.error || 'Error', 'danger'); return; }

  // Reload person
  const pRes = await fetchJSON('/api/persons.php?action=get&id=' + personId);
  if (pRes.ok) person = pRes.data;

  document.getElementById('terminal-area').classList.add('hidden');
  showSmsConfirmArea();
  showToast('Terminal assigned!');
}

function showSmsConfirmArea() {
  const area = document.getElementById('sms-confirm-area');
  area.classList.remove('hidden');
  document.getElementById('sms-confirm-msg').textContent =
    `Ready to send confirmation SMS to ${person.full_name}`;
}

async function sendConfirmationSMS() {
  const btn = document.getElementById('sms-confirm-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const fd = new FormData(); fd.append('person_id', personId);
  const res = await fetchJSON('/api/sms.php?action=send_confirmation', { method: 'POST', body: fd });
  if (res.ok) {
    btn.textContent = '✓ SMS Sent';
    document.getElementById('sms-confirm-msg').textContent = 'Confirmation SMS sent successfully!';
    showToast('SMS sent to ' + person.full_name);
    document.getElementById('nav-area').classList.remove('hidden');
    setTimeout(() => { window.location.href = 'dashboard.php'; }, 2200);
  } else {
    btn.disabled = false; btn.textContent = '📱 Send Confirmation SMS';
    showToast(res.error || 'SMS failed', 'danger');
  }
}

async function sendFallbackSMS() {
  const btn = document.getElementById('fallback-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const fd = new FormData(); fd.append('person_id', personId);
  const res = await fetchJSON('/api/sms.php?action=send_fallback', { method: 'POST', body: fd });
  if (res.ok) {
    btn.textContent = '✓ Fallback SMS Sent';
    showToast('Fallback SMS sent');
    document.getElementById('nav-area').classList.remove('hidden');
  } else {
    btn.disabled = false; btn.textContent = '📱 Send Fallback SMS';
    showToast(res.error || 'SMS failed', 'danger');
  }
}

init();
