<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'import' && $method === 'POST') {
    require_role('admin');
    $event_id = (int) post('event_id');
    if (!$event_id) json_response(false, null, 'event_id required', 400);
    if (empty($_FILES['csv_file'])) json_response(false, null, 'No file uploaded', 400);

    $tmp = $_FILES['csv_file']['tmp_name'];
    $parsed = parse_csv_upload($tmp);
    if (empty($parsed['rows'])) json_response(false, null, 'Empty or invalid CSV file', 400);

    $header = $parsed['header'];
    if (!in_array('full_name', $header) || !in_array('phone', $header)) {
        json_response(false, null, 'CSV must have columns: full_name, phone', 400);
    }
    if (count($parsed['rows']) > 5000) {
        json_response(false, null, 'Maximum 5,000 rows per import', 400);
    }

    $db = get_db();
    $imported = 0;
    $skipped  = 0;
    $errors   = [];

    $db->beginTransaction();
    try {
        $check = $db->prepare('SELECT id FROM persons WHERE phone=? AND event_id=?');
        $insert = $db->prepare('INSERT INTO persons (event_id, full_name, phone) VALUES (?,?,?)');
        foreach ($parsed['rows'] as $i => $row) {
            $name  = trim($row['full_name'] ?? '');
            $phone = format_phone(trim($row['phone'] ?? ''));
            if (!$name) { $errors[] = "Row " . ($i+2) . ": empty name"; $skipped++; continue; }
            if (!preg_match('/^\d{10,13}$/', $phone)) { $errors[] = "Row " . ($i+2) . ": invalid phone '$phone'"; $skipped++; continue; }
            $check->execute([$phone, $event_id]);
            if ($check->fetch()) { $skipped++; continue; }
            $insert->execute([$event_id, $name, $phone]);
            $imported++;
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        json_response(false, null, 'Import failed: ' . $e->getMessage(), 500);
    }

    json_response(true, ['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
}

if ($action === 'list') {
    require_role('admin', 'caller');
    $event_id    = (int) get_param('event_id');
    $status      = get_param('status');
    $terminal_id = get_param('terminal_id');
    $db = get_db();
    $where = ['p.event_id = ?'];
    $params = [$event_id];
    if ($status)      { $where[] = 'p.status = ?';      $params[] = $status; }
    if ($terminal_id) { $where[] = 'p.terminal_id = ?'; $params[] = (int) $terminal_id; }
    $sql = "SELECT p.*, t.name AS terminal_name
            FROM persons p
            LEFT JOIN terminals t ON p.terminal_id = t.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY p.full_name";
    $st = $db->prepare($sql);
    $st->execute($params);
    json_response(true, $st->fetchAll());
}

if ($action === 'get') {
    require_role('admin', 'caller', 'coordinator');
    $id = (int) get_param('id');
    $db = get_db();
    $st = $db->prepare("
        SELECT p.*, t.name AS terminal_name, t.landmark, t.area,
               u.name AS coordinator_name, u.phone AS coordinator_phone
        FROM persons p
        LEFT JOIN terminals t ON p.terminal_id = t.id
        LEFT JOIN users u ON t.coordinator_id = u.id
        WHERE p.id = ?
    ");
    $st->execute([$id]);
    $person = $st->fetch();
    if (!$person) json_response(false, null, 'Not found', 404);

    $logs = $db->prepare("
        SELECT cl.*, t.name AS terminal_name, u.name AS caller_name
        FROM call_log cl
        LEFT JOIN terminals t ON cl.terminal_id = t.id
        LEFT JOIN users u ON cl.caller_id = u.id
        WHERE cl.person_id = ?
        ORDER BY cl.called_at
    ");
    $logs->execute([$id]);
    $person['call_log'] = $logs->fetchAll();
    json_response(true, $person);
}

if ($action === 'assign_terminal' && $method === 'POST') {
    require_role('admin');
    $person_id   = (int) post('person_id');
    $terminal_id = (int) post('terminal_id');
    $db = get_db();
    $db->prepare("UPDATE persons SET terminal_id=?, status='assigned' WHERE id=?")->execute([$terminal_id, $person_id]);
    json_response(true, null);
}

json_response(false, null, 'Unknown action', 400);
