<?php

// 1. Lire et parser le fichier .env pour récupérer les accès DB
$envFile = __DIR__ . '/.env';
if (!file_exists($envFile)) {
    die("Fichier .env introuvable.\n");
}

$env = [];
$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    if (strpos(trim($line), '#') === 0) continue;
    list($name, $value) = explode('=', $line, 2);
    $env[trim($name)] = trim(trim($value), '"\'');
}

$host = $env['DB_HOST'] ?? 'mariadb';
$port = $env['DB_PORT'] ?? '3306';
$db   = $env['DB_DATABASE'] ?? 'nextlivrezonebd';
$user = $env['DB_USERNAME'] ?? 'livrezone';
$pass = $env['DB_PASSWORD'] ?? '';

// 2. Connexion à la base de données via PDO
try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    die("Erreur de connexion DB: " . $e->getMessage() . "\n");
}

// 3. Récupérer les données de chaque table
try {
    // Langues
    $languages = $pdo->query("SELECT id, code, name_fr FROM languages ORDER BY name_fr")->fetchAll();

    // Niveaux
    $levels = $pdo->query("SELECT id, code, name_fr, cycle FROM levels ORDER BY rank")->fetchAll();

    // Matières
    $subjects = $pdo->query("SELECT id, code, name_fr, family FROM subjects ORDER BY name_fr")->fetchAll();

    // Catégories (Parents et enfants)
    $categoriesRaw = $pdo->query("SELECT id, code, name_fr, parent_id FROM categories ORDER BY sort_order")->fetchAll();
    
    // Organiser les catégories de manière hiérarchique
    $categories = [];
    $parents = [];
    foreach ($categoriesRaw as $cat) {
        if ($cat['parent_id'] === null) {
            $parents[$cat['id']] = [
                'id' => $cat['id'],
                'code' => $cat['code'],
                'name_fr' => $cat['name_fr'],
                'subcategories' => []
            ];
        }
    }
    foreach ($categoriesRaw as $cat) {
        if ($cat['parent_id'] !== null) {
            $parentId = $cat['parent_id'];
            if (isset($parents[$parentId])) {
                $parents[$parentId]['subcategories'][] = [
                    'id' => $cat['id'],
                    'code' => $cat['code'],
                    'name_fr' => $cat['name_fr']
                ];
            }
        }
    }
    $categories = array_values($parents);

    // Structure de la cartographie
    $mapping = [
        'languages' => $languages,
        'levels' => $levels,
        'subjects' => $subjects,
        'categories' => $categories
    ];

    // 4. Écrire le fichier mapping.json
    $outputFile = __DIR__ . '/mapping.json';
    file_put_contents($outputFile, json_encode($mapping, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    echo "Cartographie générée avec succès dans mapping.json !\n";

} catch (Exception $e) {
    echo "Erreur lors de la récupération : " . $e->getMessage() . "\n";
}
