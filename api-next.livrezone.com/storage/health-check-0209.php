<?php
// Diagnostic ponctuel Redis / Meilisearch / Reverb — supprimable
error_reporting(E_ALL);

echo "=== REDIS (livrezone-redis:6379) ===\n";
$ip = gethostbyname('livrezone-redis');
echo "DNS livrezone-redis => ".($ip === 'livrezone-redis' ? 'NON RESOLU' : $ip)."\n";
$sock = @fsockopen('livrezone-redis', 6379, $errno, $errstr, 3.0);
if ($sock) {
    fwrite($sock, "PING\r\n");
    $resp = fread($sock, 64);
    echo "PING => ".trim($resp)."\n";
    fclose($sock);
} else {
    echo "TCP KO : [$errno] $errstr\n";
}

echo "\n=== MEILISEARCH (http://192.168.1.202:7700) ===\n";
$ctx = stream_context_create(['http' => ['timeout' => 4.0]]);
$h = @file_get_contents('http://192.168.1.202:7700/health', false, $ctx);
echo $h === false ? "HEALTH KO\n" : "HEALTH => ".trim($h)."\n";

echo "\n=== REVERB (interne 127.0.0.1:6060) ===\n";
$s = @fsockopen('127.0.0.1', 6060, $e2, $m2, 3.0);
if ($s) { echo "PORT 6060 OUVERT\n"; fclose($s); }
else { echo "PORT 6060 FERME/INJOIGNABLE : [$e2] $m2\n"; }
