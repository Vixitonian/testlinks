<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'list') {
    require_role('admin', 'caller', 'coordinator');
    $event_id = (int) get_param('event_id');
    $db = get_db();
    $st = $db->prepare("
        SELECT t.*, u.name AS coordinator_name, u.phone AS coordinator_phone
        FROM terminals t
        LEFT JOIN users u ON t.coordinator_id = u.id
        WHERE t.event_id = ?
        ORDER BY t.name
    ");
    $st->execute([$event_id]);
    json_response(true, $st->fetchAll());
}

if ($action === 'create' && $method === 'POST') {
    require_role('admin');
    $event_id       = (int) post('event_id');
    $name           = post('name');
    $area           = post('area');
    $landmark       = post('landmark');
    $coordinator_id = post('coordinator_id') ? (int) post('coordinator_id') : null;
    if (!$event_id || !$name || !$area || !$landmark) {
        json_response(false, null, 'event_id, name, area and landmark are required', 400);
    }
    $db = get_db();
    $st = $db->prepare('INSERT INTO terminals (event_id, name, area, landmark, coordinator_id) VALUES (?,?,?,?,?)');
    $st->execute([$event_id, $name, $area, $landmark, $coordinator_id]);
    json_response(true, ['id' => (int) $db->lastInsertId()]);
}

if ($action === 'update' && $method === 'POST') {
    require_role('admin', 'coordinator');
    $id             = (int) post('id');
    $name           = post('name');
    $area           = post('area');
    $landmark       = post('landmark');
    $coordinator_id = post('coordinator_id') ? (int) post('coordinator_id') : null;
    $bus_info       = post('bus_info');
    $db = get_db();
    $st = $db->prepare('UPDATE terminals SET name=?, area=?, landmark=?, coordinator_id=?, bus_info=? WHERE id=?');
    $st->execute([$name, $area, $landmark, $coordinator_id, $bus_info, $id]);
    json_response(true, null);
}

if ($action === 'delete' && $method === 'POST') {
    require_role('admin');
    $id = (int) post('id');
    $db = get_db();
    // Check no persons assigned
    $st = $db->prepare('SELECT COUNT(*) FROM persons WHERE terminal_id = ?');
    $st->execute([$id]);
    if ($st->fetchColumn() > 0) {
        json_response(false, null, 'Cannot delete terminal with assigned persons', 400);
    }
    $db->prepare('DELETE FROM terminals WHERE id=?')->execute([$id]);
    json_response(true, null);
}

json_response(false, null, 'Unknown action', 400);
