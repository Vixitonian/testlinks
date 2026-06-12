<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');
start_session();

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'login' && $method === 'POST') {
    $phone    = post('phone');
    $password = $_POST['password'] ?? '';

    if (!$phone || !$password) {
        json_response(false, null, 'Phone and password are required', 400);
    }

    $db = get_db();
    $st = $db->prepare('SELECT * FROM users WHERE phone = ? AND active = 1');
    $st->execute([$phone]);
    $user = $st->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_response(false, null, 'Invalid phone or password', 401);
    }

    set_session_user($user);
    json_response(true, ['id' => $user['id'], 'name' => $user['name'], 'role' => $user['role']]);
}

if ($action === 'logout' && $method === 'POST') {
    destroy_session();
    json_response(true, null);
}

if ($action === 'me') {
    start_session();
    if (empty($_SESSION['user'])) {
        json_response(false, null, 'Not authenticated', 401);
    }
    json_response(true, $_SESSION['user']);
}

json_response(false, null, 'Unknown action', 400);
