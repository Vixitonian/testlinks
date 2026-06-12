<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'get') {
    require_role('admin');
    $db = get_db();
    $rows = $db->query('SELECT key, value FROM settings')->fetchAll();
    $settings = [];
    foreach ($rows as $r) $settings[$r['key']] = $r['value'];
    // Never return password in plain text — mask it
    if (!empty($settings['sms_password'])) $settings['sms_password_set'] = true;
    unset($settings['sms_password']);
    json_response(true, $settings);
}

if ($action === 'save' && $method === 'POST') {
    require_role('admin');
    $db = get_db();
    $keys = ['sms_username', 'sms_sender', 'admin_phone'];
    $st = $db->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    foreach ($keys as $key) {
        $val = post($key);
        $st->execute([$key, $val]);
    }
    // Only update password if a new one was provided
    $new_pass = $_POST['sms_password'] ?? '';
    if ($new_pass !== '') {
        $st->execute(['sms_password', $new_pass]);
    }
    json_response(true, null);
}

json_response(false, null, 'Unknown action', 400);
