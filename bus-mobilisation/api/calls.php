<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json');

$action = get_param('action');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'queue') {
    require_role('caller', 'admin');
    $event_id = (int) get_param('event_id');
    $db = get_db();
    // Queue: pending persons + assigned persons not yet confirmed
    $st = $db->prepare("
        SELECT p.id, p.full_name, p.phone, p.status, p.call_attempts,
               p.fallback_sent, p.confirmation_sent,
               t.name AS terminal_name,
               MAX(cl.called_at) AS last_called
        FROM persons p
        LEFT JOIN terminals t ON p.terminal_id = t.id
        LEFT JOIN call_log cl ON cl.person_id = p.id
        WHERE p.event_id = ?
          AND (p.status = 'pending' OR (p.status = 'assigned' AND p.confirmation_sent = 0))
        GROUP BY p.id
        ORDER BY p.call_attempts ASC, p.full_name ASC
    ");
    $st->execute([$event_id]);
    json_response(true, $st->fetchAll());
}

if ($action === 'log_attempt' && $method === 'POST') {
    require_role('caller', 'admin');
    $person_id   = (int) post('person_id');
    $caller_id   = (int) post('caller_id');
    $outcome     = post('outcome'); // answered | no_answer
    $terminal_id = post('terminal_id') ? (int) post('terminal_id') : null;

    if (!$person_id || !$caller_id || !in_array($outcome, ['answered', 'no_answer'], true)) {
        json_response(false, null, 'person_id, caller_id, and valid outcome required', 400);
    }

    $db = get_db();
    $db->beginTransaction();
    try {
        // Get current person state
        $st = $db->prepare('SELECT * FROM persons WHERE id=?');
        $st->execute([$person_id]);
        $person = $st->fetch();
        if (!$person) { $db->rollBack(); json_response(false, null, 'Person not found', 404); }

        $attempt_number = $person['call_attempts'] + 1;

        // Insert call log
        $db->prepare('INSERT INTO call_log (person_id, caller_id, attempt_number, outcome, terminal_id) VALUES (?,?,?,?,?)')
           ->execute([$person_id, $caller_id, $attempt_number, $outcome, $terminal_id]);

        // Update person
        if ($outcome === 'answered' && $terminal_id) {
            $db->prepare("UPDATE persons SET call_attempts=?, terminal_id=?, status='assigned' WHERE id=?")
               ->execute([$attempt_number, $terminal_id, $person_id]);
        } else {
            $db->prepare('UPDATE persons SET call_attempts=? WHERE id=?')
               ->execute([$attempt_number, $person_id]);
        }

        $db->commit();

        // Reload person
        $st->execute([$person_id]);
        $updated = $st->fetch();

        $should_send_fallback = (
            $outcome === 'no_answer' &&
            $updated['call_attempts'] >= 2 &&
            !$updated['fallback_sent']
        );

        json_response(true, [
            'call_attempts'       => (int) $updated['call_attempts'],
            'status'              => $updated['status'],
            'fallback_sent'       => (bool) $updated['fallback_sent'],
            'should_send_fallback' => $should_send_fallback,
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        json_response(false, null, $e->getMessage(), 500);
    }
}

if ($action === 'history') {
    require_role('caller', 'admin', 'coordinator');
    $person_id = (int) get_param('person_id');
    $db = get_db();
    $st = $db->prepare("
        SELECT cl.*, t.name AS terminal_name, u.name AS caller_name
        FROM call_log cl
        LEFT JOIN terminals t ON cl.terminal_id = t.id
        LEFT JOIN users u ON cl.caller_id = u.id
        WHERE cl.person_id = ?
        ORDER BY cl.called_at
    ");
    $st->execute([$person_id]);
    json_response(true, $st->fetchAll());
}

json_response(false, null, 'Unknown action', 400);
