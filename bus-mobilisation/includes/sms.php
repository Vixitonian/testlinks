<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function send_sms(string $to, string $message): array {
    $username = get_db_setting('sms_username');
    $password = get_db_setting('sms_password');
    $sender   = get_db_setting('sms_sender', 'BusMobil');

    if (!$username || !$password) {
        return ['success' => false, 'error' => 'SMS credentials not configured'];
    }

    $to = normalize_phone_for_sms($to);

    $payload = http_build_query([
        'username' => $username,
        'password' => $password,
        'to'       => $to,
        'message'  => $message,
        'sender'   => $sender,
        'type'     => 0,
    ]);

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => 'Content-Type: application/x-www-form-urlencoded',
            'content' => $payload,
            'timeout' => 10,
        ]
    ]);

    $raw = @file_get_contents('https://www.smartsmssolutions.com/sms/json.php', false, $ctx);
    if ($raw === false) {
        return ['success' => false, 'error' => 'Network error', 'raw' => null];
    }

    $decoded = json_decode($raw, true);
    $success = isset($decoded['code']) && $decoded['code'] === '1801';
    return ['success' => $success, 'raw' => $raw, 'decoded' => $decoded];
}
