<?php
function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.cookie_httponly', 1);
        ini_set('session.use_strict_mode', 1);
        session_start();
    }
}

function require_login(): array {
    start_session();
    if (empty($_SESSION['user'])) {
        $base = dirname($_SERVER['SCRIPT_NAME']);
        // Walk up to find index.php relative to current script
        $depth = substr_count(str_replace(realpath(__DIR__ . '/..'), '', realpath(dirname($_SERVER['SCRIPT_FILENAME']))), DIRECTORY_SEPARATOR);
        $prefix = str_repeat('../', $depth);
        header('Location: ' . $prefix . 'index.php');
        exit;
    }
    return $_SESSION['user'];
}

function require_role(string ...$roles): array {
    start_session();
    if (empty($_SESSION['user'])) {
        if (is_api_request()) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Not authenticated']);
            exit;
        }
        header('Location: ../index.php');
        exit;
    }
    if (!in_array($_SESSION['user']['role'], $roles, true)) {
        if (is_api_request()) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            exit;
        }
        http_response_code(403);
        exit('Forbidden');
    }
    return $_SESSION['user'];
}

function is_api_request(): bool {
    return str_contains($_SERVER['SCRIPT_FILENAME'] ?? '', '/api/');
}

function set_session_user(array $user): void {
    start_session();
    $_SESSION['user'] = [
        'id'    => $user['id'],
        'name'  => $user['name'],
        'phone' => $user['phone'],
        'role'  => $user['role'],
    ];
}

function destroy_session(): void {
    start_session();
    $_SESSION = [];
    session_destroy();
}
