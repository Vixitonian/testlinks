<?php
$current = basename($_SERVER['PHP_SELF']);
?>
<div class="sidebar">
  <div class="sidebar-brand">
    Bus Mobilisation<small>Admin Panel</small>
  </div>
  <nav class="sidebar-nav">
    <a href="dashboard.php" class="<?= $current==='dashboard.php'?'active':'' ?>">
      <span class="icon">&#9638;</span> Dashboard
    </a>
    <a href="events.php" class="<?= $current==='events.php'?'active':'' ?>">
      <span class="icon">&#128197;</span> Events
    </a>
    <a href="terminals.php" class="<?= $current==='terminals.php'?'active':'' ?>">
      <span class="icon">&#128652;</span> Terminals
    </a>
    <a href="persons.php" class="<?= $current==='persons.php'?'active':'' ?>">
      <span class="icon">&#128101;</span> Persons
    </a>
    <a href="users.php" class="<?= $current==='users.php'?'active':'' ?>">
      <span class="icon">&#128100;</span> Users
    </a>
    <a href="headcounts.php" class="<?= $current==='headcounts.php'?'active':'' ?>">
      <span class="icon">&#10003;</span> Headcounts
    </a>
    <a href="settings.php" class="<?= $current==='settings.php'?'active':'' ?>">
      <span class="icon">&#9881;</span> Settings
    </a>
  </nav>
  <div class="sidebar-footer">
    <strong><?= htmlspecialchars($_SESSION['user']['name'] ?? '') ?></strong>
    <a href="../logout.php" style="color:rgba(255,255,255,.6);font-size:12px;">Sign out</a>
  </div>
</div>
