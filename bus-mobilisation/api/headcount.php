<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'submit' && $method === 'POST') {
    require_role('coordinator', 'admin');
    $user        = require_role('coordinator', 'admin');
    $terminal_id = (int) post('terminal_id');
    $boarded     = (int) post('boarded_count');
    $absent      = (int) post('absent_count');
    $dep_time    = post('actual_departure_time');

    if (!$terminal_id || !$dep_time) {
        json_response(false, null, 'terminal_id and departure time required', 400);
    }

    $db = get_db();
    // Check not already submitted
    $st = $db->prepare('SELECT id FROM headcount_slips WHERE terminal_id=?');
    $st->execute([$terminal_id]);
    if ($st->fetch()) json_response(false, null, 'Headcount already submitted for this terminal');

    $db->prepare('INSERT INTO headcount_slips (terminal_id, coordinator_id, boarded_count, absent_count, actual_departure_time) VALUES (?,?,?,?,?)')
       ->execute([$terminal_id, $user['id'], $boarded, $absent, $dep_time]);

    json_response(true, ['id' => (int) $db->lastInsertId()]);
}

if ($action === 'list') {
    require_role('admin');
    $event_id = (int) get_param('event_id');
    $db = get_db();
    $st = $db->prepare("
        SELECT h.*, t.name AS terminal_name, u.name AS coordinator_name
        FROM headcount_slips h
        JOIN terminals t ON h.terminal_id = t.id
        JOIN users u ON h.coordinator_id = u.id
        WHERE t.event_id = ?
        ORDER BY h.submitted_at
    ");
    $st->execute([$event_id]);
    json_response(true, $st->fetchAll());
}

if ($action === 'get') {
    require_role('coordinator', 'admin');
    $terminal_id = (int) get_param('terminal_id');
    $db = get_db();
    $st = $db->prepare('SELECT * FROM headcount_slips WHERE terminal_id=?');
    $st->execute([$terminal_id]);
    json_response(true, $st->fetch() ?: null);
}

json_response(false, null, 'Unknown action', 400);
