<?php
require_once __DIR__ . '/util.php';

function _sent_api_key(): string {
    // Not every host forwards the Authorization/X-Api-Key header into
    // $_SERVER the same way under mod_php vs PHP-FPM, so check the two
    // common spellings.
    return $_SERVER['HTTP_X_API_KEY'] ?? $_SERVER['REDIRECT_HTTP_X_API_KEY'] ?? '';
}

/** hash_equals() is timing-safe — plain === would leak key length/prefix
 *  via response-time differences. */
function require_device_key(): void {
    if (!hash_equals(DEVICE_API_KEY, _sent_api_key())) {
        send_error('Unauthorized', 401);
    }
}

function require_admin_key(): void {
    if (!hash_equals(ADMIN_API_KEY, _sent_api_key())) {
        send_error('Unauthorized', 401);
    }
}
