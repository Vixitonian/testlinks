let manifestData = null;
let terminalId   = null;

async function init(tid) {
  terminalId = tid;
  await loadManifest();
  await checkExistingSlip();
}

async function loadManifest() {
  const res = await fetchJSON('/api/manifest.php?action=get&terminal_id=' + terminalId);
  if (!res.ok) { showToast('Error loading manifest', 'danger'); return; }
  manifestData = res.data;

  // Update header
  const t = manifestData.terminal;
  document.getElementById('terminal-header').innerHTML = `
    <h1>${escHtml(t.name)} — Manifest</h1>
    <p>${escHtml(t.event_name)} &nbsp;|&nbsp; ${formatDate(t.event_date)} &nbsp;|&nbsp; Departs: <strong>${escHtml(t.departure_time)}</strong> &nbsp;|&nbsp; Landmark: ${escHtml(t.landmark)}</p>
  `;

  renderManifest();
  updateCounters();
  prefillHeadcountInputs();
}

function renderManifest() {
  const list = document.getElementById('manifest-list');
  const persons = manifestData.persons;
  if (!persons.length) {
    list.innerHTML = '<div class="alert alert-warning">No persons assigned to this terminal yet.</div>';
    return;
  }
  list.innerHTML = persons.map(p => {
    const boarded  = p.boarded == 1;
    const absent   = p.boarded == 0 || p.boarded === '0';
    const unticked = p.boarded === null || p.boarded === '';
    const rowClass = boarded ? 'boarded' : absent ? 'absent' : 'unticked';
    return `<div class="manifest-row ${rowClass}" id="mrow-${p.id}" data-name="${escHtml(p.full_name).toLowerCase()}">
      <div class="person-info">
        <strong>${escHtml(p.full_name)}</strong>
        <a href="tel:${escHtml(p.phone)}">${escHtml(p.phone)}</a>
      </div>
      <div class="manifest-toggle">
        <button class="btn-board  ${boarded  ? 'active' : ''}" onclick="markPerson(${p.id}, 1, this)">Boarded</button>
        <button class="btn-absent ${absent   ? 'active' : ''}" onclick="markPerson(${p.id}, 0, this)">Absent</button>
      </div>
    </div>`;
  }).join('');
}

async function markPerson(personId, boarded, btn) {
  const fd = new FormData();
  fd.append('person_id', personId);
  fd.append('boarded', boarded);
  const res = await fetchJSON('/api/manifest.php?action=mark', { method: 'POST', body: fd });
  if (!res.ok) { showToast(res.error || 'Error', 'danger'); return; }

  // Update local data
  const p = manifestData.persons.find(x => x.id == personId);
  if (p) p.boarded = boarded;

  // Update row styling
  const row = document.getElementById('mrow-' + personId);
  row.className = 'manifest-row ' + (boarded ? 'boarded' : 'absent');
  row.querySelectorAll('.btn-board, .btn-absent').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  updateCounters();
  prefillHeadcountInputs();
}

function updateCounters() {
  if (!manifestData) return;
  const c = manifestData.counts;
  // Recount from live data
  let boarded=0, absent=0, unticked=0;
  manifestData.persons.forEach(p => {
    if (p.boarded == 1) boarded++;
    else if (p.boarded == 0 || p.boarded === '0') absent++;
    else unticked++;
  });
  document.getElementById('cnt-boarded').textContent  = boarded;
  document.getElementById('cnt-absent').textContent   = absent;
  document.getElementById('cnt-unticked').textContent = unticked;
  document.getElementById('cnt-total').textContent    = manifestData.persons.length;
}

function prefillHeadcountInputs() {
  if (!manifestData) return;
  let boarded=0, absent=0;
  manifestData.persons.forEach(p => {
    if (p.boarded == 1) boarded++;
    else if (p.boarded == 0 || p.boarded === '0') absent++;
  });
  document.getElementById('hc-boarded-input').value = boarded;
  document.getElementById('hc-absent-input').value  = absent;
}

async function checkExistingSlip() {
  const res = await fetchJSON('/api/headcount.php?action=get&terminal_id=' + terminalId);
  if (!res.ok) return;
  if (res.data) {
    const h = res.data;
    document.getElementById('hc-submit-form').style.display = 'none';
    document.getElementById('hc-already-submitted').classList.remove('hidden');
    document.getElementById('hc-submitted-msg').innerHTML =
      `&#10003; Headcount submitted — Boarded: <strong>${h.boarded_count}</strong>, Absent: <strong>${h.absent_count}</strong>, Departed: <strong>${escHtml(h.actual_departure_time)}</strong>`;
  }
}

function filterManifest() {
  const q = document.getElementById('manifest-search').value.toLowerCase();
  document.querySelectorAll('#manifest-list .manifest-row').forEach(row => {
    row.style.display = (!q || row.dataset.name?.includes(q)) ? '' : 'none';
  });
}

function submitHeadcount() {
  const boarded  = document.getElementById('hc-boarded-input').value;
  const absent   = document.getElementById('hc-absent-input').value;
  const depTime  = document.getElementById('hc-depart-input').value;
  if (!depTime) { showToast('Enter actual departure time', 'warning'); return; }
  document.getElementById('hc-modal-summary').textContent =
    `Terminal: ${manifestData?.terminal?.name} | Boarded: ${boarded} | Absent: ${absent} | Departed: ${depTime}`;
  document.getElementById('hc-modal').classList.remove('hidden');
}

async function doSubmitHeadcount() {
  const btn = document.getElementById('hc-confirm-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';
  const fd = new FormData();
  fd.append('terminal_id',           terminalId);
  fd.append('boarded_count',         document.getElementById('hc-boarded-input').value);
  fd.append('absent_count',          document.getElementById('hc-absent-input').value);
  fd.append('actual_departure_time', document.getElementById('hc-depart-input').value);
  const res = await fetchJSON('/api/headcount.php?action=submit', { method: 'POST', body: fd });
  document.getElementById('hc-modal').classList.add('hidden');
  if (res.ok) {
    showToast('Headcount slip submitted!');
    checkExistingSlip();
  } else {
    btn.disabled = false; btn.textContent = 'Confirm & Submit';
    showToast(res.error || 'Submission failed', 'danger');
  }
}
