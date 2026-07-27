<?php
/**
 * POST /heartbeat.php
 * The agent calls this every poll interval to report its status and, in
 * the same round trip, pick up at most one pending command. Combining
 * "I'm alive" and "what should I do" into one request halves the number
 * of calls a shared-hosting plan has to handle.
 *
 * Body: {device_uuid, internet_blocked}
 * -> {ok: true, command: {id, command} | null}
 */
require_once __DIR__ . '/includes/util.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';

cors_headers();
require_method('POST');
require_device_key();

$in = json_input();
require_fields($in, ['device_uuid']);
$blocked = !empty($in['internet_blocked']) ? 1 : 0;

$db = get_db();

$update = $db->prepare('UPDATE devices SET internet_blocked = ?, last_seen_at = NOW() WHERE device_uuid = ?');
$update->execute([$blocked, $in['device_uuid']]);
if ($update->rowCount() === 0) {
    send_error('Device not registered — call /register.php first', 404);
}

$find = $db->prepare(
    "SELECT id, command FROM commands WHERE device_uuid = ? AND status = 'pending' ORDER BY id ASC LIMIT 1"
);
$find->execute([$in['device_uuid']]);
$pending = $find->fetch();

if ($pending) {
    $mark = $db->prepare("UPDATE commands SET status = 'delivered' WHERE id = ?");
    $mark->execute([$pending['id']]);
    send_json(['ok' => true, 'command' => ['id' => (int) $pending['id'], 'command' => $pending['command']]]);
}

send_json(['ok' => true, 'command' => null]);
