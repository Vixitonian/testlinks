<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'list') {
    require_role('admin', 'caller', 'coordinator');
    $db = get_db();
    $rows = $db->query("SELECT * FROM events ORDER BY event_date DESC")->fetchAll();
    json_response(true, $rows);
}

if ($action === 'get') {
    require_role('admin', 'caller', 'coordinator');
    $id = (int) get_param('id');
    $db = get_db();
    $st = $db->prepare('SELECT * FROM events WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_response(false, null, 'Not found', 404);
    json_response(true, $row);
}

if ($action === 'create' && $method === 'POST') {
    require_role('admin');
    $name     = post('name');
    $date     = post('event_date');
    $report   = post('report_time');
    $depart   = post('departure_time');
    if (!$name || !$date || !$report || !$depart) {
        json_response(false, null, 'All fields required', 400);
    }
    $db = get_db();
    $st = $db->prepare('INSERT INTO events (name, event_date, report_time, departure_time) VALUES (?,?,?,?)');
    $st->execute([$name, $date, $report, $depart]);
    json_response(true, ['id' => (int) $db->lastInsertId()]);
}

if ($action === 'update' && $method === 'POST') {
    require_role('admin');
    $id     = (int) post('id');
    $name   = post('name');
    $date   = post('event_date');
    $report = post('report_time');
    $depart = post('departure_time');
    $db = get_db();
    $st = $db->prepare('UPDATE events SET name=?, event_date=?, report_time=?, departure_time=? WHERE id=?');
    $st->execute([$name, $date, $report, $depart, $id]);
    json_response(true, null);
}

if ($action === 'archive' && $method === 'POST') {
    require_role('admin');
    $id = (int) post('id');
    $db = get_db();
    $db->prepare('UPDATE events SET status=? WHERE id=?')->execute(['archived', $id]);
    json_response(true, null);
}

if ($action === 'stats') {
    require_role('admin', 'caller');
    $event_id = (int) get_param('event_id');
    $db = get_db();

    $counts = $db->prepare("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status='assigned' AND confirmation_sent=0 THEN 1 ELSE 0 END) as assigned_unsent,
            SUM(CASE WHEN confirmation_sent=1 THEN 1 ELSE 0 END) as confirmed,
            SUM(CASE WHEN status='no_show'  THEN 1 ELSE 0 END) as no_show,
            SUM(CASE WHEN fallback_sent=1 THEN 1 ELSE 0 END) as fallback_sent,
            SUM(CASE WHEN call_attempts>=2 AND fallback_sent=0 AND status='pending' THEN 1 ELSE 0 END) as needs_fallback
        FROM persons WHERE event_id=?
    ");
    $counts->execute([$event_id]);
    $stats = $counts->fetch();

    // Terminal breakdown
    $terms = $db->prepare("
        SELECT t.id, t.name, t.landmark,
               u.name AS coordinator_name, u.phone AS coordinator_phone,
               COUNT(p.id) AS count_assigned,
               SUM(CASE WHEN p.confirmation_sent=1 THEN 1 ELSE 0 END) AS count_confirmed,
               SUM(CASE WHEN p.boarded=1 THEN 1 ELSE 0 END) AS count_boarded,
               SUM(CASE WHEN p.boarded=0 THEN 1 ELSE 0 END) AS count_absent,
               h.boarded_count AS slip_boarded, h.absent_count AS slip_absent,
               h.actual_departure_time AS slip_departure, h.submitted_at AS slip_submitted
        FROM terminals t
        LEFT JOIN users u ON t.coordinator_id = u.id
        LEFT JOIN persons p ON p.terminal_id = t.id AND p.event_id = ?
        LEFT JOIN headcount_slips h ON h.terminal_id = t.id
        WHERE t.event_id = ?
        GROUP BY t.id
    ");
    $terms->execute([$event_id, $event_id]);
    $terminals = $terms->fetchAll();

    // Caller activity today
    $callers = $db->prepare("
        SELECT u.name, COUNT(cl.id) as total_calls,
               SUM(CASE WHEN cl.outcome='answered'  THEN 1 ELSE 0 END) AS answered,
               SUM(CASE WHEN cl.outcome='no_answer' THEN 1 ELSE 0 END) AS no_answer
        FROM call_log cl
        JOIN users u ON cl.caller_id = u.id
        JOIN persons p ON cl.person_id = p.id
        WHERE p.event_id = ? AND DATE(cl.called_at) = DATE('now')
        GROUP BY cl.caller_id
        ORDER BY total_calls DESC
    ");
    $callers->execute([$event_id]);
    $caller_activity = $callers->fetchAll();

    // Alerts
    $no_coord = 0;
    foreach ($terminals as $t) {
        if (!$t['coordinator_name']) $no_coord++;
    }

    json_response(true, [
        'stats'           => $stats,
        'terminals'       => $terminals,
        'caller_activity' => $caller_activity,
        'alerts'          => [
            'no_coordinator'  => $no_coord,
            'needs_fallback'  => (int)($stats['needs_fallback'] ?? 0),
            'assigned_unsent' => (int)($stats['assigned_unsent'] ?? 0),
        ],
    ]);
}

json_response(false, null, 'Unknown action', 400);
