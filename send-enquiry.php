<?php
// Receives the contact form and sends it through Resend. The API key stays on the server.

const DIVISIONS = ['Marketing', 'AI · Worldie', 'Real Estate', 'Commodities', 'Something else'];
const PROPERTY_TYPES = ['Villa', 'Apartment', 'Penthouse', 'New development'];
const RATE_LIMIT = 5;
const RATE_WINDOW = 3600;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function field(string $key, int $max): string {
    $value = isset($_POST[$key]) && is_string($_POST[$key]) ? trim($_POST[$key]) : '';
    return mb_substr($value, 0, $max);
}

function single_line(string $value): string {
    return trim(preg_replace('/[\r\n\t]+/', ' ', $value));
}

function load_config(): ?array {
    foreach ([dirname(__DIR__) . '/klb-config.php', __DIR__ . '/.private/klb-config.php'] as $path) {
        if (is_file($path)) {
            $config = include $path;
            return is_array($config) ? $config : null;
        }
    }
    return null;
}

function rate_limited(string $ip): bool {
    $file = sys_get_temp_dir() . '/klb-enquiry-' . hash('sha256', $ip);
    $handle = fopen($file, 'c+');
    if (!$handle) {
        return false;
    }
    flock($handle, LOCK_EX);
    $now = time();
    $hits = array_filter(
        array_map('intval', explode(',', (string) stream_get_contents($handle))),
        fn ($t) => $t > $now - RATE_WINDOW
    );
    $limited = count($hits) >= RATE_LIMIT;
    if (!$limited) {
        $hits[] = $now;
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, implode(',', $hits));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $limited;
}

function send_email(string $key, array $payload): bool {
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json',
            'User-Agent: klb-solutions-website/1.0',
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload),
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($status < 200 || $status >= 300) {
        error_log('Resend send failed: HTTP ' . $status . ' ' . $error . ' ' . substr((string) $response, 0, 300));
        return false;
    }
    return true;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false]);
}

$config = load_config();
if (!$config || empty($config['resend_api_key'])) {
    error_log('Enquiry form: klb-config.php is missing or has no API key');
    respond(503, ['ok' => false]);
}

$origin = parse_url($_SERVER['HTTP_ORIGIN'] ?? '', PHP_URL_HOST);
if ($origin && !in_array($origin, $config['allowed_hosts'] ?? [], true)) {
    respond(403, ['ok' => false]);
}

// Bots fill the hidden field. Report success so they don't adapt.
if (field('website', 200) !== '') {
    respond(200, ['ok' => true]);
}

$division = single_line(field('division', 50));
$property = single_line(field('property', 50));
$name     = single_line(field('name', 200));
$company  = single_line(field('company', 200));
$email    = single_line(field('email', 254));
$phone    = single_line(field('phone', 50));
$goals    = field('goals', 5000);

$errors = [];
if (!in_array($division, DIVISIONS, true)) {
    $errors[] = 'division';
}
if ($division === 'Real Estate' && !in_array($property, PROPERTY_TYPES, true)) {
    $errors[] = 'property';
}
if ($name === '') {
    $errors[] = 'name';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'email';
}
if ($errors) {
    respond(422, ['ok' => false, 'fields' => $errors]);
}

if (rate_limited($_SERVER['REMOTE_ADDR'] ?? 'unknown')) {
    respond(429, ['ok' => false]);
}

$recipients = $config['recipients'] ?? [];
$to = ($recipients[$division] ?? '') ?: ($recipients['default'] ?? '');
if ($to === '') {
    error_log('Enquiry form: no recipient configured for ' . $division);
    respond(503, ['ok' => false]);
}

$rows = array_filter([
    'What can we help with?' => $division,
    'Property type'          => $division === 'Real Estate' ? $property : '',
    'Name'                   => $name,
    'Company'                => $company,
    'Email'                  => $email,
    'Phone'                  => $phone,
    'Goals'                  => $goals,
], fn ($value) => $value !== '');

$text = '';
$html = '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">';
foreach ($rows as $label => $value) {
    $text .= $label . ': ' . $value . "\n";
    $html .= '<tr><td valign="top"><strong>' . htmlspecialchars($label) . '</strong></td><td>'
        . nl2br(htmlspecialchars($value)) . '</td></tr>';
}
$html .= '</table>';

$sent = send_email($config['resend_api_key'], [
    'from'     => $config['from'],
    'to'       => [$to],
    'reply_to' => $email,
    'subject'  => 'New enquiry: ' . $division . ' — ' . $name,
    'text'     => $text,
    'html'     => $html,
]);
if (!$sent) {
    respond(502, ['ok' => false]);
}

if (!empty($config['auto_reply'])) {
    $reply = "Received — we'll be in touch shortly to arrange a call.\n\nKLB Solutions";
    send_email($config['resend_api_key'], array_filter([
        'from'     => $config['from'],
        'to'       => [$email],
        'reply_to' => $config['auto_reply_to'] ?? '',
        'subject'  => 'We received your enquiry — KLB Solutions',
        'text'     => $reply,
    ]));
}

respond(200, ['ok' => true]);
