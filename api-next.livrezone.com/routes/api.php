<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Auth\SocialAuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ListingManagerController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\ReferenceDataController;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user()->load('profile');
});

Route::prefix('auth')->group(function () {
    Route::get('/redirect/{provider}', [SocialAuthController::class, 'redirect']);
    Route::get('/callback/{provider}', [SocialAuthController::class, 'callback'])
    ->middleware('web');
    Route::post('/logout', [SocialAuthController::class, 'logout'])->middleware('auth:sanctum');
});

Route::middleware('auth:sanctum')->prefix('dashboard')->group(function () {
    Route::get('/listings', [DashboardController::class, 'index']);
    Route::post('/listings/bulk-status', [DashboardController::class, 'bulkUpdateStatus']);
    Route::post('/listings/bulk-discount', [DashboardController::class, 'bulkApplyDiscount']);
    Route::get('/listings/{listing}', [ListingManagerController::class, 'show']);
    Route::post('/listings', [ListingManagerController::class, 'store']);
    Route::post('/listings/{listing}', [ListingManagerController::class, 'update']);
    Route::put('/listings/{listing}', [ListingManagerController::class, 'update']);
    Route::post('/listings/{listing}/inline-edit', [DashboardController::class, 'updateInline']);
    Route::post('/listings/{listing}/status', [DashboardController::class, 'updateStatus']);
    Route::post('/listings/{listing}/republish', [DashboardController::class, 'republish']);
});
Route::middleware('auth:sanctum')->prefix('profile')->group(function () {
    Route::get('/', [ProfileController::class, 'show']);
    Route::post('/', [ProfileController::class, 'update']);
});

// Public Listings Routes
Route::get('/listings', [\App\Http\Controllers\Api\ListingController::class, 'index']);
Route::get('/listings/{id}', [\App\Http\Controllers\Api\ListingController::class, 'show']);

// Public Books Catalogue Routes
Route::get('/books', [\App\Http\Controllers\Api\BookController::class, 'publicSearch']);

// Reference Data for Forms
Route::get('/reference-data', [ReferenceDataController::class, 'index']);
Route::get('/books/search', [BookController::class, 'searchByIsbn']);
