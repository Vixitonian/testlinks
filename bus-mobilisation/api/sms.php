<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/sms.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'send_confirmation' && $method === 'POST') {
    require_role('caller', 'admin');
    $person_id = (int) post('person_id');
    $db = get_db();

    $st = $db->prepare("
        SELECT p.*, e.name AS event_name, e.event_date, e.report_time, e.departure_time,
               t.name AS terminal_name, t.landmark,
               u.name AS coord_name, u.phone AS coord_phone
        FROM persons p
        JOIN events e ON p.event_id = e.id
        LEFT JOIN terminals t ON p.terminal_id = t.id
        LEFT JOIN users u ON t.coordinator_id = u.id
        WHERE p.id = ?
    ");
    $st->execute([$person_id]);
    $p = $st->fetch();
    if (!$p) json_response(false, null, 'Person not found', 404);
    if (!$p['terminal_id']) json_response(false, null, 'Person has no terminal assigned', 400);
    if ($p['confirmation_sent']) json_response(false, null, 'Confirmation SMS already sent');

    $date_fmt = date('D d M Y', strtotime($p['event_date']));
    $msg = "{$p['event_name']} — {$date_fmt}. Your pickup: {$p['landmark']}. Report by {$p['report_time']}. Bus leaves {$p['departure_time']} sharp. Coordinator: {$p['coord_name']} {$p['coord_phone']}. Late or lost? Call them.";

    $result = send_sms($p['phone'], $msg);

    $db->prepare('INSERT INTO sms_log (person_id, sms_type, message_text, api_response) VALUES (?,?,?,?)')
       ->execute([$person_id, 'confirmation', $msg, $result['raw'] ?? null]);

    if ($result['success']) {
        $db->prepare("UPDATE persons SET confirmation_sent=1, status='confirmed' WHERE id=?")
           ->execute([$person_id]);
        json_response(true, ['message_sent' => $msg]);
    } else {
        json_response(false, null, 'SMS delivery failed: ' . ($result['error'] ?? 'Unknown error'));
    }
}

if ($action === 'send_fallback' && $method === 'POST') {
    require_role('caller', 'admin');
    $person_id = (int) post('person_id');
    $db = get_db();

    $st = $db->prepare("
        SELECT p.*, e.name AS event_name, e.event_date
        FROM persons p
        JOIN events e ON p.event_id = e.id
        WHERE p.id = ?
    ");
    $st->execute([$person_id]);
    $p = $st->fetch();
    if (!$p) json_response(false, null, 'Person not found', 404);
    if ($p['fallback_sent']) json_response(false, null, 'Fallback SMS already sent');

    $admin_phone = get_db_setting('admin_phone', '');
    $date_fmt    = date('D d M Y', strtotime($p['event_date']));
    $msg = "{$p['event_name']} — {$date_fmt}. We're arranging your bus pickup. Please call {$admin_phone} so we can assign your nearest terminal.";

    $result = send_sms($p['phone'], $msg);

    $db->prepare('INSERT INTO sms_log (person_id, sms_type, message_text, api_response) VALUES (?,?,?,?)')
       ->execute([$person_id, 'fallback', $msg, $result['raw'] ?? null]);

    if ($result['success']) {
        $db->prepare('UPDATE persons SET fallback_sent=1 WHERE id=?')->execute([$person_id]);
        json_response(true, ['message_sent' => $msg]);
    } else {
        json_response(false, null, 'SMS delivery failed: ' . ($result['error'] ?? 'Unknown error'));
    }
}

json_response(false, null, 'Unknown action', 400);
