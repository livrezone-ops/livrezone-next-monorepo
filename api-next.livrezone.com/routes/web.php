<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/book-cover-proxy/{path}', function (string $path) {
    $cleanPath = ltrim($path, '/');

    if (str_contains($cleanPath, '..')) {
        abort(404);
    }

    $publicRoot = config('filesystems.disks.book_covers_public.root');
    $baseRoot = basename($publicRoot) === 'originals' ? dirname($publicRoot) : $publicRoot;

    if (basename($publicRoot) === 'originals' && !str_starts_with($cleanPath, 'originals/') && !str_starts_with($cleanPath, 'thumbnails/')) {
        $cleanPath = 'originals/' . $cleanPath;
    }

    $fullPath = rtrim($baseRoot, '/') . '/' . $cleanPath;

    if (!file_exists($fullPath)) {
        $filename = basename($cleanPath);
        $folder = substr(pathinfo($filename, PATHINFO_FILENAME), -2);
        if (!is_numeric($folder)) {
            $folder = '00';
        }
        
        $dir = dirname($cleanPath);
        if (basename($dir) === (string)$folder) {
            $splitCleanPath = $cleanPath;
        } else {
            $splitCleanPath = ($dir === '.' ? '' : $dir . '/') . $folder . '/' . $filename;
        }
        $splitFullPath = rtrim($baseRoot, '/') . '/' . $splitCleanPath;
        
        $fullPath = $splitFullPath;
        $cleanPath = $splitCleanPath;
    }

    if (!file_exists($fullPath) && str_starts_with($cleanPath, 'thumbnails/')) {
        $parts = explode('/', $cleanPath, 3);
        if (count($parts) === 3) {
            $fallbackPath = rtrim($baseRoot, '/') . '/originals/' . $parts[2];
            
            if (file_exists($fallbackPath)) {
                $fullPath = $fallbackPath;
            } else {
                if (str_ends_with($fallbackPath, '.webp')) {
                    $baseNoExt = substr($fallbackPath, 0, -5);
                    foreach (['.jpg', '.jpeg', '.png'] as $ext) {
                        if (file_exists($baseNoExt . $ext)) {
                            $fullPath = $baseNoExt . $ext;
                            break;
                        }
                    }
                }
            }
        }
    }

    if (!file_exists($fullPath)) {
        abort(404);
    }

    return response()->file($fullPath, [
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->where('path', '.*')->name('covers.show');
