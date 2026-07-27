<?php
/**
 * POST /ack.php
 * The agent calls this right after attempting a delivered command, so the
 * phone app (once built) can show whether a Block/Allow actually worked.
 *
 * Body: {device_uuid, command_id, ok, error?}
 * -> {ok: true}
 */
require_once __DIR__ . '/includes/util.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';

cors_headers();
require_method('POST');
require_device_key();

$in = json_input();
require_fields($in, ['device_uuid', 'command_id']);

$status = !empty($in['ok']) ? 'acked' : 'failed';
$error = isset($in['error']) ? (string) $in['error'] : null;

$db = get_db();
// Scoped to device_uuid too, so one device can never ack another's command id.
$stmt = $db->prepare(
    'UPDATE commands SET status = ?, acked_at = NOW(), error = ? WHERE id = ? AND device_uuid = ?'
);
$stmt->execute([$status, $error, $in['command_id'], $in['device_uuid']]);

if ($stmt->rowCount() === 0) {
    send_error('Command not found for this device', 404);
}

send_json(['ok' => true]);
