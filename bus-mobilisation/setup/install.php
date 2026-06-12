<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bus Mobilisation — Install</title>
<style>
body { font-family: monospace; max-width: 700px; margin: 40px auto; padding: 0 20px; background: #f8f8f8; }
h1 { color: #1a3a6b; }
.ok   { color: #1a7a3a; }
.err  { color: #c0392b; }
.warn { color: #e67e22; }
pre   { background: #fff; border: 1px solid #ddd; padding: 12px; }
</style>
</head>
<body>
<h1>Bus Mobilisation System — Installation</h1>
<?php
$db_path = __DIR__ . '/../data/bus_mobilisation.db';

if (!is_writable(__DIR__ . '/../data')) {
    echo '<p class="err">ERROR: data/ directory is not writable. Please create it and set write permissions.</p>';
    exit;
}

if (file_exists($db_path)) {
    $confirm = $_GET['confirm'] ?? '';
    if ($confirm !== 'yes') {
        echo '<p class="warn">Database already exists at <code>data/bus_mobilisation.db</code>.</p>';
        echo '<p><a href="install.php?confirm=yes">Re-run installation (will DROP and recreate all tables)</a></p>';
        exit;
    }
}

try {
    $pdo = new PDO('sqlite:' . $db_path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON;');
    $pdo->exec('PRAGMA journal_mode = WAL;');

    $sql = <<<SQL
DROP TABLE IF EXISTS headcount_slips;
DROP TABLE IF EXISTS sms_log;
DROP TABLE IF EXISTS call_log;
DROP TABLE IF EXISTS persons;
DROP TABLE IF EXISTS terminals;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin','caller','coordinator')),
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    event_date     TEXT NOT NULL,
    report_time    TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE terminals (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id       INTEGER NOT NULL REFERENCES events(id),
    name           TEXT NOT NULL,
    area           TEXT NOT NULL,
    landmark       TEXT NOT NULL,
    coordinator_id INTEGER REFERENCES users(id),
    bus_info       TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE persons (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id          INTEGER NOT NULL REFERENCES events(id),
    full_name         TEXT NOT NULL,
    phone             TEXT NOT NULL,
    terminal_id       INTEGER REFERENCES terminals(id),
    status            TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','assigned','confirmed','no_show')),
    call_attempts     INTEGER NOT NULL DEFAULT 0,
    fallback_sent     INTEGER NOT NULL DEFAULT 0,
    confirmation_sent INTEGER NOT NULL DEFAULT 0,
    boarded           INTEGER,
    imported_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE call_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id      INTEGER NOT NULL REFERENCES persons(id),
    caller_id      INTEGER NOT NULL REFERENCES users(id),
    attempt_number INTEGER NOT NULL,
    outcome        TEXT NOT NULL CHECK(outcome IN ('answered','no_answer')),
    terminal_id    INTEGER REFERENCES terminals(id),
    called_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sms_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id    INTEGER NOT NULL REFERENCES persons(id),
    sms_type     TEXT NOT NULL CHECK(sms_type IN ('confirmation','fallback')),
    message_text TEXT NOT NULL,
    api_response TEXT,
    sent_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE headcount_slips (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_id           INTEGER NOT NULL REFERENCES terminals(id),
    coordinator_id        INTEGER NOT NULL REFERENCES users(id),
    boarded_count         INTEGER NOT NULL,
    absent_count          INTEGER NOT NULL,
    actual_departure_time TEXT NOT NULL,
    submitted_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_persons_phone_event ON persons(phone, event_id);
CREATE INDEX idx_persons_event    ON persons(event_id);
CREATE INDEX idx_persons_terminal ON persons(terminal_id);
CREATE INDEX idx_call_log_person  ON call_log(person_id);
CREATE INDEX idx_terminals_event  ON terminals(event_id);
SQL;

    $pdo->exec($sql);
    echo '<p class="ok">✓ All tables created successfully.</p>';

    // Seed default settings
    $settings = [
        ['sms_username', ''],
        ['sms_password', ''],
        ['sms_sender',   'BusMobil'],
        ['admin_phone',  ''],
    ];
    $st = $pdo->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    foreach ($settings as $s) $st->execute($s);
    echo '<p class="ok">✓ Default settings seeded.</p>';

    // Seed default admin user
    $hash = password_hash('admin123', PASSWORD_DEFAULT);
    $st = $pdo->prepare('INSERT OR IGNORE INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)');
    $st->execute(['Administrator', 'admin', $hash, 'admin']);
    echo '<p class="ok">✓ Default admin user created (phone: <strong>admin</strong>, password: <strong>admin123</strong>).</p>';

    echo '<p class="warn">⚠ Delete or restrict access to <code>setup/install.php</code> after first run.</p>';
    echo '<p><a href="../index.php">→ Go to Login</a></p>';

} catch (Exception $e) {
    echo '<p class="err">ERROR: ' . htmlspecialchars($e->getMessage()) . '</p>';
}
?>
</body>
</html>
