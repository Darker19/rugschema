<?php
// Gedeelde code voor de API: instellingen, databaseverbinding, sessies en antwoorden.
// Werkt op PHP 7.4 en hoger (Hostnet). Geen externe bibliotheken nodig.

const SESSIE_COOKIE = 'rs_sessie';
const SESSIE_UREN = 12;            // automatisch uitloggen na zoveel uur zonder activiteit
const MAX_POGINGEN = 8;            // mislukte inlogpogingen per IP of e-mail ...
const POGING_MINUTEN = 15;         // ... binnen dit aantal minuten
const MAX_BODY = 4 * 1024 * 1024;  // grootste toegestane verzoek (4 MB)

// Nooit technische foutmeldingen tonen: wel loggen voor de beheerder, de app krijgt alleen "serverfout"
ini_set('display_errors', '0');
set_exception_handler(function ($e) {
  error_log('RugSchema: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  if (!headers_sent()) antwoord(['fout' => 'serverfout'], 500);
});

function antwoord($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function instellingen() {
  static $c = null;
  if ($c === null) {
    $pad = __DIR__ . '/config.php';
    if (!is_file($pad)) antwoord(['fout' => 'niet-ingesteld'], 503);
    $c = require $pad;
  }
  return $c;
}

function db() {
  static $pdo = null;
  if ($pdo === null) {
    $c = instellingen();
    try {
      $pdo = new PDO('mysql:host=' . $c['db_host'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4', $c['db_user'], $c['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
      ]);
    } catch (PDOException $e) {
      error_log('RugSchema db: ' . $e->getMessage());
      antwoord(['fout' => 'database-onbereikbaar'], 503);
    }
  }
  return $pdo;
}

// Tabellen aanmaken als ze nog niet bestaan (aangeroepen door setup.php)
function maak_tabellen() {
  $db = db();
  $db->exec("CREATE TABLE IF NOT EXISTS gebruikers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    naam VARCHAR(100) NOT NULL,
    wachtwoord VARCHAR(255) NOT NULL,
    aangemaakt DATETIME NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $db->exec("CREATE TABLE IF NOT EXISTS sessies (
    token_hash CHAR(64) PRIMARY KEY,
    gebruiker_id INT NOT NULL,
    verloopt DATETIME NOT NULL,
    INDEX (gebruiker_id), INDEX (verloopt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $db->exec("CREATE TABLE IF NOT EXISTS inlogpogingen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    email VARCHAR(190) NOT NULL,
    tijd DATETIME NOT NULL,
    INDEX (ip, tijd), INDEX (email, tijd)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  // Voorlopig alle gegevens van de praktijk als één JSON-document (rij id=1), met een versienummer
  // zodat twee apparaten elkaars wijzigingen niet ongemerkt overschrijven.
  $db->exec("CREATE TABLE IF NOT EXISTS praktijkdata (
    id TINYINT PRIMARY KEY,
    gegevens LONGTEXT NOT NULL,
    afgevinkt LONGTEXT NOT NULL,
    versie INT NOT NULL,
    gewijzigd DATETIME NOT NULL,
    gewijzigd_door INT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function invoer() {
  if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > MAX_BODY) antwoord(['fout' => 'te-groot'], 413);
  $ruw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
  if (strlen($ruw) > MAX_BODY) antwoord(['fout' => 'te-groot'], 413);
  $data = json_decode($ruw, true);
  if (!is_array($data)) antwoord(['fout' => 'ongeldige-invoer'], 400);
  return $data;
}

// Wijzigende verzoeken moeten van de app zelf komen: een eigen header kan een andere site niet meesturen
function eis_app_verzoek() {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_RUGSCHEMA'] ?? '') !== '1') antwoord(['fout' => 'niet-toegestaan'], 403);
}

function nu($plus = '') { return date('Y-m-d H:i:s', $plus ? strtotime($plus) : time()); }
function client_ip() { return substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45); }

function zet_cookie($waarde, $verloopt) {
  setcookie(SESSIE_COOKIE, $waarde, [
    'expires' => $verloopt, 'path' => '/', 'secure' => instellingen()['cookie_secure'] ?? true,
    'httponly' => true, 'samesite' => 'Strict',
  ]);
}

function start_sessie($gebruiker_id) {
  $token = bin2hex(random_bytes(32));
  db()->prepare('INSERT INTO sessies (token_hash, gebruiker_id, verloopt) VALUES (?, ?, ?)')
      ->execute([hash('sha256', $token), $gebruiker_id, nu('+' . SESSIE_UREN . ' hours')]);
  zet_cookie($token, 0); // sessiecookie: weg als de browser sluit
}

// Geeft de ingelogde gebruiker terug (en verlengt de sessie), of null
function huidige_gebruiker() {
  $token = $_COOKIE[SESSIE_COOKIE] ?? '';
  if (!preg_match('/^[a-f0-9]{64}$/', $token)) return null;
  $hash = hash('sha256', $token);
  $q = db()->prepare('SELECT g.id, g.email, g.naam FROM sessies s JOIN gebruikers g ON g.id = s.gebruiker_id WHERE s.token_hash = ? AND s.verloopt > ?');
  $q->execute([$hash, nu()]);
  $g = $q->fetch();
  if (!$g) return null;
  db()->prepare('UPDATE sessies SET verloopt = ? WHERE token_hash = ?')->execute([nu('+' . SESSIE_UREN . ' hours'), $hash]);
  return $g;
}

function eis_gebruiker() {
  $g = huidige_gebruiker();
  if (!$g) antwoord(['fout' => 'niet-ingelogd'], 401);
  return $g;
}
