<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        'book_covers_originals' => [
            'driver' => 'local',
            'root' => env(
                'BOOK_COVERS_ORIGINAL_PATH',
                storage_path('app/private/book-covers')
            ),
            'visibility' => 'private',
            'throw' => true,
        ],

        'book_covers_public' => [
            'driver' => 'local',
            'root' => env(
                'BOOK_COVERS_PUBLIC_PATH',
                public_path('book-covers')
            ),
            'url' => env(
                'BOOK_COVERS_URL',
                rtrim(env('APP_URL', 'http://localhost'), '/').'/book-covers'
            ),
            'visibility' => 'public',
            'throw' => true,
        ],

        'book_covers_base' => [
            'driver' => 'local',
            'root' => env('BOOK_COVERS_PUBLIC_PATH') ? dirname(env('BOOK_COVERS_PUBLIC_PATH')) : public_path('book-covers'),
            'visibility' => 'public',
            'throw' => false,
        ],

        'book_covers_temp' => [
            'driver' => 'local',
            'root' => env(
                'BOOK_COVERS_TEMP_PATH',
                storage_path('app/private/book-covers-temp')
            ),
            'visibility' => 'private',
            'throw' => true,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
