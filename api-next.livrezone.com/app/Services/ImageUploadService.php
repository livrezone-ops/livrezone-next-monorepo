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
        $filename = 'covers/users/' . Str::random(20) . '.webp';
        
        $image = Image::read($file->getRealPath())
            ->scaleDown(width: 800)
            ->encode(new WebpEncoder(quality: 82));
            
        Storage::disk('public')->put($filename, (string) $image);
        
        return $filename;
    }
}
