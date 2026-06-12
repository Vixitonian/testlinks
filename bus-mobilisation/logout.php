<?php
require_once __DIR__ . '/includes/auth.php';
destroy_session();
header('Location: index.php');
exit;
