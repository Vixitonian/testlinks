<?php
require_once __DIR__ . '/../includes/auth.php';
require_role('admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settings — Bus Mobilisation</title>
<link rel="stylesheet" href="../assets/css/main.css">
</head>
<body>
<div class="page-wrap">
  <?php include __DIR__ . '/../includes/sidebar_admin.php'; ?>
  <div class="main-content">
    <div class="page-header"><h1>Settings</h1><p>SMS credentials and system configuration</p></div>

    <div class="card" style="max-width:560px;">
      <div class="card-header"><h2>SmartSMSSolution Credentials</h2></div>
      <div id="settings-saved" class="alert alert-success hidden">Settings saved successfully.</div>
      <div id="settings-error" class="alert alert-danger hidden"></div>

      <div class="form-group">
        <label>SmartSMS Username</label>
        <input type="text" id="sms-username" class="form-control" placeholder="Your SmartSMS username">
      </div>
      <div class="form-group">
        <label>SmartSMS Password</label>
        <input type="password" id="sms-password" class="form-control" placeholder="Leave blank to keep current password">
        <small class="text-muted">Only enter a value to change the current password.</small>
      </div>
      <div class="form-group">
        <label>Sender ID (max 11 characters)</label>
        <input type="text" id="sms-sender" class="form-control" maxlength="11" placeholder="BusMobil">
      </div>
      <div class="form-group">
        <label>Admin Contact Number (shown in fallback SMS)</label>
        <input type="text" id="admin-phone" class="form-control" placeholder="08012345678">
      </div>
      <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
    </div>

    <div class="card" style="max-width:560px;margin-top:0;">
      <div class="card-header"><h2>About</h2></div>
      <p style="font-size:14px;color:var(--muted);line-height:1.7;">
        SMS is sent via SmartSMSSolution API. Ensure your account has sufficient units before running collection.<br>
        For in-app calling, the system opens your device's native phone dialer via <code>tel:</code> links.
      </p>
    </div>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script src="../assets/js/utils.js"></script>
<script>
async function loadSettings() {
  const res = await fetchJSON('/api/settings.php?action=get');
  if (!res.ok) return;
  const d = res.data;
  document.getElementById('sms-username').value = d.sms_username || '';
  document.getElementById('sms-sender').value   = d.sms_sender   || 'BusMobil';
  document.getElementById('admin-phone').value  = d.admin_phone  || '';
  if (d.sms_password_set) {
    document.getElementById('sms-password').placeholder = '••••••••  (set — leave blank to keep)';
  }
}

async function saveSettings() {
  const fd = new FormData();
  fd.append('sms_username', document.getElementById('sms-username').value.trim());
  fd.append('sms_password', document.getElementById('sms-password').value);
  fd.append('sms_sender',   document.getElementById('sms-sender').value.trim() || 'BusMobil');
  fd.append('admin_phone',  document.getElementById('admin-phone').value.trim());
  const res = await fetchJSON('/api/settings.php?action=save', { method:'POST', body:fd });
  const savedEl = document.getElementById('settings-saved');
  const errEl   = document.getElementById('settings-error');
  if (res.ok) {
    savedEl.classList.remove('hidden'); errEl.classList.add('hidden');
    document.getElementById('sms-password').value = '';
    setTimeout(() => savedEl.classList.add('hidden'), 3000);
  } else { errEl.textContent=res.error; errEl.classList.remove('hidden'); }
}

loadSettings();
</script>
</body>
</html>
