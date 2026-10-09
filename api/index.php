<?php
// API van RugSchema. Aanroepen als api/?a=<actie>.
//   GET  sessie     -> {ingelogd, naam, email}
//   POST login      {email, wachtwoord}
//   POST uitloggen
//   GET  gegevens   -> {gegevens, afgevinkt, versie}
//   POST bewaar     {gegevens, afgevinkt, versie} -> {versie} of 409 als iemand anders intussen heeft opgeslagen
//   POST wachtwoord {oud, nieuw}
require __DIR__ . '/lib.php';

$actie = $_GET['a'] ?? '';

if ($actie === 'sessie') {
  $g = huidige_gebruiker();
  antwoord($g ? ['ingelogd' => true, 'naam' => $g['naam'], 'email' => $g['email']] : ['ingelogd' => false]);
}

if ($actie === 'login') {
  eis_app_verzoek();
  $in = invoer();
  $email = strtolower(trim((string)($in['email'] ?? '')));
  $ww = (string)($in['wachtwoord'] ?? '');
  $db = db();
  $grens = nu('-' . POGING_MINUTEN . ' minutes');
  $q = $db->prepare('SELECT COUNT(*) FROM inlogpogingen WHERE (ip = ? OR email = ?) AND tijd > ?');
  $q->execute([client_ip(), $email, $grens]);
  if ((int)$q->fetchColumn() >= MAX_POGINGEN) antwoord(['fout' => 'te-vaak'], 429);

  $q = $db->prepare('SELECT id, naam, email, wachtwoord FROM gebruikers WHERE email = ?');
  $q->execute([$email]);
  $g = $q->fetch();
  // ook zonder gebruiker een wachtwoord controleren, zodat de responstijd niet verraadt of het e-mailadres bestaat
  $ok = $g ? password_verify($ww, $g['wachtwoord']) : (password_verify($ww, password_hash('nep', PASSWORD_DEFAULT)) && false);
  if (!$g || !$ok) {
    $db->prepare('INSERT INTO inlogpogingen (ip, email, tijd) VALUES (?, ?, ?)')->execute([client_ip(), $email, nu()]);
    antwoord(['fout' => 'onjuist'], 401);
  }
  if (password_needs_rehash($g['wachtwoord'], PASSWORD_DEFAULT)) {
    $db->prepare('UPDATE gebruikers SET wachtwoord = ? WHERE id = ?')->execute([password_hash($ww, PASSWORD_DEFAULT), $g['id']]);
  }
  $db->prepare('DELETE FROM inlogpogingen WHERE email = ? OR tijd < ?')->execute([$email, nu('-1 day')]);
  $db->prepare('DELETE FROM sessies WHERE verloopt < ?')->execute([nu()]);
  start_sessie($g['id']);
  antwoord(['ingelogd' => true, 'naam' => $g['naam'], 'email' => $g['email']]);
}

if ($actie === 'uitloggen') {
  eis_app_verzoek();
  $token = $_COOKIE[SESSIE_COOKIE] ?? '';
  if (preg_match('/^[a-f0-9]{64}$/', $token)) db()->prepare('DELETE FROM sessies WHERE token_hash = ?')->execute([hash('sha256', $token)]);
  zet_cookie('', time() - 3600);
  antwoord(['ingelogd' => false]);
}

if ($actie === 'gegevens') {
  eis_gebruiker();
  $r = db()->query('SELECT gegevens, afgevinkt, versie FROM praktijkdata WHERE id = 1')->fetch();
  antwoord($r
    ? ['gegevens' => json_decode($r['gegevens'], true), 'afgevinkt' => json_decode($r['afgevinkt'], true), 'versie' => (int)$r['versie']]
    : ['gegevens' => null, 'afgevinkt' => new stdClass(), 'versie' => 0]);
}

if ($actie === 'bewaar') {
  eis_app_verzoek();
  $g = eis_gebruiker();
  $in = invoer();
  if (!isset($in['gegevens']['cards']) || !is_array($in['gegevens']['cards'])) antwoord(['fout' => 'ongeldige-gegevens'], 400);
  $gegevens = json_encode($in['gegevens'], JSON_UNESCAPED_UNICODE);
  $afgevinkt = json_encode(isset($in['afgevinkt']) && is_array($in['afgevinkt']) && $in['afgevinkt'] ? $in['afgevinkt'] : new stdClass(), JSON_UNESCAPED_UNICODE);
  $versie = (int)($in['versie'] ?? -1);
  $db = db();
  if ($versie === 0) {
    // eerste keer opslaan: alleen als er nog niets staat
    $q = $db->prepare('INSERT IGNORE INTO praktijkdata (id, gegevens, afgevinkt, versie, gewijzigd, gewijzigd_door) VALUES (1, ?, ?, 1, ?, ?)');
    $q->execute([$gegevens, $afgevinkt, nu(), $g['id']]);
  } else {
    $q = $db->prepare('UPDATE praktijkdata SET gegevens = ?, afgevinkt = ?, versie = versie + 1, gewijzigd = ?, gewijzigd_door = ? WHERE id = 1 AND versie = ?');
    $q->execute([$gegevens, $afgevinkt, nu(), $g['id'], $versie]);
  }
  if ($q->rowCount() !== 1) {
    $huidig = $db->query('SELECT versie FROM praktijkdata WHERE id = 1')->fetchColumn();
    antwoord(['fout' => 'conflict', 'versie' => (int)$huidig], 409);
  }
  antwoord(['versie' => $versie + 1]);
}

if ($actie === 'wachtwoord') {
  eis_app_verzoek();
  $g = eis_gebruiker();
  $in = invoer();
  $nieuw = (string)($in['nieuw'] ?? '');
  if (strlen($nieuw) < 12) antwoord(['fout' => 'te-kort'], 400);
  $q = db()->prepare('SELECT wachtwoord FROM gebruikers WHERE id = ?');
  $q->execute([$g['id']]);
  if (!password_verify((string)($in['oud'] ?? ''), $q->fetchColumn())) antwoord(['fout' => 'onjuist'], 401);
  db()->prepare('UPDATE gebruikers SET wachtwoord = ? WHERE id = ?')->execute([password_hash($nieuw, PASSWORD_DEFAULT), $g['id']]);
  // andere apparaten uitloggen, deze sessie blijft
  db()->prepare('DELETE FROM sessies WHERE gebruiker_id = ? AND token_hash <> ?')->execute([$g['id'], hash('sha256', $_COOKIE[SESSIE_COOKIE])]);
  antwoord(['ok' => true]);
}

antwoord(['fout' => 'onbekende-actie'], 404);
