<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$listings = DB::table('listings')->select('id', 'user_id', 'title', 'price', 'status')->get();
$users = DB::table('users')->select('id', 'name', 'email')->get();

$out = [];
$out[] = "=== CONTENU DE LA TABLE LISTINGS ===";
$out[] = "Nombre total d'annonces : " . $listings->count();
foreach ($listings as $l) {
    $out[] = "ID: {$l->id} | User ID: {$l->user_id} | Titre: {$l->title} | Prix: {$l->price} MAD | Statut: {$l->status}";
}

$out[] = "\n=== CONTENU DE LA TABLE USERS ===";
$out[] = "Nombre total d'utilisateurs : " . $users->count();
foreach ($users as $u) {
    $out[] = "ID: {$u->id} | Nom: {$u->name} | Email: {$u->email}";
}

$logContent = implode("\n", $out);
file_put_contents(__DIR__ . '/check-listings.log', $logContent);
echo "<pre>\n" . htmlspecialchars($logContent) . "\n</pre>";
