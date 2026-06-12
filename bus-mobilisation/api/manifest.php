<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'get') {
    require_role('coordinator', 'admin');
    $terminal_id = (int) get_param('terminal_id');
    $db = get_db();

    $tst = $db->prepare("
        SELECT t.*, u.name AS coordinator_name, u.phone AS coordinator_phone,
               e.name AS event_name, e.event_date, e.report_time, e.departure_time
        FROM terminals t
        LEFT JOIN users u ON t.coordinator_id = u.id
        LEFT JOIN events e ON t.event_id = e.id
        WHERE t.id = ?
    ");
    $tst->execute([$terminal_id]);
    $terminal = $tst->fetch();
    if (!$terminal) json_response(false, null, 'Terminal not found', 404);

    $pst = $db->prepare("
        SELECT id, full_name, phone, status, boarded, confirmation_sent
        FROM persons
        WHERE terminal_id = ?
        ORDER BY full_name
    ");
    $pst->execute([$terminal_id]);
    $persons = $pst->fetchAll();

    json_response(true, [
        'terminal' => $terminal,
        'persons'  => $persons,
        'counts'   => [
            'total'    => count($persons),
            'boarded'  => count(array_filter($persons, fn($p) => $p['boarded'] == 1)),
            'absent'   => count(array_filter($persons, fn($p) => $p['boarded'] === '0' || $p['boarded'] === 0)),
            'unticked' => count(array_filter($persons, fn($p) => $p['boarded'] === null)),
        ],
    ]);
}

if ($action === 'mark' && $method === 'POST') {
    require_role('coordinator', 'admin');
    $person_id = (int) post('person_id');
    $boarded   = post('boarded'); // '1' or '0'
    if (!in_array($boarded, ['0', '1'], true)) {
        json_response(false, null, 'boarded must be 0 or 1', 400);
    }
    $db = get_db();
    $status = $boarded === '0' ? 'no_show' : 'confirmed';
    $db->prepare('UPDATE persons SET boarded=?, status=? WHERE id=?')
       ->execute([(int)$boarded, $status, $person_id]);
    json_response(true, null);
}

json_response(false, null, 'Unknown action', 400);
