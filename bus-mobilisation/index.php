<?php
require_once __DIR__ . '/includes/auth.php';
start_session();
// Already logged in → redirect
if (!empty($_SESSION['user'])) {
    $role = $_SESSION['user']['role'];
    header('Location: ' . $role . '/dashboard.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bus Mobilisation System — Login</title>
<link rel="stylesheet" href="assets/css/main.css">
</head>
<body>
<div class="login-page">
  <div class="login-card">
    <div class="login-logo">
      <h1>Bus Mobilisation</h1>
      <p>Coordinator Management System</p>
    </div>
    <div id="login-error" class="alert alert-danger hidden"></div>
    <div class="form-group">
      <label for="phone">Phone / Username</label>
      <input type="text" id="phone" class="form-control" placeholder="e.g. 08012345678" autocomplete="username">
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" class="form-control" autocomplete="current-password">
    </div>
    <button class="btn btn-primary" id="login-btn" onclick="doLogin()">Sign In</button>
  </div>
</div>
<script>
const BASE = '';
async function doLogin() {
  const phone    = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Signing in…';
  const fd = new FormData();
  fd.append('phone', phone);
  fd.append('password', password);
  try {
    const res = await fetch('api/auth.php?action=login', { method: 'POST', body: fd, credentials: 'same-origin' });
    const json = await res.json();
    if (json.ok) {
      const role = json.data.role;
      window.location.href = role + '/dashboard.php';
    } else {
      errEl.textContent = json.error || 'Login failed';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  } catch(e) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
</script>
</body>
</html>
