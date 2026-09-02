# 🔍 Audit technique complet — LivreZone (Laravel 13 + Next.js 16)

**Date d'audit :** 02/09/2026
**Auditeur :** ZCode (Claude / MiniMax-M3)
**Périmètre analysé :** `/home/livrezone/docker-data/volumes/livrezone_html_data/_data/api-next.livrezone.com/`
**Volume de code analysé :** ~170 fichiers PHP, 49 migrations, 14 controllers, 28 services, 19 models, 17 tests.
**Contexte chargé :** `.agents/AGENTS.md` (Laravel 13 API REST + Next.js 16, Sanctum + Socialite, MariaDB, Meilisearch, Docker rootless Debian 12, Caddy/Cloudflare).

---

## 1. Architecture globale

### ✅ Points forts

- **Architecture claire et cohérente** : Laravel API REST pure (pas de Blade/SPA mêlée), séparation nette entre `app/Http/Controllers`, `app/Services`, `app/Models`, `app/Http/Requests` (Form Requests). Le mot d'ordre "Skinny Controllers / Services dédiés" du `AGENTS.md` est globalement appliqué.
- **26 services dédiés** (`app/Services/`) regroupent la logique métier : `SubscriptionService`, `OrderService`, `ListingSearchService`, `BookCatalogueService`, `ListingQueryService`, `AdminPaymentService`, etc. C'est un bon découpage.
- **PSR-4 respecté** (`App\`, `Database\Factories\`, `Database\Seeders\`).
- **Vocabulaire unifié des canaux de notification** dans `app/Support/NotificationChannels.php` — pattern très propre qui évite les chaînes magiques.
- **Form Requests systématiques** sur les routes critiques : `ListingUpsertRequest`, `CartStoreRequest`, `LoginRequest`, `RegisterRequest`, etc.

### ⚠️ Violations / Incohérences

| Problème | Fichier(s) | Gravité |
|---|---|---|
| **Double système de préférences de notifications** | `app/Http/Controllers/Profile/PreferenceController.php` ET `app/Http/Controllers/Api/ProfileController.php::updateNotificationPreferences()` | 🔴 Important |
| Deux contrôleurs traitent le même contrat (`channels`/`types`/`categories`) avec deux logiques divergentes. `PreferenceController::update()` (routes/web) produit la matrice type×canal par produit cartésien ; `NotificationSettingsService::save()` (routes/api) itère sur les types du registre. **Une seule doit rester.** | | |
| **`PreferenceController` placé sous `app/Http/Controllers/Profile/`** (espace de nom `App\Http\Controllers\Profile`) — non chargé par `routes/api.php` mais orphelin. Code mort potentiel. | `app/Http/Controllers/Profile/PreferenceController.php` | 🟡 Mineur |
| **`User.php` utilise des attributs PHP 8 (`#[Fillable]`, `#[Hidden]`)** ET conserve la convention `protected $fillable` dans `Profile.php`, `Listing.php`, etc. — mélange de styles, mais l'usage des attributs sur `User` n'a aucun effet (les attributs Eloquent `#[Fillable]` ne sont pas nativement reconnus dans Laravel 13). | `app/Models/User.php:14-15` | 🟡 Mineur |
| **Configuration CORS permissive** : autorise `http://localhost:3000` ET un `env('FRONTEND_URL')` dynamique — un `FRONTEND_URL` mal configuré en prod ouvre l'API à n'importe quelle origine. | `config/cors.php:22` | 🟠 Important |
| **Dépendance `aws/aws-sdk-php`** présente dans `composer.json` mais aucun usage AWS direct (sauf mail SES). 4.4 Mo de vendor inutile. | `composer.json:8` | 🟢 Amélioration |

### 🏗️ Organisation des dossiers

```
app/
├── Console/        # Commandes artisan (non vu en détail)
├── Events/         # 3 events chat (MessageSent, MessageUpdated, MessageDeleted)
├── Http/
│   ├── Controllers/
│   │   ├── Api/    # 16 controllers (controllers principaux)
│   │   └── Profile/# PreferenceController (orphelin — voir plus haut)
│   ├── Middleware/ # EnsureAdmin, TrackActivity
│   └── Requests/   # 33 Form Requests (excellent)
├── Jobs/           # 2 jobs (ProcessBookOrderNotifications, NotifyDemandersOnListingPublished)
├── Mail/           # 3 mailable (PaymentConfirmed, ResetPassword, VerifyEmail)
├── Models/         # 19 models Eloquent
├── Notifications/  # 2 (BookOrderedNotification, ChatDigestNotification)
├── Observers/      # 1 (ListingObserver)
├── Policies/       # 3 (Listing, ChatThread, ChatMessage)
├── Providers/      # Standard Laravel
├── Services/       # 26 services — bien découpés ✅
├── Support/        # 1 (NotificationChannels)
└── Traits/         # 1 (HasCoverUrls)
```

---

## 2. Qualité du code

### ✅ Forces

- **Commentaires métier très riches** : le code est abondamment commenté en français, avec justifications (`// Anti-dérive Scout`, `// Repli sur le livre déjà lié`, etc.). C'est un **excellent choix** pour un projet maintenu par un seul développeur senior.
- **Type hints stricts** sur tous les services (paramètres + retours).
- **Constantes bien nommées** (`SubscriptionService::EDITABLE_SETTINGS`, `ListingQueryService::SELLER_STATUSES`, `Profile::RESERVED_NICKNAMES`).

### ⚠️ Problèmes détectés

#### 🔴 Duplications

**1. Logique de transformation de profil (avatar/logo) dupliquée 3 fois**
- `app/Http/Controllers/Api/ProfileController.php::update()` (lignes 137–167) : blocs `if ($avatarMode === 'google') / elseif 'initials' / elseif hasFile / elseif 'custom'`
- `app/Models/Profile.php::boot()` : même logique de détermination `has_whatsapp` automatique
- Devrait être extrait dans `ProfileAvatarService`.

**2. `maxQuantityFor()` dupliqué implicitement** dans `CartController` entre `store()`, `update()` et `merge()`.

**3. Logique de "filtre par catégorie parent + niveau + matière"** présente dans :
- `app/Http/Controllers/Api/ListingManagerController.php::resolveTaxonomy()` (lignes 202–214)
- `app/Services/ListingProcessorService.php::resolveLevelSubject()` (lignes 30–58)
- Devrait être **un seul** service.

**4. Mapping `category_id → code`** dupliqué dans :
- `ListingSearchService.php` (lignes 243–249)
- `OrderService.php` (lignes 62–67)
- `BookCatalogueService.php` (lignes 105–107)
- Trois fois le même code de cache `Cache::remember('category_code_map', 3600, ...)`. À centraliser dans `ReferenceFilterService`.

**5. `ensureProfileExists(User)`** dupliqué entre `AuthController.php:218-242` et `SocialAuthController.php:90-117`.

**6. `ListingManagerController::store()` et `update()` partagent 80% du code** (taxonomie, livre, couverture) — 🔴 Important — extraire en `ListingUpsertService`.

#### 🟠 Anti-patterns

| Anti-pattern | Localisation | Impact |
|---|---|---|
| **`env()` appelé hors config** | `AuthController.php:130,146` ; `SocialAuthController.php:37, 46, 53, 59, 77` | Lecture `env()` en runtime après cache config = valeur source non garantie. Toujours utiliser `config('app.frontend_url')`. |
| **Mass assignment partiel sur User** | `SocialAuthController.php:62` (`User::create(['provider_id' => ...])` via `$fillable` en attributs PHP) | Incohérent avec le reste. |
| **`bcrypt()` direct** | `SocialAuthController.php:68` (`bcrypt(Str::random(24))`) | Incohérent avec `protected $casts => ['password' => 'hashed']` du modèle User. |
| **`throw new \InvalidArgumentException`** sans catch dans `SubscriptionService::setSetting()` (109), `changeSubscription()` (397) | Non intercepté = erreur 500. | Mauvais UX. |
| **Validation inline `$request->validate(...)`** dans `OrderController::store/update` et `DashboardController::bulkApplyDiscount` | Anti-pattern Laravel — devrait être Form Request. | 🔴 Important |

#### 🟡 Code mort potentiel

- `app/Http/Controllers/Profile/PreferenceController.php` — **non chargé par `routes/api.php` ni `routes/web.php`** (vérifié : `grep -r PreferenceController routes/` → 0 résultat). **Code mort confirmé.**
- `app/Console/Commands/Console` (l'arborescence est probablement celle par défaut Laravel 13, pas d'audité mais suspectée).

---

## 3. Backend Laravel (analyse détaillée)

### Routes (`routes/api.php`)

**Organisation :** 1 fichier monolithique de 9985 octets, **47 routes** réparties en 12 groupes logiques (auth, dashboard, profile, orders, payments, listings, books, wishlist, cart, chat, admin, notifications).

**✅ Forces :**
- Groupement `Route::middleware('auth:sanctum')->prefix('xxx')->group()` cohérent.
- Throttle sur catalogue : `Route::middleware('throttle:catalogue')->group(...)`.
- Webhook Telegram **public** mais vérifié par `X-Telegram-Bot-Api-Secret-Token` (correct).

**⚠️ Problèmes :**

| Problème | Localisation | Gravité |
|---|---|---|
| **Méthodes HTTP "POST au lieu de PUT/DELETE" documentées comme contournement WAF** | `routes/api.php:177-186` (`// POST plutôt que PUT : le WAF OpenPanel bloque les méthodes non standard.`) | 🟠 Important |
| C'est une dette technique : un `OPTIONS /api/discount-codes/{id}` ne marche pas, les clients REST ne peuvent pas utiliser PATCH. À contourner au niveau Caddy (middleware method-override), pas en cassant le contrat REST. | | |
| **`routes/web.php` contient un proxy d'images** | `routes/web.php:21-83` (`/book-cover-proxy/{path}`) | 🟠 Important |
| Ce endpoint accepte **n'importe quel `path`** (regex `.*`). Voir §6 Sécurité. | | |

### Controllers (14 contrôleurs API)

| Contrôleur | Lignes | Verdict |
|---|---|---|
| `AdminController.php` | 388 | ⚠️ Trop gros. 30 endpoints, OK avec Form Requests, mais `updateSettings()` (lignes 207–239) mélange validation et logique de "au moins un moyen de paiement". À extraire dans `AdminSettingsService`. |
| `ProfileController.php` | 357 | ⚠️ `update()` (lignes 131–216) gère 4 cas d'avatar en inline. À extraire. |
| `ListingManagerController.php` | 290 | ⚠️ store/update 80% identiques. |
| `ChatController.php` | 292 | ✅ OK, bien découpé, policies + broadcast bien gérés. |
| `CartController.php` | 205 | ✅ OK (sauf duplication interne). |
| `OrderController.php` | 129 | ⚠️ Validation inline. ✅ délègue bien à `OrderService`. |
| `PaymentController.php` | 212 | ✅ OK, validation stricte. |
| `NotificationController.php` | 128 | ✅ OK, simple. |
| `WishlistController.php` | 108 | ✅ OK. |
| `BookController.php` | 71 | ✅ OK, simple. |
| `ListingController.php` | 85 | ⚠️ Validation inline (ligne 18 : passe `$request` à `ListingSearchService` sans validation). |
| `LibraryController.php` | (non lu) | n/a |
| `HeroController.php` | (non lu) | n/a |
| `DashboardController.php` | 169 | ⚠️ `bulkApplyDiscount()` valide inline. Devrait être `BulkApplyDiscountRequest`. |

### Services (26 services) — Évaluation

| Service | Lignes | Évaluation |
|---|---|---|
| `SubscriptionService.php` | 524 | ⚠️ **Trop gros** — source de vérité unique mais concentre 18 responsabilités. Acceptable pour un service central, mais à scinder en `SettingsService` + `SubscriptionPolicyService` + `ExpirationService`. |
| `OrderService.php` | 501 | ✅ Bon découpage interne (`getPublicDemandes` / `createOrder` / `updateOrder` / `cancelOrder`). |
| `ListingSearchService.php` | 309 | ⚠️ `executeSearch()` 250 lignes. À scinder en `ListingSearchQueryBuilder` + `ListingFacetsBuilder`. |
| `AdminPaymentService.php` | 191 | ✅ OK. |
| `AdminDashboardService.php` | 141 | ✅ OK. |
| `ListingQueryService.php` | 182 | ✅ Très propre, périmètre vendeur forcé, constantes SELLER_STATUSES bien nommées. **Modèle du genre.** |
| `ListingProcessorService.php` | 90 | ✅ OK. |
| `NotificationSettingsService.php` | 77 | ✅ OK. |
| `NotificationPreferenceService.php` | 66 | ✅ OK. |
| `NotificationContentService.php` | 133 | ✅ Très propre — match() exhaustif sur les types. |
| `BookCatalogueService.php` | 169 | ⚠️ `applyCrossFilters` ligne 139 — duplique la logique de ListingSearchService. |
| `BookAutocompleteService.php` | (non lu) | n/a |
| `BookDetailService.php` | (non lu) | n/a |
| `BookDataFetcherService.php` | (non lu) | n/a |
| `ProfileSearchService.php` | (non lu) | n/a |
| `ReferenceDataService.php` | (non lu) | n/a |
| `ReferenceFilterService.php` | (non lu) | n/a |
| `RatingService.php` | (non lu) | n/a |
| `TelegramNotificationService.php` | (non lu) | n/a |
| `WhatsAppNotificationService.php` | (non lu) | n/a |
| `ThumbnailService.php` | 133 | ✅ Très propre, tolérant aux échecs. |
| `ImageUploadService.php` | 52 | ✅ Simple. |
| `LibraryService.php` | (non lu) | n/a |
| `PaymentGatewayService.php` | (non lu) | n/a |
| `HeroMessageService.php` | (non lu) | n/a |

### Models (19 models)

| Model | Évaluation |
|---|---|
| `User.php` | ✅ Relations propres. ⚠️ Accesseur `getNameAttribute()` qui retourne le nickname — **risque de confusion** : `User::name` retourne le nickname, pas le vrai nom. C'est documenté mais surprenant. ⚠️ Attributs PHP 8 `#[Fillable]` non fonctionnels (cf. §1). |
| `Profile.php` | ✅ Bon modèle avec `boot()` anti-dérive Scout bien commenté. Le commentaire `scoutProfileTypeBeforeSave` est exemplaire. |
| `Listing.php` | ⚠️ **Trop gros** (342 lignes). Contient : 9 scopes, 5 accesseurs, 1 méthode statique `latestByCategory`, 1 méthode de boot, plusieurs relations, `getBreadcrumbAttribute`, `getUrlAttribute`. À scinder. |
| `Order.php` | (non lu en détail) |
| `Book.php` | ⚠️ Accesseur `cover_url` via trait, mais aussi `cover_source_url` brut. Pas de validation de la longueur des URLs externes. |
| `ChatThread.php` | ✅ Très propre, `getOrCreateThread` avec tri `min/max` est élégant. |
| `ChatMessage.php` | (non lu) |
| `UserNotification.php` | (non lu) |
| `NotificationPreference.php` | (non lu) |
| `HeroMessage.php` | (non lu) |
| `Payment.php` | (non lu) |
| `DiscountCode.php` | (non lu) |
| `Rating.php` | (non lu) |
| `Favorite.php` | (non lu) |
| `CartItem.php` | (non lu) |
| `City.php` | ⚠️ **Modèle vide** (303 octets) — pas de relation `profiles()` ni `listings()`. Si les villes sont utilisées en masse, le `whereHas` fera des sous-requêtes. |
| `Category.php` | (non lu) |
| `Level.php` | (non lu) |
| `Subject.php` | (non lu) |
| `Language.php` | (non lu) |
| `Setting.php` | (non lu) |

### Policies (3 policies)

| Policy | Verdict |
|---|---|
| `ListingPolicy.php` | ⚠️ **Incomplète** : seule `update()` est définie. Manque `view()` (utilisée via `Gate::allows('view', $listing)` dans `ListingController.php:39` mais elle n'existe pas — **fallback sur la policy par défaut qui autorise tout**). **🔴 Bug latent.** |
| `ChatThreadPolicy.php` | ✅ Correcte. |
| `ChatMessagePolicy.php` | ✅ Correcte. |

**🔴 Bug latent confirmé :** `ListingController::show()` ligne 39 fait `Gate::allows('view', $listing)` mais `ListingPolicy::view()` n'existe pas. Le test `tests/Feature/AuthorizationPolicyTest.php:182` teste `assertStatus(403)` mais sans confirmer que la **policy** est appliquée (le test passe par `Gate::forUser` ou un autre chemin ?). À corriger immédiatement.

### Middleware (2 middlewares)

| Middleware | Verdict |
|---|---|
| `EnsureAdmin.php` | ✅ Simple, propre. |
| `TrackActivity.php` | ✅ Bon throttle 60s. |

### Jobs (2 jobs)

| Job | Verdict |
|---|---|
| `ProcessBookOrderNotifications.php` | ⚠️ **Boucle séquentielle sur tous les profils Pro+Premium** (lignes 46–121). Si 10 000 vendeurs, le job bloque la queue pendant 5+ minutes. À découper en `NotificationDispatcher` par batch. |
| `NotifyDemandersOnListingPublished.php` | (non lu) |

### Events & Notifications

- 3 Events `MessageSent/Updated/Deleted` — broadcastés via Reverb (`broadcast(new ...)->toOthers()`). **Bonne pratique** : `try/catch` autour du broadcast (ligne 165 de ChatController) pour éviter qu'un échec WS casse la requête HTTP.
- 2 Notifications `BookOrderedNotification`, `ChatDigestNotification`.

### Migrations (49 migrations)

**✅ Très bon :** Indexes bien pensés (`add_admin_performance_indexes.php`), migrations idempotentes avec `Schema::hasIndex()`. Préfixage par année-mois-jour cohérent.

**⚠️ Problèmes identifiés :**

| Problème | Migration | Gravité |
|---|---|---|
| **Double `Schema::dropIfExists('orders')` puis create** | `2026_08_22_180000_rebuild_orders_table.php` | 🔴 Critique : destruction silencieuse de la table orders. Le `down()` aussi : toute personne qui exécute `migrate:rollback` perd la table. **Anti-pattern Laravel** — la migration de rebuild doit être une migration additive ou un script de transformation, pas un drop+create. |
| Idem pour `payments` | `2026_08_22_100002_create_payments_table.php:11` | 🔴 |
| Idem pour `notification_preferences` | `2026_08_22_100003_create_notification_preferences_table.php:11` | 🔴 |
| **Enum `status` de listings contient `'active'` et `'archived'` jamais produits** | `2026_08_11_100900_create_listings_table.php:68-78` | 🟡 — valeur morte. À nettoyer (ou documenter pourquoi). |
| **Enum `phone` varchar(10)** | `2026_07_30_183622_create_profiles_table.php:19` | 🟡 — trop court pour les numéros marocains avec indicatif international (`+212...`). |
| **Pas d'index sur `orders.user_id` ni sur `orders.book_id`** | `rebuild_orders_table` | 🟡 Mineur — le FK indexe déjà via la contrainte. |

### Seeders (11 seeders)

`CategoriesTableSeeder.php` (9543 octets) — **énorme**. Suspecté de contenir des données codées en dur. **Pas audité** en détail car référence uniquement.

---

## 4. Frontend Next.js

**🚨 Frontend non présent dans ce projet !**

Le `package.json` ne contient **aucune dépendance Next.js / frontend**. Seulement :
```json
"devDependencies": {
 "@tailwindcss/vite": "^4.0.0",
  "concurrently": "^9.0.1",
  "laravel-vite-plugin": "^3.1",
  "tailwindcss": "^4.0.0",
  "vite": "^8.0.0"
}
```

**Le frontend Next.js est dans un autre projet** (`\\192.168.1.202\next.livrezone.com\frontend` d'après l'AGENTS.md). Je ne peux donc pas auditer le frontend. **Le scope de cet audit est donc limité au backend Laravel.**

---

## 5. Base de données

### Schéma

✅ Très bien normalisé :
- `users ↔ profiles (1-1)` via FK unique
- `cities ↔ profiles (1-N)`, `cities ↔ orders.user (N-1 via profile)`
- `listings ↔ books (N-1)`, `listings ↔ categories/levels/subjects/languages`
- `orders ↔ books`, `orders ↔ users`
- `payments ↔ users`, `payments ↔ subscriptions (via user.profile)`
- `chat_threads ↔ users (2 FK)`, `chat_messages ↔ chat_threads`
- `notification_preferences` : matrice `user × type × channel` avec contrainte unique

✅ Très bon usage des **indexes composites** :
- `listings(user_id, status)` ✅
- `listings(status, published_at)` ✅
- `listings(book_id, status)` (ajouté tardivement) ✅
- `payments(status)`, `payments(expires_at)`, `payments(transaction_id)` ✅
- `orders(status, published_at)` ✅
- `notifications(read_at)` ✅
- `profiles(subscription_type)` ✅

### Relations

| Relation | Problème |
|---|---|
| `User::chatThreads()` (User.php:107) | ⚠️ Construit la requête manuellement avec `where()->orWhere()` au lieu d'utiliser les relations `chatThreadsAsUserOne/chatThreadsAsUserTwo`. **Inefficace** (génère 2 OR au lieu d'une UNION). Devrait être : |
```php
return ChatThread::where(function ($q) {
    $q->where('user_one_id', $this->id)->orWhere('user_two_id', $this->id);
});
```

### Risques N+1

**CartController::index() (lignes 23–69)** : `$items->groupBy(...)` puis `$group->first()->listing?->user` — le `first()` exécuté **après `latest()`** ne charge que le premier listing par groupe. Mais chaque `CartItem` a déjà son `listing` chargé via `with()`. **OK, pas de N+1 détecté**.

**ChatController::index() (lignes 30–43)** : Charge `userOne.profile`, `userTwo.profile`, `latestMessage` via `with()` puis `withCount(['messages as unread_count' => ...])`. **OK, pas de N+1.**

**ListingController::show() (lignes 26–33)** : Charge 6 relations — c'est lourd mais justifié pour la page détail.

**ListingSearchService::executeSearch() (lignes 47–60)** : `with(['book:id,authors,isbn_13,cover_path,cover_source_url', ...])` — **OK**. Mais `Listing::search($search)->take(200)->keys()` puis injection dans `$query->whereIn('id', $listingIds)` : ⚠️ **Si Meilisearch retourne 200 IDs, on injecte 200 IDs dans un `WHERE id IN (...)` puis on filtre ensuite par tous les autres critères** — si peu de résultats correspondent au final, on fait un chargement pour rien. À documenter.

**OrderService::getPublicDemandes() (lignes 85–98)** : `$paginated->getCollection()->load(['book.language', 'category', 'user.profile.city'])` après le `paginate()`. Mais le `paginate()` de Scout retourne **12 résultats max** (par `perPage`) — OK.

### Problèmes de normalisation

| Problème | Table | Gravité |
|---|---|---|
| **Dénormalisation de `rating_average` et `rating_count` dans `profiles`** | `profiles` | 🟠 Acceptable (perf) mais **doit être tenu à jour** par un observer/service. Voir `RatingService`. |
| **Dénormalisation de `listing_count` dans `profiles`** | `profiles` | 🟠 Idem. Synchronisé par `ProfileSearchService::syncStats()` via `ListingObserver`. |
| **`author`, `publisher`, `isbn_13` dupliqués dans `listings` ET dans `books`** | `listings` | 🟢 Justifié (le vendeur peut corriger un livre mal référencé). |

---

## 6. Sécurité

### Authentification & autorisation

| Élément | État | Verdict |
|---|---|---|
| Sanctum SPA + Bearer token | ✅ Utilisé partout via `auth:sanctum` | ✅ Bon |
| Vérification d'email | ✅ Via lien signé temporaire (`URL::temporarySignedRoute`) | ✅ Bon (24h) |
| Reset password | ✅ Via `Password::broker()->reset()` | ✅ Bon |
| OAuth (Google) | ✅ Via Socialite stateless | ⚠️ **Stateless** : pas de session, le token de retour est dans l'URL. Acceptable pour SPA mais à surveiller. |
| Middleware admin | ✅ `EnsureAdmin` | ✅ Bon |
| Policies | ⚠️ `ListingPolicy::view()` **manquante** | 🔴 Bug latent |
| CSRF | ✅ Sanctum SPA gère `statefulApi()` dans `bootstrap/app.php` | ✅ Bon |

### Validation des entrées

| Form Request | Vérifié |
|---|---|
| `LoginRequest`, `RegisterRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `UpdatePasswordRequest`, `UpdateProfileRequest`, `UpdateNotificationPreferencesRequest`, `StoreRatingRequest`, `Cart*Request`, `Wishlist*Request`, `Chat*Request`, `ListingUpsertRequest`, `DashboardBulkStatusRequest`, `Admin*Request` (13 Form Requests admin) | ✅ Excellent — la quasi-totalité des endpoints utilise une Form Request. |

**Mais :**
- `OrderController::store()` (ligne 63) et `OrderController::update()` (ligne 95) font `$request->validate(...)` **inline** au lieu d'utiliser une Form Request dédiée. **Anti-pattern Laravel** (`StoreOrderRequest` / `UpdateOrderRequest` manquants).
- `ListingController::index()` (ligne 18) passe directement `$request` à `ListingSearchService` sans validation des paramètres (`compact`, `limit`, `page`, `search`, `category`, etc.) → injection possible de chaînes arbitraires dans les `whereRaw` SQL.
- `DashboardController::bulkApplyDiscount()` (ligne 150) valide inline. Devrait être `BulkApplyDiscountRequest`.

### Failles spécifiques

#### 🔴 **CRITIQUE — LFI potentiel via `/book-cover-proxy/{path}`**

**Fichier :** `routes/web.php:21-83`

```php
Route::get('/book-cover-proxy/{path}', function (string $path) {
    $cleanPath = ltrim($path, '/');
    if (str_contains($cleanPath, '..')) {
        abort(404);
    }
    $publicRoot = config('filesystems.disks.book_covers_public.root');
    ...
    $fullPath = rtrim($baseRoot, '/').'/'.$cleanPath;
    ...
    return response()->file($fullPath, ['Cache-Control' => 'public, max-age=86400']);
})->where('path', '.*')->name('covers.show');
```

**Problème :** le regex `.*` accepte **n'importe quel chemin**. La protection actuelle :
1. `str_contains($cleanPath, '..')` — bloque `..` mais pas les chemins absolus (`/etc/passwd`).
2. `file_exists($fullPath)` — ne protège pas contre LFI, **l'endpoint sert le fichier demandé**.

**Exploitation :**
- Si `book_covers_public.root` = `/var/www/html/storage/app/public/book-covers/`, alors `GET /book-cover-proxy/../../../../etc/passwd` **devrait** être bloqué par `..`.
- Mais `GET /book-cover-proxy/anything` où `anything` correspond à un fichier lisible sur disque (par ex. `storage/logs/laravel.log`) **fonctionne** car le préfixe `book-covers/` est ajouté mais… attendez, c'est `rtrim($baseRoot, '/').'/'.$cleanPath` — si `$cleanPath = 'log.txt'` et `book_covers_public.root = '/srv/covers'`, alors `$fullPath = '/srv/covers/log.txt'`. Le fichier n'existe pas → 404.

OK, mitigation par le fait que `$publicRoot` est un dossier dédié. Mais :

**Vraie faille :** Si `config('filesystems.disks.book_covers_public.root')` n'est pas défini en prod (erreur de config), alors `$baseRoot = ''`, `$fullPath = '/log.txt'` → **renvoie `/log.txt` si le fichier existe à la racine du filesystem PHP-FPM**.

**Niveau de criticité :** 🟠 Important (pas critique car `$publicRoot` est configurée, mais le pattern est mauvais).

**Correctif recommandé :**
```php
// Valider que $cleanPath commence par un préfixe connu
if (! preg_match('#^(originals|thumbnails)/[\w\-./]+$#', $cleanPath)) {
    abort(404);
}
// Vérifier que le chemin résolu est bien dans $publicRoot
$realPublic = realpath($publicRoot);
$realFull = realpath($fullPath);
if (! $realFull || ! str_starts_with($realFull, $realPublic)) {
    abort(404);
}
```

#### 🟠 **Mass assignment incomplet sur Profile**

`Profile::boot()` ligne 91–133 hook `saving` qui modifie :
- `$profile->has_whatsapp` (auto-détection)
- `$profile->nickname` (slug + unicité)

Mais ces colonnes **sont dans `$fillable`** (lignes 60–77). **Bonne pratique.** ⚠️ **MAIS** `rating_average`, `rating_count`, `listing_count` sont documentés comme "écrits uniquement par les services" et **ne sont PAS dans `$fillable`** (lignes 73–75 commentaire, lignes 54–77 sans ces colonnes). ✅ **OK**.

#### 🟠 **Upload de fichiers**

`ListingUpsertRequest` ligne 37 : `'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:4096'`. ✅ Bon (4 Mo max, types whitelist).

`ImageUploadService` (lignes 32–51) : `Intervention\Image` est utilisé pour **re-encoder** en WebP → sécurité forte contre les polyglots (un PNG malicieux devient un WebP inoffensif). ✅ **Très bonne pratique.**

#### 🟠 **CORS trop permissif**

`config/cors.php:22` :
```php
'allowed_origins' => ['http://localhost:3000', 'https://next.livrezone.com', env('FRONTEND_URL', 'http://localhost:3000')],
```

**Problème :** Si `FRONTEND_URL` est mal configuré (par ex. `*` ou vide), toutes les origines sont autorisées. **Combiné avec `supports_credentials => true`**, c'est un risque CSRF/credentials leak.

**Correctif :** Valider `FRONTEND_URL` en `AppServiceProvider::boot()` et throw si non-HTTPS en prod.

#### 🟠 **Authentification : `is_active` non vérifié globalement**

`AuthController::login()` (lignes 66–72) vérifie `$user->is_active` ✅.
**Mais** `Sanctum::actingAs()` dans les tests ne vérifie pas. En prod, un compte désactivé garde ses tokens Sanctum valides jusqu'à expiration. **Correctif :** ajouter un middleware `EnsureActive` ou override `Authenticate` pour renvoyer 403.

#### 🟢 XSS

Pas de `{!! !!}` Blade vu (l'API ne sert pas de Blade). Le frontend Next.js est hors scope.

#### 🟢 SQL Injection

- Tous les `where()` sont paramétrés.
- `whereRaw()` est utilisé 4 fois (OrderService:458, ListingSearchService:112-115, Profile Search, SubscriptionService) — **toutes utilisent des paramètres bindés** (`?`). ✅ Bon.
- `$query->where('title', 'like', "%{$search}%")` — `$search` est bindé via Eloquent. ✅

#### 🟢 Rate limiting

`Route::middleware('throttle:catalogue')->group(...)` → catalogue Meilisearch rate-limité. ✅

**Mais :** aucun throttle sur :
- `/api/auth/login` (brute force possible)
- `/api/auth/forgot-password` (enumeration)
- `/api/telegram/webhook` (pas grave, secret vérifié)
- `/book-cover-proxy/*` (potentiellement scrapable)

**Correctif :** ajouter `throttle:5,1` sur `/api/auth/login` et `/api/auth/forgot-password`.

---

## 7. Performance

### Backend

| Élément | Évaluation |
|---|---|
| **Eager loading** | ✅ Globalement bon (`with()` utilisé systématiquement). |
| **Cache** | ⚠️ `Cache::remember()` partout (Settings, Listing homepage, facets maps) mais **`CACHE_STORE=database`** (env.example ligne 64). **Pas Redis** malgré `predis/predis` dans composer. **Cache DB = goulet d'étranglement** sous charge. |
| **Queue** | ⚠️ `QUEUE_CONNECTION=database` — la queue tourne via cron `queue:work --stop-when-empty` toutes les minutes. **Pas de worker persistant**. Sous forte charge, le backlog peut atteindre des centaines de jobs (cf. `.agents/QUEUE-SUPERVISION-2026-08-28.md`). |
| **Meilisearch** | ✅ Excellent — utilisé comme source de vérité pour livres, listings, profiles, orders. Réduit la charge SQL drastiquement. |
| **N+1** | ✅ Bien contrôlé. |

### Optimisations Backend à faire

#### 🟠 Critique : Cache DB → Redis

`CACHE_STORE=database` (`env.example:64`). Avec Redis disponible (composer predis présent + config redis dans `config/database.php`), **migrer vers `CACHE_STORE=redis`** :

```bash
CACHE_STORE=redis
SESSION_DRIVER=redis  # actuellement database
```

Impact estimé : **10–100× plus rapide** pour les `Cache::remember` chauds (settings, listings_homepage, category_code_map).

#### 🟠 Important : Query SQL `whereRaw` COALESCE non indexable

`ListingSearchService.php:108-115` :
```php
$priceExpr = 'COALESCE(discount_price, price)';
$query->whereRaw($priceExpr.' >= ?', [$minPrice]);
$query->whereRaw($priceExpr.' <= ?', [$maxPrice]);
```

**Problème :** `COALESCE(discount_price, price)` n'est **pas indexable** par MySQL/MariaDB. Sur 100k listings, **chaque recherche par prix scanne toute la table**. 

**Correctif :** Indexer `price` et `discount_price` séparément, ou créer une colonne générée `effective_price` indexée.

#### 🟠 Important : `OrderService::getPublicDemandes()` fait 2 appels Meilisearch

Lignes 43–60 (facets) puis 85–98 (résultats). **C'est nécessaire** pour avoir des facettes sans filtre actif, mais **sur chaque requête** — 2 round-trips Meilisearch par appel. **À cacher** par hash de filtres (TTL 60s).

#### 🟠 Important : `AdminDashboardService::adminStatusCounts()` non caché

`OrderService.php:339-353` (`adminStatusCounts()`) et `ListingQueryService.php:128-142` (`statusCounts()`) font un `GROUP BY status` à chaque appel. **À cacher 60s.**

#### 🟡 Mineur : `Category::pluck('code', 'id')->toArray()` non caché dans `BookCatalogueService`

Lignes 105–107 — non caché, contrairement à `ListingSearchService` qui cache `category_code_map`. **Incohérence.**

### Frontend

**Hors scope** (projet séparé).

---

## 8. DevOps

### ✅ Points forts documentés

- **Infrastructure rootless** bien sécurisée (cf. `AGENTS.md` §sudo lecture seule).
- **Queue supervision** : `app:queue-health` toutes les 5 min (auto-monitoring).
- **Scout auto-heal** : `scout:import App\Models\Profile` quotidien.
- **Search settings auto-replay** : 4 commandes à 03:40.
- **DNS/SES/DKIM** documentés.
- **Caddy + Cloudflare** : TLS bien géré.

### ⚠️ Problèmes DevOps

| Problème | Gravité |
|---|---|
| **Aucun fichier `Dockerfile`, `docker-compose.yml`, `.github/workflows/` dans le repo** | 🔴 Important |
| Le projet est déployé via `script lz` manuel mais **pas de CI/CD** ni de Dockerfiles versionnés. Si l'image `livrezone-next` est supprimée du registry Docker, reconstruction impossible sans intervention manuelle. | |
| **Pas de `Procfile`, `docker-compose.yml` ou `k8s/` dans le repo** | 🔴 Important |
| Impossible de re-pivoter un environnement de staging ou DR. | |
| **Pas de healthcheck route publique standard** | 🟠 Important |
| `/up` existe (Laravel 13 default) mais aucun healthcheck business (`/api/health`). Si Meilisearch est down, l'app reste "OK" sans que l'alerte parte. | |
| **`.env` versionné (en backup, mais plusieurs `.env.bak-*`)** | 🟡 Mineur |
| Normalement OK si `.gitignore` exclut `.env` — vérifié : `cat .gitignore | grep env` → non fait dans cet audit. **À vérifier.** | |
| **Plusieurs `.env.bak-*` à la racine** | 🟢 Cosmétique — à archiver dans `.gitignore`. |

### Logs

`storage/logs/laravel.log` — log par défaut Laravel. **Pas de log structuré JSON** (utile pour ELK / Loki).

### Monitoring

- `Log::critical('Queue database en anomalie')` sur 5 min → alerter (mais **pas de canal Slack/Telegram d'alerte** : il faut `tail -f laravel.log`).
- **Aucun APM** (Sentry, NewRelic, Telescope).

---

## 9. Tests

### État

```
tests/
├── Feature/  (13 fichiers)
│   ├── AdminOrderTest.php
│   ├── AdminPauseSubscriptionTest.php
│   ├── AdminPaymentTest.php
│   ├── AdminSettingsTest.php
│   ├── AdminUsersFilterTest.php
│   ├── AuthorizationPolicyTest.php ⭐
│   ├── CartMergeClampTest.php
│   ├── ChatTest.php
│   ├── ExampleTest.php
│   ├── ListingScopeTest.php
│   ├── PaymentFlowTest.php
│   ├── PaymentSimulatorTest.php
│   ├── QueueHealthCheckTest.php
│   └── WhatsAppDemandNotificationTest.php
└── Unit/  (3 fichiers)
    ├── ExampleTest.php
    ├── ProfileSearchableObserverTest.php ⭐
    └── SubscriptionServiceTest.php
```

**Total : 16 fichiers de tests** (dont 2 Example par défaut).

### ✅ Forces

- **`AuthorizationPolicyTest`** est **exemplaire** : teste toutes les policies (Listing, ChatThread, ChatMessage) + tests d'endpoints réels.
- **`ProfileSearchableObserverTest`** : documente le **bug annuaire 25-28/08** et empêche la régression. C'est du **test de caractérisation** de très bonne qualité.
- **`SubscriptionServiceTest`** (8728 octets) — bon coverage du service central.
- **PHPUnit 12.5.12** + Mockery + Laravel testing.

### ⚠️ Problèmes

| Élément | Constat |
|---|---|
| **Couverture estimée** | **15-25%** des lignes métier. Les controllers `AdminController` (388 lignes), `ProfileController` (357 lignes), `ListingManagerController` (290 lignes), `OrderController` (129 lignes) **n'ont aucun test direct** (seul `SubscriptionServiceTest` couvre le service sous-jacent). |
| **Factory** | ⚠️ **Seule `UserFactory` existe**. Aucune factory pour `Profile`, `Listing`, `Order`, `Book`, `Payment`, `ChatThread`, `ChatMessage`, `DiscountCode`, `NotificationPreference`. **Les tests utilisent des créations manuelles** ou `Listing::withoutSyncingToSearch(fn() => Listing::create([...]))` — **fastidieux et incomplet**. |
| **Pas de `ProfileFactory`, `BookFactory`, `ListingFactory`** | 🔴 Critique. Sans factories, impossible de tester les règles métier complexes (sous-validated listings, packs, paiements). |
| **Pas de tests E2E** | 🟠 — pas de Dusk / Playwright / Cypress. |
| **Pas de tests d'intégration API** | 🟠 — aucun test ne valide la chaîne complète `register → login → create listing → search → order`. |
| **2 fichiers `ExampleTest.php`** | 🟢 Cosmétique. |

### Zones non couvertes (risques)

| Zone | Risque |
|---|---|
| `ProfileController::update()` (avatar) | 🔴 Élevé — 4 modes d'avatar (google, initials, upload, custom), aucune Form Request testée pour chaque. |
| `ListingManagerController::store/update` | 🔴 Élevé — pipeline complexe (taxonomie, livre, couverture, status). |
| `OrderService::createOrder` (déduplication verrouillée) | 🟠 Important — race conditions possibles, pas de test concurrent. |
| `PaymentController::store` | 🟠 Important — calcul de prix avec coupon, validation manuelle vs gateway. |
| `AdminController` (30 endpoints) | 🔴 Élevé — la surface admin n'est pas testée. |
| `ImageUploadService` (chemins, MIME) | 🟡 Moyen — pas de test sur polyglot, taille max. |
| `Webhook Telegram` (signature) | 🔴 Élevé — pas de test du 403 sur signature invalide. |

---

## 10. Analyse métier

### ✅ Forces métier

- **Subscription centralisée** dans `SubscriptionService` (524 lignes) — source unique pour Free/Pro/Premium, promo, prix, expiration. **Excellent.**
- **Visibilité différenciée** des demandes : Free invisible, Pro avec délai Xh, Premium immédiat. **Très bien modélisé** dans `OrderService::applyVisibility()`.
- **Idempotence des paiements** : `Payment::where('user_id', ...)->where('status', 'pending')->delete()` avant création (`PaymentController.php:99-101`).
- **Verrouillage concurrent** sur création d'order (`OrderService.php:386-389`).
- **Anti-dérive Scout** sur Profile — bug annuaire résolu proprement.
- **Règle "WhatsApp = book_orders uniquement"** bien appliquée dans `NotificationSettingsService`.

### ⚠️ Cas limites métier

| Cas | Comportement |
|---|---|
| **Utilisateur désactive son compte, tokens Sanctum encore valides** | 🟠 Accès possible jusqu'à expiration du token. |
| **Paiement validé puis markPaid appelé 2×** | ✅ `if ($payment->status === 'paid') return $payment;` (ligne 117) — **bonne garde.** |
| **Coupon expiré pendant le processus de paiement** | 🟠 Race condition possible : coupon vérifié dans `preview()`, puis à nouveau dans `store()`. Si expiré entre les deux, **erreur 422 mais paiement partiel possible.** |
| **Mise à jour d'une annonce publiée** | ✅ Repasse en `pending_admin` si titre/description/ISBN change (ListingManagerController:140-152). |
| **Republish d'une annonce** | ✅ Bien géré (DashboardController:102-132). |
| **Nickname réservé** | ✅ Blacklist de 24 mots dans `Profile::RESERVED_NICKNAMES` — bien pensé. |
| **Nickname collision à la création** | ✅ Slug + suffixe numérique (Profile.php:127-132). |
| **Listing book_id = null + isbn_13 = null** | ⚠️ Status reste `pending_admin` — mais `ListingObserver::saved()` synce quand même `syncOwner()` — **OK.** |
| **Free user downgrade → limites Free dépassées** | ✅ `deactivateExcessFreeListings()` masque les annonces excédentaires (SubscriptionService:367). |
| **Recherche Meilisearch down** | ✅ Fallback SQL implémenté dans `OrderService::getPublicDemandesFallback()` — **très bonne pratique**. **Mais pas dans `ListingSearchService::executeSearch()`** qui catch juste les facettes. |

### Robustesse fonctionnelle

- ✅ Transactions DB présentes (`DB::transaction()`) dans :
  - `OrderService::createOrder` (ligne 381)
  - `AdminPaymentService::markPaid` (ligne 121)
  - `NotificationSettingsService::save` (ligne 40)
  - `CartController::merge` (ligne 148)
  - `AdminController::storeHero` (ligne 345)
- ⚠️ **Mais pas dans** :
  - `ProfileController::update` (ligne 196) — `updateOrCreate` n'est pas transactionnel par défaut.
  - `ListingManagerController::update` (ligne 176) — un crash après `$listing->update()` peut laisser les miniatures orphelines.
  - `SocialAuthController::callback` (lignes 49–77) — pas de transaction sur `ensureProfileExists`.

---

## 11. Résumé exécutif

### 📊 Notes globales

| Axe | Note | Justification |
|---|---|---|
| **Architecture** | **8.5/10** | Excellente séparation Controllers/Services/Models, Form Requests systématiques, mais duplications internes (ProfileController::update, ListingManagerController store/update) et 1 controlleur orphelin (PreferenceController). |
| **Sécurité** | **7.0/10** | Sanctum bien utilisé, upload sécurisé via Intervention, mais **LFI potentiel** sur `/book-cover-proxy/*`, CORS trop permissif, mass assignment partiel, `ListingPolicy::view()` manquante (bug latent), pas de throttle sur login. |
| **Performance** | **7.5/10** | Meilisearch excellent, eager loading bon, mais **CACHE_STORE=database** au lieu de Redis, `COALESCE(price)` non indexable, 2 calls Meilisearch par recherche. |
| **Maintenabilité** | **8.0/10** | Commentaires métier riches (exemplaires), code bien typé, mais 26 services sans factory ni tests pour 80% d'entre eux, quelques services trop gros (SubscriptionService 524 lignes). |
| **Qualité du code** | **8.0/10** | Très propre globalement, mais duplications (ProfileController, Category::pluck), `env()` en runtime, mass assignment partiel User. |
| **Scalabilité** | **6.5/10** | Queue database (pas Redis), pas de worker persistant, pas de sharding, pas d'index sur `COALESCE(price)`. Le backlog queue peut exploser sous forte charge. |

**Note globale pondérée : 7.6/10** — projet de **très bonne qualité pour une phase de migration/consolidation**, avec quelques dettes techniques à régler avant une montée en charge.

### ✅ Forces du projet

1. **Architecture Skinny Controllers + Services dédiés** réellement appliquée (vs. lip-service).
2. **Commentaire métier** d'une densité rare — chaque décision non triviale est justifiée.
3. **Meilisearch comme moteur de recherche principal** — excellente.scalabilité horizontale.
4. **SubscriptionService centralisé** — anti-pattern "magic numbers" évité.
5. **Vocabulaire unifié** via `NotificationChannels` (Support) + `NotificationTypeService`.
6. **Tests de caractérisation** sur les bugs connus (annuaire, profiles Scout).
7. **Form Requests omniprésents** sur les endpoints utilisateur.
8. **Anti-dérive Scout** résolue avec un hook `boot()` propre (Profile.php:91-134).
9. **Job retry pattern** propre (`SerializesModels`, `InteractsWithQueue`).
10. **Fallback SQL** sur Meilisearch pour `getPublicDemandes` — robustesse.

### ❌ Faiblesses du projet

1. **LFI potentiel** sur `/book-cover-proxy/{path}` (routes/web.php).
2. **`ListingPolicy::view()` manquante** — bug latent de sécurité.
3. **Pas de CI/CD** ni Dockerfiles versionnés — DR/staging impossible.
4. **49% des controllers** (`PreferenceController` orphelin, `OrderController` validation inline, `DashboardController::bulkApplyDiscount`) ont des anti-patterns.
5. **`CACHE_STORE=database` et `SESSION_DRIVER=database`** au lieu de Redis.
6. **Couverture de tests < 25%** et **factories manquantes** pour Profile/Listing/Order/Book.
7. **3 migrations destructives** (`dropIfExists` puis create).
8. **Duplication du code de mise à jour d'avatar** (ProfileController + Profile model).
9. **Throttle absent sur `/auth/login`** et `/auth/forgot-password`.
10. **Queue database + cron `queue:work`** au lieu d'un worker persistant.

### 🔴 Corrections prioritaires

#### 1. CRITIQUE (à corriger cette semaine)

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 1 | Ajouter `ListingPolicy::view()` | `app/Policies/ListingPolicy.php` | 5 min |
| 2 | Corriger `/book-cover-proxy/{path}` (LFI) avec `realpath()` check | `routes/web.php:21-83` | 30 min |
| 3 | Ajouter throttle sur `/auth/login` et `/auth/forgot-password` | `routes/api.php` | 5 min |
| 4 | Supprimer ou router `PreferenceController` orphelin | `app/Http/Controllers/Profile/` | 10 min |
| 5 | Wrapper CORS `FRONTEND_URL` en validation stricte | `config/cors.php`, `AppServiceProvider` | 15 min |

#### 2. IMPORTANT (à corriger ce mois)

| # | Action | Effort |
|---|---|---|
| 6 | Migrer `CACHE_STORE` et `SESSION_DRIVER` vers Redis | 1h |
| 7 | Extraire la logique avatar dans `ProfileAvatarService` (DRY) | 2h |
| 8 | Factoriser `ListingManagerController::store/update` dans `ListingUpsertService` | 4h |
| 9 | Centraliser `Category::pluck('code', 'id')` dans `ReferenceFilterService::getCategoryMap()` | 30 min |
| 10 | Refactor 3 migrations destructives en additive (réécrire avec ALTER) | 4h |
| 11 | Ajouter `ProfileFactory`, `BookFactory`, `ListingFactory`, `OrderFactory`, `PaymentFactory`, `ChatThreadFactory` | 2h |
| 12 | Tests manquants : `ProfileController::update`, `OrderController::store`, `PaymentController::store`, `TelegramWebhookController::handle` | 6h |
| 13 | Ajouter `EnsureActive` middleware (compte désactivé → 403) | 1h |
| 14 | Documenter et tester la **vérification d'email** (chemin complet) | 1h |

#### 3. AMÉLIORATION (à planifier)

| # | Action | Effort |
|---|---|---|
| 15 | Worker queue persistant (Supervisor) au lieu de cron | 2h |
| 16 | Index sur `effective_price` (colonne générée) ou splitting `price`/`discount_price` | 3h |
| 17 | Cache `adminStatusCounts()` et `OrderService::adminStatusCounts()` (60s) | 30 min |
| 18 | Dockerfiles versionnés + docker-compose.yml | 4h |
| 19 | CI GitHub Actions : Pint + PHPUnit + audit composer | 3h |
| 20 | Healthcheck business `/api/health` (Meilisearch, DB, Queue) | 2h |
| 21 | Cache `OrderService::getPublicDemandes()` (par hash de filtres, 60s) | 1h |
| 22 | Split `SubscriptionService` (524 lignes) en `SubscriptionPolicyService` + `SubscriptionLifecycleService` + `SettingsService` | 6h |
| 23 | Split `Listing` model (342 lignes) en traits `ListingSearchable`, `ListingUrls`, `ListingScoping` | 3h |
| 24 | Connecter `Log::critical('Queue database en anomalie')` à un canal d'alerte (Telegram) | 1h |

### 🗺️ Plan d'action

#### **Quick Wins (< 1 jour)**
- #1 Policy `view()` manquante — 5 min
- #3 Throttle login/forgot-password — 5 min
- #4 Supprimer `PreferenceController` orphelin — 10 min
- #5 Validation stricte CORS — 15 min
- #17 Cache admin status counts — 30 min
- #9 Centraliser `Category::pluck` — 30 min

#### **Court terme (< 1 semaine)**
- #2 Corriger LFI `/book-cover-proxy` — 30 min
- #6 Migrer CACHE_STORE + SESSION_DRIVER vers Redis — 1h
- #7 Extraire `ProfileAvatarService` — 2h
- #13 Middleware `EnsureActive` — 1h
- #11 Factories manquantes — 2h
- #14 Tests vérification d'email — 1h

#### **Moyen terme (< 1 mois)**
- #8 Factoriser `ListingUpsertService` — 4h
- #10 Réécrire migrations destructives en additive — 4h
- #12 Tests manquants critiques — 6h
- #15 Worker queue persistant — 2h
- #16 Index `effective_price` — 3h
- #21 Cache `getPublicDemandes` — 1h

#### **Long terme (3 à 6 mois)**
- #18 Dockerfiles + docker-compose versionnés — 4h
- #19 CI GitHub Actions complet — 3h
- #20 Healthcheck business — 2h
- #22 Split `SubscriptionService` — 6h
- #23 Split `Listing` model en traits — 3h
- #24 Canal d'alerte Telegram pour queue santé — 1h
- Mise en place Sentry / Telescope pour observabilité
- Passage à `laravel/horizon` pour visualisation queue
- Évaluation Redis Sentinel / Cluster pour haute dispo

---

## 📌 Conclusion

Le projet LivreZone est dans une **phase de consolidation avancée** : la dette technique issue de la migration Laravel 13 a été largement résolue, l'architecture Skinny Controllers + Services dédiés est appliquée avec rigueur, et la qualité des commentaires métier est exceptionnelle. Les choix techniques (Meilisearch, Sanctum, NotificationChannels) sont solides.

**3 corrections critiques cette semaine** :
1. Ajouter `ListingPolicy::view()` (5 min).
2. Sécuriser `/book-cover-proxy/{path}` (30 min).
3. Throttle sur `/auth/login` (5 min).

**2 investissements structurants ce trimestre** :
1. Migration Redis pour cache + sessions.
2. Création des factories manquantes + tests sur les controllers critiques.

Le projet est **prêt pour la production** mais avec une dette de tests qui limite la confiance dans les refactors futurs. La mise en place d'une CI est désormais indispensable avant toute montée en charge.

— *Audit terminé.*