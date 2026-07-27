-- Run this once against your cPanel MySQL database (phpMyAdmin's "SQL"
-- tab is the easiest way) after creating the database + user via cPanel's
-- "MySQL Databases" tool and pointing config.php at them.

CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_uuid VARCHAR(36) NOT NULL UNIQUE,
  hostname VARCHAR(255) NOT NULL DEFAULT '',
  platform VARCHAR(32) NOT NULL DEFAULT '',
  os_release VARCHAR(64) NOT NULL DEFAULT '',
  username VARCHAR(128) NOT NULL DEFAULT '',
  internet_blocked TINYINT(1) NOT NULL DEFAULT 0,
  last_seen_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_uuid VARCHAR(36) NOT NULL,
  command VARCHAR(16) NOT NULL,          -- BLOCK | ALLOW
  status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending | delivered | acked | failed
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acked_at DATETIME NULL,
  error TEXT NULL,
  INDEX idx_device_status (device_uuid, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
