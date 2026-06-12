<?php
function json_response(bool $ok, $data = null, string $error = '', int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    if ($ok) {
        echo json_encode(['ok' => true, 'data' => $data]);
    } else {
        echo json_encode(['ok' => false, 'error' => $error]);
    }
    exit;
}

function sanitise(string $val): string {
    return trim(htmlspecialchars($val, ENT_QUOTES, 'UTF-8'));
}

function format_phone(string $phone): string {
    $phone = preg_replace('/\D/', '', $phone);
    if (strlen($phone) === 10 && str_starts_with($phone, '8') || str_starts_with($phone, '7') || str_starts_with($phone, '9')) {
        $phone = '0' . $phone;
    }
    return $phone;
}

function normalize_phone_for_sms(string $phone): string {
    $phone = preg_replace('/\D/', '', $phone);
    if (str_starts_with($phone, '0')) {
        $phone = '234' . substr($phone, 1);
    }
    return $phone;
}

function parse_csv_upload(string $tmp_path): array {
    $rows = [];
    $fh = fopen($tmp_path, 'r');
    if ($fh === false) return [];
    $header = fgetcsv($fh);
    if (!$header) { fclose($fh); return []; }
    $header = array_map(fn($h) => strtolower(trim($h)), $header);
    while (($row = fgetcsv($fh)) !== false) {
        if (count($row) < count($header)) continue;
        $rows[] = array_combine($header, array_slice($row, 0, count($header)));
    }
    fclose($fh);
    return ['header' => $header, 'rows' => $rows];
}

function post(string $key, string $default = ''): string {
    return sanitise($_POST[$key] ?? $default);
}

function get_param(string $key, string $default = ''): string {
    return sanitise($_GET[$key] ?? $default);
}

function get_db_setting(string $key, string $default = ''): string {
    try {
        $db = get_db();
        $st = $db->prepare('SELECT value FROM settings WHERE key = ?');
        $st->execute([$key]);
        $row = $st->fetch();
        return $row ? $row['value'] : $default;
    } catch (Exception $e) {
        return $default;
    }
}
