<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\SocialAuthController;
use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HeroController;
use App\Http\Controllers\Api\LibraryController;
use App\Http\Controllers\Api\ListingController;
use App\Http\Controllers\Api\ListingManagerController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReferenceDataController;
use App\Http\Controllers\Api\TelegramWebhookController;
use App\Http\Controllers\Api\WishlistController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    $user = $request->user()->load('profile');
    $user->is_online = $user->isOnline();
    $user->unread_notifications_count = $user->notifications()->whereNull('read_at')->count();

    return $user;
});

// Webhook Telegram public (liaison via /start <token>)
Route::post('/telegram/webhook', [TelegramWebhookController::class, 'handle']);

Route::prefix('auth')->group(function () {
    Route::get('/redirect/{provider}', [SocialAuthController::class, 'redirect']);
    Route::get('/callback/{provider}', [SocialAuthController::class, 'callback'])
        ->middleware('web');

    // Auth classique (email + mot de passe)
    Route::post('/register', [AuthController::class, 'register']);
    // Throttle « auth » (cf. AppServiceProvider) : anti brute-force sur login,
    // anti énumération / bombing e-mail sur forgot-password.
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::post('/email/verification-notification', [AuthController::class, 'resendVerification']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:auth');
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
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
    Route::post('/password', [AuthController::class, 'updatePassword']);
    Route::get('/notifications', [ProfileController::class, 'getNotificationPreferences']);
    Route::post('/notifications', [ProfileController::class, 'updateNotificationPreferences']);
    Route::get('/telegram/link', [ProfileController::class, 'generateTelegramLink']);
    Route::post('/telegram/unlink', [ProfileController::class, 'unlinkTelegram']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/{id}/pin', [NotificationController::class, 'togglePin']);
    Route::post('/notifications/{id}/hide', [NotificationController::class, 'hide']);
});

Route::middleware('auth:sanctum')->prefix('orders')->group(function () {
    Route::get('/', [OrderController::class, 'index']);
    Route::post('/', [OrderController::class, 'store']);
    Route::get('/{order}', [OrderController::class, 'show']);
    Route::post('/{order}', [OrderController::class, 'update']);
    Route::put('/{order}', [OrderController::class, 'update']);
    Route::post('/{order}/cancel', [OrderController::class, 'cancel']);
});

Route::middleware('auth:sanctum')->prefix('payments')->group(function () {
    Route::get('/', [PaymentController::class, 'index']);
    Route::post('/preview', [PaymentController::class, 'preview']);
    Route::post('/', [PaymentController::class, 'store']);
    Route::post('/{payment}/simulate-confirm', [PaymentController::class, 'simulateConfirm']);
});

// Public Listings Routes
Route::get('/listings', [ListingController::class, 'index']);
Route::get('/listings/{id}', [ListingController::class, 'show']);
Route::get('/sitemap/listings', [ListingController::class, 'sitemap']);

// Public Demandes (Book Requests) Routes
Route::get('/demandes', [OrderController::class, 'publicDemandes']);

// Public Library (seller profile)
Route::get('/profiles/{nickname}', [ProfileController::class, 'publicLibrary']);
Route::get('/profiles/{nickname}/ratings', [ProfileController::class, 'ratings']);

// Public Libraries Directory
Route::get('/libraries', [LibraryController::class, 'publicLibraries']);

// Protected Ratings
Route::middleware('auth:sanctum')->post('/profiles/{nickname}/ratings', [ProfileController::class, 'storeRating']);

// Reference Data for Forms
Route::get('/reference-data', [ReferenceDataController::class, 'index']);

// Public Books Catalogue Routes
Route::middleware('throttle:catalogue')->group(function () {
    Route::get('/books', [BookController::class, 'publicSearch']);
    Route::get('/books/autocomplete', [BookController::class, 'autocomplete']);
    Route::get('/books/authors', [BookController::class, 'authors']);
    Route::get('/books/authors/{slug}', [BookController::class, 'authorShow']);
    Route::get('/books/search', [BookController::class, 'searchByIsbn']);
    Route::get('/books/{identifier}', [BookController::class, 'show']);
});

// Wishlist (Favorites) - Authenticated
Route::middleware('auth:sanctum')->prefix('wishlist')->group(function () {
    Route::get('/', [WishlistController::class, 'index']);
    Route::post('/', [WishlistController::class, 'store']);
    Route::delete('/', [WishlistController::class, 'destroy']);
    Route::post('/merge', [WishlistController::class, 'merge']);
});

// Cart - Authenticated
Route::middleware('auth:sanctum')->prefix('cart')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::post('/', [CartController::class, 'store']);
    Route::put('/', [CartController::class, 'update']);
    Route::delete('/', [CartController::class, 'destroy']);
    Route::post('/merge', [CartController::class, 'merge']);
});

// Public Hero messages (homepage)
Route::get('/hero-messages', [HeroController::class, 'index']);

// Admin - Users & Listings management
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/users', [AdminController::class, 'users']);
    // Fiche détaillée d'un utilisateur (déclarée avant les routes /users/{user}/...).
    Route::get('/users/{user}', [AdminController::class, 'showUser']);
    Route::post('/users/{user}/status', [AdminController::class, 'updateUserStatus']);
    Route::post('/users/{user}/subscription', [AdminController::class, 'updateUserSubscription']);
    Route::post('/users/{user}/subscription/pause', [AdminController::class, 'pauseSubscription']);
    Route::post('/users/{user}/subscription/resume', [AdminController::class, 'resumeSubscription']);

    Route::get('/listings', [AdminController::class, 'listings']);
    Route::post('/listings/bulk-status', [AdminController::class, 'bulkListingStatus']);
    // Édition admin d'une annonce : GET pour le formulaire, POST pour la
    // soumission (POST plutôt que PUT : le WAF OpenPanel bloque les méthodes
    // non standard). Déclarées après bulk-status pour que le segment statique
    // gagne sur le {listing} du même nombre de segments.
    Route::get('/listings/{listing}', [AdminController::class, 'showListing']);
    Route::post('/listings/{listing}', [AdminController::class, 'updateListing']);
    Route::post('/listings/{listing}/status', [AdminController::class, 'updateListingStatus']);

    Route::get('/orders', [AdminController::class, 'orders']);
    Route::post('/orders/{order}/status', [AdminController::class, 'updateOrderStatus']);

    Route::get('/payments', [AdminController::class, 'payments']);
    Route::post('/payments/{payment}/mark-paid', [AdminController::class, 'markPaymentPaid']);
    Route::get('/promo', [AdminController::class, 'promoState']);
    Route::post('/promo/toggle', [AdminController::class, 'togglePromo']);
    Route::get('/settings', [AdminController::class, 'settings']);
    // POST plutôt que PUT : le WAF OpenPanel bloque les méthodes non standard.
    Route::post('/settings', [AdminController::class, 'updateSettings']);
    Route::get('/discount-codes', [AdminController::class, 'discountCodes']);
    Route::post('/discount-codes', [AdminController::class, 'storeDiscountCode']);
    Route::put('/discount-codes/{discountCode}', [AdminController::class, 'updateDiscountCode']);
    // POST plutôt que DELETE : le WAF OpenPanel bloque la méthode DELETE.
    Route::post('/discount-codes/{discountCode}/delete', [AdminController::class, 'destroyDiscountCode']);

    Route::get('/hero-messages', [AdminController::class, 'hero']);
    Route::put('/hero-messages', [AdminController::class, 'storeHero']);
});
Route::middleware('auth:sanctum')->prefix('chat')->group(function () {
    Route::get('/threads', [ChatController::class, 'index']);
    Route::post('/threads', [ChatController::class, 'store']);
    Route::get('/threads/{thread}', [ChatController::class, 'show']);
    Route::post('/threads/{thread}/messages', [ChatController::class, 'sendMessage']);
    Route::post('/threads/{thread}/messages/{message}/update', [ChatController::class, 'updateMessage']);
    Route::post('/threads/{thread}/messages/{message}/delete', [ChatController::class, 'destroyMessage']);
    Route::post('/threads/{thread}/delete', [ChatController::class, 'destroy']);
    Route::post('/threads/{thread}/read', [ChatController::class, 'markRead']);
});
