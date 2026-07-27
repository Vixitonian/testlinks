<?php
require_once __DIR__ . '/../config.php';

/** Lazily-created, reused-per-request PDO connection. */
function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];
        // Without this, MySQL's rowCount() on UPDATE reports rows whose
        // *values actually changed*, not rows the WHERE clause matched —
        // so an UPDATE that matches a real row but happens to set columns
        // to values they already have (e.g. two calls landing in the same
        // second, so a DATETIME column doesn't visibly change) reports 0
        // rows and gets misread as "no such row". This flag makes
        // rowCount() mean what every endpoint here actually assumes it
        // means: how many rows matched.
        if (defined('PDO::MYSQL_ATTR_FOUND_ROWS')) {
            $options[PDO::MYSQL_ATTR_FOUND_ROWS] = true;
        }
        $pdo = new PDO(
            DB_DSN,
            defined('DB_USER') ? DB_USER : null,
            defined('DB_PASS') ? DB_PASS : null,
            $options
        );
    }
    return $pdo;
}
