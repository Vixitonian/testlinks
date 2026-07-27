<?php
/**
 * POST /command.php
 * For the future phone app: enqueues a command for a device to pick up
 * on its next heartbeat.
 *
 * Body: {device_uuid, command: "BLOCK" | "ALLOW"}
 * -> {ok: true, id: <command id>}
 */
require_once __DIR__ . '/includes/util.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';

cors_headers();
require_method('POST');
require_admin_key();

$in = json_input();
require_fields($in, ['device_uuid', 'command']);

$command = strtoupper((string) $in['command']);
if (!in_array($command, ['BLOCK', 'ALLOW'], true)) {
    send_error("command must be 'BLOCK' or 'ALLOW'", 400);
}

$db = get_db();

$device = $db->prepare('SELECT id FROM devices WHERE device_uuid = ?');
$device->execute([$in['device_uuid']]);
if (!$device->fetch()) {
    send_error('Unknown device_uuid', 404);
}

$insert = $db->prepare('INSERT INTO commands (device_uuid, command) VALUES (?, ?)');
$insert->execute([$in['device_uuid'], $command]);

send_json(['ok' => true, 'id' => (int) $db->lastInsertId()]);
