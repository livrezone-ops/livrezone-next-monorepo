# Résumé — Notifications & Abonnements (LivreZone)

Suivi des travaux sur le système de notifications (`/dashboard/notifications`),
la distribution des alertes, et la gestion centralisée des abonnements.

---

## 1. Points vérifiés / réalisés

### Backend — Préférences de notification
- `app/Services/NotificationPreferenceService.php` : logique extraite du contrôleur + listes blanches `ALLOWED_TYPES` / `ALLOWED_CHANNELS`.
- `ProfileController` : `get/updateNotificationPreferences` délèguent au service et valident les types/canaux (`in:...`).
- `app/Models/NotificationPreference.php` + migration `notification_preferences` (unique `user_id, notification_type, channel`).
- `app/Models/User.php` : relation `notificationPreferences()` (le Job plantait sans elle).

### Frontend — Page réglages
- `frontend/app/dashboard/notifications/page.tsx` :
  - utilise `refData.parent_categories` (catégories parentes, `name_fr`) au lieu de l'arbre complet ;
  - correction de la logique de sélection par défaut (le 1er clic ne désélectionne plus tout).

### Backend — Distribution réelle (Job)
- `app/Jobs/ProcessBookOrderNotifications.php` : envoie réel selon préférences + filtre catégorie.
- `app/Notifications/BookOrderedNotification.php` : canaux `mail` + `database` (in-app), `via()` dynamique, `delay()` pour Pro.
- `app/Services/TelegramNotificationService.php` : `sendToChat($chatId, $message)` (par profil).
- Migrations : `notifications` (canal in-app) + `profiles.telegram_id` (déplacé depuis `users` via migration de move idempotente).

### Backend — Éligibilité abonnement (nouvelle règle métier)
- `app/Services/SubscriptionService.php` : **source de vérité unique**
  - `isPromoProFree()` / `getEffectiveSubscription()` (Free → Pro si `PROMO_PRO_FREE=true`) ;
  - `canReceiveNotifications()`, `allowedNotificationChannels()` (Pro → `database` seul ; Premium → `mail`+`database`+`telegram`) ;
  - `canViewDemandes()`, `getDemandesVisibilityThreshold()` (Pro → `now - PRO_NOTIFICATION_DELAY_HOURS`) ;
  - `getMaxFreeListings()` (0 = illimité), `getMaxListings()`, `hasReachedListingLimit()` ;
  - `getProPrice()`, `getPremiumPrice()` ;
  - `changeSubscription(User, type)` (admin), `processExpirations()` (rétro + purge), `notifiableSubscriptionTypes()`.
- Refactorés pour utiliser le service (fin du code en dur) :
  - `ProcessBookOrderNotifications` (sélection vendeurs + canaux + délai) ;
  - `OrderService::getPublicDemandes()` + fallback (visibilité demandes + flag `can_view_demandes`) ;
  - `ListingManagerController::store` (limite de publications) ;
  - `ProcessExpiredSubscriptions` (délègue à `processExpirations()`) ;
  - `ReferenceDataService` (bloc pricing via le service).

### Backend — Action admin
- `POST /admin/users/{user}/subscription` → `AdminController::updateUserSubscription` (validé `free|pro|premium`, refus sur soi-même) + route dans le groupe `admin`.

### Configuration `.env` (vérifiée / ajoutée)
- `MAX_FREE_LISTINGS=25`, `PRO_PRICE=30`, `PREMIUM_PRICE=50`, `PROMO_PRO_FREE=false`, `PRO_NOTIFICATION_DELAY_HOURS=5`, `SUBSCRIPTION_GRACE_PERIOD_DAYS=15`.

---

## 2. Points à vérifier (validation avant production)

- **Migrations** : lancer `migrate` sur le serveur. La colonne `users.telegram_id` existe déjà en base (migrée avant suppression du fichier) ; la migration `…_move_telegram_id_to_profiles` doit la retirer et garantir `profiles.telegram_id`. Vérifier son exécution sans erreur.
- **Scheduler** : confirmer que `app:process-subscriptions` est planifié (cron) pour la rétrogradation + purge.
- **Email** : vérifier l'envoi depuis Laravel via le SMTP Brevo configuré, et la journalisation des erreurs dans la queue.
- **Visibilité des demandes** (`/orders`, auth) : Free → liste vide + `can_view_demandes=false` ; Pro → uniquement `published_at <= now - 5h` ; Premium → tout.
- **Canaux par abonnement** : Pro reçoit `in_app` uniquement (email/telegram ignorés même cochés) ; Premium selon préférences.
- **Cache reference_data** : `parent_categories` + `pricing` sont servis après `optimize:clear` (`lz`).
- **Promo** : avec `PROMO_PRO_FREE=true`, un Free est traité comme Pro (notifications in-app + délai, visibilité demandes, listings illimités).
- **Limite listings** : à la création d'annonce, blocage au-delà de `MAX_FREE_LISTINGS` (0 = illimité) ; `PROMO_PRO_FREE` rend Free illimité.
- **Endpoint admin** : `POST /admin/users/{user}/subscription` refuse de modifier son propre compte et valide le type.

---

## 3. Tâches restantes

- **Frontend — visibilité Free** ✅ (implémenté sur `/demandes`) : `DemandesClient` consomme `can_view_demandes`. Les visiteurs non authentifiés (traités en Free) et les Free connectés voient un état verrouillé + CTA `/tarification`. Les utilisateurs connectés sont servis par un fetch client authentifié (`api` avec cookie Sanctum) pour refléter leur abonnement réel. ⚠️ `/dashboard/demandes` = « Mes demandes » (ses propres commandes via `/orders`) : `can_view_demandes` ne s'y applique pas (on voit toujours ses propres demandes). À confirmer si un marketplace public est attendu dans le dashboard.
- **Frontend — UI admin** ✅ : `AdminClient` (onglet Utilisateurs) affiche un `<select>` free/pro/premium par user (valeur depuis `profile.subscription_type`), appelant `POST /admin/users/{user}/subscription`. L'admin courant est exclu (le backend refuse l'auto-modification). Invalidation react-query après MAJ.
- **Liaison Telegram (bot)** ✅ : `TelegramWebhookController` (`POST /api/telegram/webhook`, public) capture `/start <token>` → lie `chat_id` au profil (token stocké dans `profiles.telegram_link_token`, expirant à 30 min). `ProfileController::generateTelegramLink` génère le deep link `https://t.me/<bot>?start=<token>` ; `unlinkTelegram` délie. `config('services.telegram.bot_username'/'webhook_secret')` ajoutés. ⚠️ **Opérationnel** : (1) `php artisan migrate` (migration `…_add_telegram_link_token_to_profiles`) ; (2) définir `.env` `TELEGRAM_BOT_USERNAME` + `TELEGRAM_WEBHOOK_SECRET` ; (3) `setWebhook` vers `https://api-next.livrezone.com/api/telegram/webhook` (header secret optionnel).
- **Boîte de réception in-app** ✅ : `NotificationController` (`GET /api/notifications` + `POST /api/notifications/{id}/read` + `POST /api/notifications/read-all`) avec compteur de non-lues. UI inbox dans `/dashboard/notifications` (liste paginée + marquage) et badge de non-lues dans le `Header` (via `unread_notifications_count` ajouté à l'endpoint `/user`).
- **Newsletter / Promotions** : préférences sauvegardées mais aucun sender implémenté (le Job ne traite que `book_orders`).
- **Downgrade manuel** ✅ : `changeSubscription()` vers `free` purge désormais les annonces excédentaires (soft-desactivation `inactive`) via la nouvelle méthode `deactivateExcessFreeListings()`. Cette méthode est partagée avec `processExpirations()` (qui applique toujours le délai de grâce avant purge). Garde-fou : `MAX_FREE_LISTINGS = 0` (illimité) ne purge rien.
- **Tests automatisés** (🟡 `SubscriptionService` écrit, non exécuté en prod) : `tests/Unit/SubscriptionServiceTest.php` (11 méthodes) couvre valeurs par défaut, promo `PROMO_PRO_FREE`, `canViewDemandes`/`canReceiveNotifications`/`allowedNotificationChannels`, `getEffectiveSubscription`, `getDemandesVisibilityThreshold`, `changeSubscription`, `hasReachedListingLimit` et `deactivateExcessFreeListings` (soft-desactivation de l'excédent). Scout désactivé via `withoutSyncingToSearch`. ⚠️ **Blocage d'exécution** : le container de prod (`php-fpm-8.5`) est build `--no-dev` et le `composer.lock` ne contient pas phpunit/faker → `artisan test` impossible en prod. Exécuter dans un environnement dev (`composer install` complet) ou via `composer require --dev phpunit/phpunit fakerphp/faker` (modifie le lock). ⚠️ Reste le Job de notification (`ProcessBookOrderNotifications`) non testé. ⚠️ **Bug pré-existant** : l'ENUM `listings.status` (migration `add_sold_status`) n'inclut pas `'inactive'` → la purge stocke `''` en prod au lieu de `'inactive'`. À corriger (ajouter `'inactive'` à l'ENUM).

---

## Détail technique — purge (question posée)
- `changeSubscription()` = changement manuel admin, **ne touche aucune annonce**.
- `processExpirations()` (job planifié) = seule méthode qui purge : pour les comptes `free` dont le délai de grâce est écoulé et avec trop d'annonces actives, les annonces **excédentaires passent en `status = 'inactive'`** (désactivation soft, pas de delete). Non déclenchée par un downgrade manuel immédiat.
