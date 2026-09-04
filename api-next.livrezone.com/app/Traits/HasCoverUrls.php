<?php

namespace App\Traits;

use Illuminate\Support\Str;

/**
 * URLs de couverture partagées entre Listing, Order et Book.
 *
 * Chaîne de résolution : cover_path (URL directe / upload utilisateur /
 * couverture catalogue) → fallback spécifique au modèle (coverFallbackUrl)
 * → image placeholder (coverPlaceholderUrl).
 *
 * Points d'extension par modèle :
 * - coverFallbackUrl()    : couverture de remplacement propre au modèle
 *                           (défaut : cover_source_url ; Order → book)
 * - coverCatalogBaseUrl() : base des URLs catalogue (proxy par défaut)
 * - coverPlaceholderUrl() : image affichée si aucune couverture trouvée
 */
trait HasCoverUrls
{
    /** Préfixes de dossier pour les couvertures uploadées par les utilisateurs.
     *  'book-covers/user-uploads/' : ancien flux ; 'covers/users/' : flux actuel
     *  (ImageUploadService::storeImage). Les deux sont servis via /storage. */
    public const USER_COVER_DIRS = ['book-covers/user-uploads', 'covers/users'];

    /** Préfixe historique (compat : tests et ListingValidationService) */
    public const USER_COVER_DIR = 'book-covers/user-uploads';

    /**
     * Retourne true uniquement si le chemin appartient aux uploads utilisateurs.
     * Les couvertures catalogue (books) ne contiennent jamais de '/' dans leur nom
     * (hormis le préfixe 'originals/', traité par catalogCoverFilename()).
     */
    public static function isUserUploadedCover(?string $coverPath): bool
    {
        if ($coverPath === null) {
            return false;
        }

        foreach (self::USER_COVER_DIRS as $dir) {
            if (str_starts_with($coverPath, $dir.'/')) {
                return true;
            }
        }

        return false;
    }

    public function getCoverUrlAttribute(): ?string
    {
        if ($this->coverModerationBlocked()) {
            return $this->coverPlaceholderUrl();
        }

        $path = trim((string) ($this->cover_path ?? ''));

        if ($path === '') {
            return $this->coverFallbackUrl() ?? $this->coverPlaceholderUrl();
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        if (self::isUserUploadedCover($path)) {
            return asset('storage/'.$path);
        }

        // Couverture catalogue : nom de fichier simple (9782294788222.jpg)
        return $this->coverCatalogBaseUrl().'/'.$this->catalogCoverFilename($path);
    }

    public function getCoverThumbnailUrlAttribute(): ?string
    {
        return $this->getCoverThumbnailUrl(160);
    }

    public function getCoverThumbnailUrl(int $size = 160): ?string
    {
        if ($this->coverModerationBlocked()) {
            return $this->coverPlaceholderUrl();
        }

        $path = trim((string) ($this->cover_path ?? ''));

        if ($path === '') {
            return $this->coverFallbackUrl(true) ?? $this->coverPlaceholderUrl();
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        if (self::isUserUploadedCover($path)) {
            $thumbPath = self::USER_COVER_DIR.'/thumbnails/'.$size.'/'.basename($path);
            // La miniature peut ne pas exister : fallback sur l'original
            // (mêmes URLs que cover_url : les uploads sont servis via /storage)
            if (file_exists(public_path($thumbPath))) {
                return asset($thumbPath);
            }

            return asset('storage/'.$path);
        }

        return $this->coverCatalogBaseUrl().'/thumbnails/'.$size.'/'.$this->catalogCoverWebpFilename($path);
    }

    /** Nom de fichier catalogue sans préfixe 'originals/' ni slash initial */
    protected function catalogCoverFilename(string $path): string
    {
        return ltrim(str_replace('originals/', '', $path), '/');
    }

    /** Nom de fichier miniature catalogue (extension convertie en .webp) */
    protected function catalogCoverWebpFilename(string $path): string
    {
        return preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $this->catalogCoverFilename($path));
    }

    protected function coverCatalogBaseUrl(): string
    {
        return rtrim(config('livrezone.book_covers_url') ?: url('/book-cover-proxy'), '/');
    }

    /**
     * Couverture de remplacement spécifique au modèle, avant le placeholder.
     *
     * @param  bool  $thumbnail  true : variante miniature demandée (Order délègue
     *                           à book->cover_thumbnail_url plutôt que cover_url)
     */
    protected function coverFallbackUrl(bool $thumbnail = false): ?string
    {
        $external = trim((string) ($this->cover_source_url ?? ''));

        return $external !== '' ? $external : null;
    }

    /**
     * Modération : true si la couverture ne doit pas être affichée
     * (contenu inadapté…) → le placeholder est renvoyé à la place.
     * Surchargé par Book (liste d'ISBN config('livrezone.blocked_cover_isbns')).
     */
    protected function coverModerationBlocked(): bool
    {
        return false;
    }

    protected function coverPlaceholderUrl(): string
    {
        return rtrim(config('livrezone.cover_placeholder_url') ?: asset('images/no-cover.svg'), '/');
    }
}
