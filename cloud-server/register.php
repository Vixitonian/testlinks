<?php
/**
 * POST /register.php
 * Called once at agent startup to (re)announce a device's identity.
 * Safe to call repeatedly — it's an upsert keyed on device_uuid.
 *
 * Body: {device_uuid, hostname, platform, osRelease, username}
 * -> {ok: true}
 */
require_once __DIR__ . '/includes/util.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';

cors_headers();
require_method('POST');
require_device_key();

$in = json_input();
require_fields($in, ['device_uuid', 'hostname', 'platform']);

$db = get_db();
$existing = $db->prepare('SELECT id FROM devices WHERE device_uuid = ?');
$existing->execute([$in['device_uuid']]);

if ($existing->fetch()) {
    $stmt = $db->prepare(
        'UPDATE devices SET hostname = ?, platform = ?, os_release = ?, username = ?, last_seen_at = NOW() WHERE device_uuid = ?'
    );
    $stmt->execute([
        $in['hostname'], $in['platform'], $in['osRelease'] ?? '', $in['username'] ?? '', $in['device_uuid']
    ]);
} else {
    $stmt = $db->prepare(
        'INSERT INTO devices (device_uuid, hostname, platform, os_release, username, last_seen_at) VALUES (?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([
        $in['device_uuid'], $in['hostname'], $in['platform'], $in['osRelease'] ?? '', $in['username'] ?? ''
    ]);
}

send_json(['ok' => true]);
