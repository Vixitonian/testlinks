<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'list') {
    require_role('admin');
    $role = get_param('role');
    $db = get_db();
    if ($role) {
        $st = $db->prepare('SELECT id, name, phone, role, active, created_at FROM users WHERE role=? ORDER BY name');
        $st->execute([$role]);
    } else {
        $st = $db->query('SELECT id, name, phone, role, active, created_at FROM users ORDER BY role, name');
    }
    json_response(true, $st->fetchAll());
}

if ($action === 'create' && $method === 'POST') {
    require_role('admin');
    $name     = post('name');
    $phone    = post('phone');
    $password = $_POST['password'] ?? '';
    $role     = post('role');
    if (!$name || !$phone || !$password || !in_array($role, ['admin','caller','coordinator'], true)) {
        json_response(false, null, 'All fields are required and role must be valid', 400);
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $db = get_db();
    try {
        $st = $db->prepare('INSERT INTO users (name, phone, password_hash, role) VALUES (?,?,?,?)');
        $st->execute([$name, $phone, $hash, $role]);
        json_response(true, ['id' => (int) $db->lastInsertId()]);
    } catch (PDOException $e) {
        json_response(false, null, 'Phone number already exists', 409);
    }
}

if ($action === 'toggle_active' && $method === 'POST') {
    require_role('admin');
    $id = (int) post('id');
    $db = get_db();
    $st = $db->prepare('SELECT active FROM users WHERE id=?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_response(false, null, 'User not found', 404);
    $new = $row['active'] ? 0 : 1;
    $db->prepare('UPDATE users SET active=? WHERE id=?')->execute([$new, $id]);
    json_response(true, ['active' => $new]);
}

if ($action === 'reset_password' && $method === 'POST') {
    require_role('admin');
    $id       = (int) post('id');
    $password = $_POST['new_password'] ?? '';
    if (strlen($password) < 6) {
        json_response(false, null, 'Password must be at least 6 characters', 400);
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $db = get_db();
    $db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash, $id]);
    json_response(true, null);
}

json_response(false, null, 'Unknown action', 400);
