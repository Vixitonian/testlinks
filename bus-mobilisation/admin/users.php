<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Users — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header"><h1>User Management</h1><p>Callers, coordinators and admins</p></div>

    <div class="card">
      <div class="card-header"><h2>Add User</h2></div>
      <div id="user-error" class="alert alert-danger hidden"></div>
      <div class="form-row">
        <div class="form-group flex-1"><label>Full Name</label>
          <input type="text" id="u-name" class="form-control"></div>
        <div class="form-group"><label>Phone (login username)</label>
          <input type="text" id="u-phone" class="form-control" placeholder="08012345678"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Password</label>
          <input type="password" id="u-pass" class="form-control"></div>
        <div class="form-group"><label>Role</label>
          <select id="u-role" class="form-control">
            <option value="caller">Caller</option>
            <option value="coordinator">Coordinator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="createUser()">Add User</button>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:6px;margin-bottom:16px;">
      <button class="btn btn-primary btn-sm" id="tab-all" onclick="showTab('all')">All</button>
      <button class="btn btn-outline btn-sm" id="tab-caller" onclick="showTab('caller')">Callers</button>
      <button class="btn btn-outline btn-sm" id="tab-coordinator" onclick="showTab('coordinator')">Coordinators</button>
      <button class="btn btn-outline btn-sm" id="tab-admin" onclick="showTab('admin')">Admins</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="users-tbody"><tr><td colspan="5" class="text-muted">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script>
let currentTab = 'all';

async function loadUsers(role='') {
  const url = '/api/users.php?action=list' + (role ? '&role='+role : '');
  const res = await fetchJSON(url);
  const tbody = document.getElementById('users-tbody');
  if (!res.ok || !res.data.length) { tbody.innerHTML='<tr><td colspan="5" class="text-muted">No users found.</td></tr>'; return; }
  tbody.innerHTML = res.data.map(u => `
    <tr id="urow-${u.id}">
      <td><strong>${escHtml(u.name)}</strong></td>
      <td>${escHtml(u.phone)}</td>
      <td>${roleBadge(u.role)}</td>
      <td><span class="badge badge-${u.active?'active':'no_show'}">${u.active?'Active':'Inactive'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="toggleActive(${u.id})">${u.active?'Deactivate':'Activate'}</button>
        <button class="btn btn-sm btn-warning" onclick="resetPass(${u.id})">Reset Password</button>
      </td>
    </tr>
  `).join('');
}

function showTab(tab) {
  currentTab = tab;
  ['all','caller','coordinator','admin'].forEach(t => {
    document.getElementById('tab-'+t).className = 'btn btn-sm ' + (t===tab ? 'btn-primary' : 'btn-outline');
  });
  loadUsers(tab === 'all' ? '' : tab);
}

async function createUser() {
  const fd = new FormData();
  fd.append('name',     document.getElementById('u-name').value.trim());
  fd.append('phone',    document.getElementById('u-phone').value.trim());
  fd.append('password', document.getElementById('u-pass').value);
  fd.append('role',     document.getElementById('u-role').value);
  const res = await fetchJSON('/api/users.php?action=create', { method:'POST', body:fd });
  const err = document.getElementById('user-error');
  if (res.ok) {
    showToast('User created');
    ['u-name','u-phone','u-pass'].forEach(id=>document.getElementById(id).value='');
    err.classList.add('hidden');
    loadUsers(currentTab==='all'?'':currentTab);
  } else { err.textContent=res.error; err.classList.remove('hidden'); }
}

async function toggleActive(id) {
  const fd = new FormData(); fd.append('id', id);
  const res = await fetchJSON('/api/users.php?action=toggle_active', { method:'POST', body:fd });
  if (res.ok) { showToast(res.data.active ? 'Activated' : 'Deactivated'); loadUsers(currentTab==='all'?'':currentTab); }
  else showToast(res.error,'danger');
}

async function resetPass(id) {
  const np = prompt('New password (min 6 chars):');
  if (!np) return;
  const fd = new FormData(); fd.append('id', id); fd.append('new_password', np);
  const res = await fetchJSON('/api/users.php?action=reset_password', { method:'POST', body:fd });
  if (res.ok) showToast('Password reset');
  else showToast(res.error,'danger');
}

loadUsers();
</script>
</body>
</html>
