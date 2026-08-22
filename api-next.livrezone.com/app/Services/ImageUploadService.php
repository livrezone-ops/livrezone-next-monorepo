<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\Laravel\Facades\Image;
use Illuminate\Http\UploadedFile;

class ImageUploadService
{
    /**
     * Traite et sauvegarde une image de couverture.
     *
     * @param UploadedFile $file
     * @return string Chemin relatif de l'image stockée
     */
    public function storeCover(UploadedFile $file): string
    {
        return $this->storeImage($file, 'covers/users', 800);
    }

    /**
     * Traite et sauvegarde une image dans un dossier spécifique avec des dimensions optionnelles.
     *
     * @param UploadedFile $file
     * @param string $folder Le dossier de destination (ex: 'profiles/logos')
     * @param int|null $width Largeur de l'image (optionnel)
     * @param int|null $height Hauteur de l'image (optionnel)
     * @param int $quality Qualité WebP
     * @return string Chemin relatif de l'image stockée
     */
    public function storeImage(UploadedFile $file, string $folder, ?int $width = null, ?int $height = null, int $quality = 82): string
    {
        $filename = $folder . '/' . Str::random(20) . '.webp';
        
        $image = Image::decode($file->getRealPath());

        if ($width && $height) {
            $image->cover($width, $height);
        } elseif ($width) {
            $image->scaleDown(width: $width);
        } elseif ($height) {
            $image->scaleDown(height: $height);
        }

        $encoded = $image->encode(new WebpEncoder(quality: $quality));
            
        Storage::disk('public')->put($filename, (string) $encoded);
        
        return $filename;
    }
}
