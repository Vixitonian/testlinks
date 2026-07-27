<?php
/**
 * Copy this file to config.php and fill in real values. config.php is
 * gitignored — never commit real database credentials or API keys.
 */

// PDO DSN for your cPanel MySQL database (create the DB + user first via
// cPanel's "MySQL Databases" tool, then run schema.sql on it via
// phpMyAdmin). cPanel database/user names are usually prefixed with your
// account username, e.g. "myuser_agent".
define('DB_DSN', 'mysql:host=localhost;dbname=yourcpaneluser_agent;charset=utf8mb4');
define('DB_USER', 'yourcpaneluser_agent');
define('DB_PASS', 'change-me');

// Shared secret the laptop agent must send on every request, as the
// X-Api-Key header. Generate one with:
//   php -r "echo bin2hex(random_bytes(32));"
define('DEVICE_API_KEY', 'change-me-device-key');

// Separate shared secret for admin/phone-app-facing endpoints
// (devices.php, command.php). Keep it different from DEVICE_API_KEY so a
// leaked agent config can't be used to issue commands to other devices.
define('ADMIN_API_KEY', 'change-me-admin-key');

// A device counts as "online" if its last heartbeat was within this many
// seconds. Should be a few times your agent's poll interval.
define('ONLINE_THRESHOLD_SECONDS', 30);
