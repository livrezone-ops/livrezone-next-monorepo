<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\Laravel\Facades\Image;

/**
 * Génération paresseuse des miniatures de couvertures catalogue.
 *
 * Uniquement les couvertures sollicitées (création/édition d'annonce, batch
 * covers:generate-thumbnails) : aucune génération en masse au déploiement.
 *
 * Format de sortie aligné sur le proxy (routes/web.php) et sur les miniatures
 * existantes : {base}/thumbnails/{size}/{xx}/{isbn}.webp, où {xx} = 2 derniers
 * chiffres du nom de fichier et {base} = dossier parent de originals/.
 * Un échec est silencieux (log warning) : le proxy retombe sur l'original,
 * la requête de l'utilisateur n'est jamais bloquée.
 */
class ThumbnailService
{
    /** Tailles de miniatures générées (sous-dossiers de thumbnails/) */
    public const SIZES = [160, 320];

    /**
     * Génère les miniatures manquantes d'une couverture catalogue.
     *
     * @param  string|null  $coverPath  cover_path brut du modèle (simple, 'originals/…',
     *                                  upload utilisateur ou URL externe — filtré)
     * @param  bool  $force  régénérer même si la miniature existe déjà
     */
    public static function ensureThumbnailsExist(?string $coverPath, bool $force = false): void
    {
        try {
            $filename = self::catalogFilename($coverPath);
            if ($filename === null) {
                return;
            }

            $baseRoot = self::baseRoot();
            $source = self::locateSource($baseRoot, $filename);
            if ($source === null) {
                return;
            }

            $webpName = self::webpName($filename);
            $shard = self::shardFor($webpName);

            foreach (self::SIZES as $size) {
                $thumbDir = "{$baseRoot}/thumbnails/{$size}/{$shard}";
                $thumbPath = "{$thumbDir}/{$webpName}";

                if (! $force && is_file($thumbPath)) {
                    continue;
                }

                if (! is_dir($thumbDir) && ! mkdir($thumbDir, 0755, true) && ! is_dir($thumbDir)) {
                    return;
                }

                $image = Image::decode($source)->scaleDown(width: $size);
                file_put_contents($thumbPath, (string) $image->encode(new WebpEncoder(quality: 82)));
            }
        } catch (\Throwable $e) {
            Log::warning('ThumbnailService: '.$e->getMessage(), ['cover_path' => $coverPath]);
        }
    }

    /** Racine couvertures : dossier parent de originals/ (mêmes règles que le proxy) */
    protected static function baseRoot(): string
    {
        $publicRoot = rtrim((string) config('filesystems.disks.book_covers_public.root'), '/');

        return basename($publicRoot) === 'originals' ? dirname($publicRoot) : $publicRoot;
    }

    /**
     * Nom de fichier catalogue à miniaturiser, ou null si le chemin n'est pas
     * une couverture catalogue (upload utilisateur, URL externe, vide).
     */
    protected static function catalogFilename(?string $coverPath): ?string
    {
        $path = trim((string) $coverPath);

        if ($path === ''
            || preg_match('#^https?://#i', $path)
            || str_starts_with($path, 'book-covers/user-uploads/')
        ) {
            return null;
        }

        return basename(ltrim(str_replace('originals/', '', $path), '/'));
    }

    /**
     * Localise l'original : {shard}/{nom} d'abord, puis à plat, avec tolérance
     * d'extension (la DB peut annoncer .webp quand le fichier est .jpg…).
     */
    protected static function locateSource(string $baseRoot, string $filename): ?string
    {
        $noExt = pathinfo($filename, PATHINFO_FILENAME);
        $names = [$filename];
        foreach (['webp', 'jpg', 'jpeg', 'png'] as $ext) {
            $names[] = "{$noExt}.{$ext}";
        }

        $shard = self::shardFor($filename);
        foreach ([$shard, ''] as $dir) {
            foreach ($names as $name) {
                $candidate = "{$baseRoot}/originals".($dir !== '' ? "/{$dir}" : '')."/{$name}";
                if (is_file($candidate)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    protected static function webpName(string $filename): string
    {
        return preg_replace('/\.(jpg|jpeg|png|webp)$/i', '.webp', $filename);
    }

    /** Sous-dossier de sharding : 2 derniers chiffres du nom, '00' sinon */
    protected static function shardFor(string $filename): string
    {
        $shard = substr(pathinfo($filename, PATHINFO_FILENAME), -2);

        return is_numeric($shard) ? $shard : '00';
    }
}
