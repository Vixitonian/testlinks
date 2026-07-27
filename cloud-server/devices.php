<?php
/**
 * GET /devices.php
 * For the future phone app's "Devices" screen.
 * -> {ok: true, devices: [{device_uuid, hostname, platform, username,
 *                           internet_blocked, online, last_seen_at}, ...]}
 */
require_once __DIR__ . '/includes/util.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';

cors_headers();
require_method('GET');
require_admin_key();

$db = get_db();
// "online" is computed with TIMESTAMPDIFF against MySQL's own NOW(), the
// same clock last_seen_at was written with — this avoids any mismatch
// between the DB server's and PHP's configured timezones.
$stmt = $db->prepare(
    'SELECT device_uuid, hostname, platform, username, internet_blocked, last_seen_at,
            (last_seen_at IS NOT NULL AND TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) <= ?) AS online
     FROM devices ORDER BY last_seen_at DESC'
);
$stmt->execute([ONLINE_THRESHOLD_SECONDS]);
$rows = $stmt->fetchAll();

$devices = array_map(function ($row) {
    $row['internet_blocked'] = (bool) $row['internet_blocked'];
    $row['online'] = (bool) $row['online'];
    return $row;
}, $rows);

send_json(['ok' => true, 'devices' => $devices]);
