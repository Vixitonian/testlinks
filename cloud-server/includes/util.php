<?php
/** Shared response/validation helpers used by every endpoint. */

function cors_headers(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function send_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function send_error(string $message, int $status = 400): void {
    send_json(['ok' => false, 'error' => $message], $status);
}

function require_method(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        send_error("This endpoint only accepts $method", 405);
    }
}

/** Reads and JSON-decodes the request body, or 400s on invalid JSON. */
function json_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        send_error('Request body must be valid JSON', 400);
    }
    return $data;
}

/** 400s if any of $fields is missing or an empty string in $data. */
function require_fields(array $data, array $fields): void {
    foreach ($fields as $f) {
        if (!array_key_exists($f, $data) || $data[$f] === '' || $data[$f] === null) {
            send_error("Missing required field: $f", 400);
        }
    }
}
