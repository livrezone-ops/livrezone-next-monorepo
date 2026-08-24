# Audit du code — Notifications, Abonnements, Demandes, Telegram, Email

> Audit basé **uniquement** sur le code réel (backend Laravel + frontend Next.js), sans reprise
> d'hypothèses antérieures. Date : 2026-08-24.
> Fichier de référence métier comparé : exigences officielles fournies dans `récup et control.txt`.

---

## 0. Règles métier RÉELLEMENT implémentées (reconstruites du code)

### Abonnements (`app/Services/SubscriptionService.php`)
- `canReceiveNotifications` : `false` si `subscription_type === 'free'` (sauf promo `PROMO_PRO_FREE`).
- `allowedNotificationChannels` : `pro` → `['database']` ; `premium` → `['mail','database','telegram']`.
- `canViewDemandes` : `false` pour `free` (sauf promo).
- `getDemandesVisibilityThreshold` : `pro` → `now() - PRO_NOTIFICATION_DELAY_HOURS` ; `premium` → `null` (immédiat).
- `getMaxFreeListings` : `MAX_FREE_LISTINGS` (défaut 25). Free limité, Pro/Premium illimité.
- `changeSubscription` : downgrade vers `free` → purge des annonces excédentaires (`deactivateExcessFreeListings`).
- `processExpirations` : rétrogradation Pro/Premium expirés vers `free` + purge après délai de grâce.
- Promo `PROMO_PRO_FREE` : traite `free` comme `pro` (notifications + visibilité).

### Flux de notification commande (`app/Jobs/ProcessBookOrderNotifications.php`)
- Charge tous les profils `subscription_type` ∈ `notifiableSubscriptionTypes()` (pro, premium, +free si promo).
- Exclut `free` hors promo via `canReceiveNotifications`.
- Lit les préférences `book_orders` (email/in_app/telegram) ; défauts : email=true, in_app=true, telegram=false.
- Canaux réels = intersection(`allowedNotificationChannels`, préférence activée, telegram_id présent).
- `pro` : notification `database` **différée** de `PRO_NOTIFICATION_DELAY_HOURS`. `premium` : immédiat (+mail +telegram).
- Telegram envoyé via `TelegramNotificationService::sendToChat($profile->telegram_id, ...)`.

### Demandes (`app/Services/OrderService.php`)
- `/demandes` public ; visibilité appliquée par `applyVisibility` selon l'abonnement du viewer (Free → vide).
- Catalogue → `published` immédiat ; manuel → `pending_admin`. Seul `published` notifie + est indexé Meilisearch.

### Telegram
- Liaison : `ProfileController::generateTelegramLink` (token 40 chars, 30 min) → deep link `t.me/<bot>?start=<token>`.
- Webhook public `POST /api/telegram/webhook` → `TelegramWebhookController` écrit `profiles.telegram_id`.
- Envoi commande : `sendToChat` (par `telegram_id`, par utilisateur).

### Email / Queue
- `config/mail.php` : `default = env('MAIL_MAILER', 'log')`. `.env` : `MAIL_MAILER=smtp` (Brevo, `smtp-relay.brevo.com:587`).
- `config/queue.php` : `default = env('QUEUE_CONNECTION', 'database')`. `.env` : `QUEUE_CONNECTION=database`.

### Frontend
- Header : pastille `unread_notifications_count` (depuis `/user`). `app/dashboard/notifications/page.tsx` : inbox + liaison Telegram + préférences (book_orders + newsletter + promos).
- `DemandesClient.tsx` : si `!can_view_demandes` → écran verrouillé + CTA `/tarification`.
- `AdminClient.tsx` : `<select>` free/pro/premium par user (admin courant exclu).

---

## 1. CE QUI EST CORRECT ✅

| Exigence | Preuve | Statut |
|---|---|---|
| Free : aucune notification | `SubscriptionService::canReceiveNotifications` + garde dans le Job | ✅ |
| Free : pas de consultation des demandes | `OrderService::canViewDemandes` + `applyVisibility` vide la collection | ✅ |
| Pro : In-App uniquement, différé de 5 h | `allowedNotificationChannels` (pro→database) + `PRO_NOTIFICATION_DELAY_HOURS=5` (.env) + délai dans le Job | ✅ |
| Premium : In-App + Email + Telegram, immédiat | `allowedNotificationChannels` (premium→mail,database,telegram) ; Job immédiat | ✅ |
| Préférences prises en compte seulement si l'abonnement autorise le canal | Job : `allowedChannels` ∩ préférence ∩ `telegram_id` | ✅ |
| Free jamais notifié même si préférences activées | garde `canReceiveNotifications` avant toute préférence | ✅ (hors promo, exception voulue) |
| In-App lues / marquées lues | `NotificationController` + `notifications/page.tsx` | ✅ |
| Compteur non-lues dans le Header | `Header.tsx:56` + `/user` calcule `unread_notifications_count` | ✅ |
| Telegram via vrai `telegram_id` par utilisateur | `sendToChat($profile->telegram_id)` | ✅ |
| Plus de fallback téléphone pour la liaison Telegram | `telegram_id` posé par webhook `chat_id`, plus aucun usage de `phone` comme fallback | ✅ |
| Email réel via queue | `.env` Brevo SMTP + `QUEUE_CONNECTION=database` | ✅ (config OK ; à confirmer : worker `queue:work` actif en prod) |
| Admin peut changer l'abonnement | `AdminController::updateUserSubscription` → `changeSubscription` | ✅ |
| ENUM `subscription_type` = free/pro/premium | migration `2026_08_22_000000` | ✅ |

---

## 2. PARTIELLEMENT IMPLÉMENTÉ 🟡

- **Newsletter / Promotions (exigence #5)** : les préférences `newsletter`/`promos` sont enregistrées
  (`NotificationPreferenceService`, `notifications/page.tsx`) mais **aucun expéditeur** n'existe.
  Le seul Job (`ProcessBookOrderNotifications`) ne traite que `book_orders`. Aucun `Command`/listener
  ne lit ces préférences. → Sauvegarde sans effet.

- **Visibilité « Mes demandes » vs marketplace** : l'exigence « Free ne consulte pas les demandes »
  s'applique au marketplace `/demandes`. Le menu Header `/dashboard/demandes` affiche **les propres
  commandes** de l'utilisateur (`OrderController::index` → `getUserOrders`), disponible pour tous les
  rangs. Ce n'est pas une contradiction, mais c'est ambigu : confirmer que le dashboard « Mes demandes »
  doit rester ouvert à tous (y compris Free).

- **Vérification du worker de queue** : la configuration permet un envoi réel, mais le code ne garantit
  pas que `php artisan queue:work` tourne en prod (impossible à vérifier depuis le code seul).

---

## 3. INCORRECT / BUGS 🔴

### BUG 1 — Purge Free : `status = 'inactive'` HORS ENUM (critique)
- `SubscriptionService::deactivateExcessFreeListings` (ligne 166) fait
  `$listing->update(['status' => 'inactive'])`.
- L'ENUM `listings.status` (migration `2026_08_14_000000_add_sold_status_to_listings.php`) contient
  `pending_admin, published, rejected, deleted, sold, active, archived, hidden, expired` — **pas `'inactive'`**.
- Conséquence en prod (MariaDB strict) : erreur SQL / la valeur n'est pas persistée correctement.
  La purge « soft » ne fonctionne pas. Le downgrade manuel et `processExpirations` sont affectés.
- **Correction** : soit ajouter `'inactive'` à l'ENUM (nouvelle migration), soit utiliser `'hidden'`
  (déjà utilisé par l'admin pour « désactiver ») dans `deactivateExcessFreeListings`.

### BUG 2 — Valeur morte `'pending_stock'` dans les filtres de statut
- `SubscriptionService` lignes 117 et 159 : `whereIn('status', ['published','pending_admin','pending_stock'])`.
- `'pending_stock'` **n'existe pas** dans l'ENUM → filtre sans effet (comptage/purge ignorent ces annonces
  s'il y en a ; aucune erreur mais logique fausse). À retirer.

### BUG 3 — `TELEGRAM_BOT_USERNAME` (et `TELEGRAM_WEBHOOK_SECRET`) absents du `.env`
- `config/services.php` lit `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET`.
- `.env` ne définit que `TELEGRAM_ENABLED=true` et `TELEGRAM_CHAT_ID`. `TELEGRAM_BOT_USERNAME` et
  `TELEGRAM_WEBHOOK_SECRET` **ne sont pas présents**.
- `ProfileController::generateTelegramLink` renvoie **422 « Configuration Telegram incomplète »** car
  `bot_username` est null → **la liaison Telegram côté utilisateur est actuellement cassée**.
- `TelegramWebhookController` : le secret n'est vérifié que s'il est configuré → webhook sans auth tant
  que `TELEGRAM_WEBHOOK_SECRET` n'est pas renseigné (faille d'exposition : n'importe qui peut appeler
  le webhook, mais il ne fait que lier un token valide, risque faible).
- **Correction** : ajouter `TELEGRAM_BOT_USERNAME` et `TELEGRAM_WEBHOOK_SECRET` côté serveur (valeurs
  à fournir par ouahib), puis `setWebhook` avec `secret_token`.

### BUG 4 (mineur) — `APP_ENV=local` en production
- `.env` : `APP_ENV=local`. En prod cela active le debug Laravel (fuite de stack traces). À passer en
  `production` (hors périmètre strict notifications, mais à signaler).

---

## 4. OBSOLÈTE / ANCIEN MÉCANISME 🟠

### `TelegramNotificationService::sendNewListingNotification` (diffusion globale)
- Envoie à **un seul chat global** `config('services.telegram.chat_id')` (legacy broadcast admin),
  indépendamment de l'abonnement et des préférences utilisateur.
- Appelé depuis `ListingManagerController::store` (l.133) et `::update` (l.254), et `DashboardController`
  (l.148). C'est l'ancien mécanisme « nouvelle annonce → chat unique », **en contradiction** avec le
  nouveau modèle per-user (`sendToChat` par `telegram_id`).
- Il inclut aussi `$sellerPhone` dans le message — résidu « téléphone », acceptable comme info contact
  mais à revoir dans le cadre de la suppression du fallback téléphone.
- Le message Telegram de commande (`buildTelegramMessage`, Job) est générique et ne reprend pas
  fidèlement le lien vers la demande (`/annonces`).

### Migrations Telegram redondantes
- `2026_08_24_100002_add_telegram_id_to_profiles` ajoute `telegram_id` sur `profiles`.
- `2026_08_24_100003_move_telegram_id_to_profiles` tente de déplacer depuis `users` → `profiles`, mais
  `users` n'a jamais eu `telegram_id`. Migration **no-op** défensive ; peut être conservée (idempotente)
  mais est du dead-code de migration.

---

## 5. DOUBLONS / DEAD CODE 🧹

- `sendNewListingNotification` : doublon du nouveau flux per-user (voir §4). À décider : supprimer
  (si l'admin n'a plus besoin de la diffusion globale) ou le documenter explicitement comme
  « notification admin des nouvelles annonces ».
- `'pending_stock'` : valeur de statut morte (§3 BUG 2).
- `2026_08_24_100003_move_telegram_id_to_profiles` : migration no-op (§4).
- `filters` partagés entre canaux : dans le Job, les filtres de catégorie sont lus depuis « le premier
  préférence activée » (`firstActivePref`) — heuristique fragile si l'utilisateur active email mais
  désactive in_app. À refactoriser (voir architecture cible).
- `Notification` : pas de `NotificationPolicy` ni middleware dédié ; les routes sont protégées par
  `auth:sanctum` uniquement (acceptable, mais à noter).

---

## 6. ARCHITECTURE CIBLE PROPOSÉE

1. **Source de vérité unique** : `SubscriptionService` (déjà en place) — à conserver et étendre.
2. **Canaux de notification** : un seul dispatcher qui, pour une `Order` publiée, itère les vendeurs
   éligibles et décompose proprement :
   - In-App (Laravel `database`) via `BookOrderedNotification` (déjà fait).
   - Email (Laravel `mail`) — **uniquement premium**, respect préférence.
   - Telegram (per-user `sendToChat`) — **uniquement premium**, respect préférence + `telegram_id`.
   - Le découpage canaux/préférences doit être extrait dans
     `NotificationChannelResolver` (ou méthode dédiée dans `SubscriptionService`) pour ne plus
     dupliquer la logique dans le Job.
3. **Diffusion Telegram** : supprimer `sendNewListingNotification` (global) OU le renommer
   `notifyAdminNewListing` et le réserver explicitement à l'admin (avec un `.env`/`config` dédié),
   clairement séparé du flux per-user.
4. **Purge Free** : utiliser `'hidden'` (cohérent avec l'admin) ou ajouter `'inactive'` à l'ENUM.
5. **Newsletter/Promos** : créer un `SendNewsletterCommand` (ou `ProcessNewsletterNotifications` Job)
   qui lit `notification_preferences` (types `newsletter`/`promos`) et n'envoie qu'aux `premium`
   (email). À brancher sur le scheduler.
6. **Config Telegram** : renseigner `TELEGRAM_BOT_USERNAME` + `TELEGRAM_WEBHOOK_SECRET` en prod et
   configurer le webhook avec `secret_token`.
7. **Tests** : rendre exécutable `tests/Unit/SubscriptionServiceTest.php` (env dev, ou
   `composer require --dev phpunit` temporaire) et ajouter un test sur la purge (statut valide) et sur
   `allowedNotificationChannels`.

---

## 7. LISTE EXACTE DES FICHIERS À MODIFIER

**Corrections (bugs) — priorité haute**
1. `app/Services/SubscriptionService.php`
   - l.166 : remplacer `'inactive'` par `'hidden'` (ou ajouter l'ENUM).
   - l.117 & l.159 : retirer `'pending_stock'` du `whereIn`.
2. `.env` (serveur) : ajouter `TELEGRAM_BOT_USERNAME=…` et `TELEGRAM_WEBHOOK_SECRET=…` ; passer
   `APP_ENV=production`. (Non versionnable — à faire côté serveur ouahib.)
3. `database/migrations/` : nouvelle migration pour ajouter `'inactive'` à l'ENUM `listings.status`
   **SI** on conserve `'inactive'` (sinon seulement le changement de statut suffit).

**Nettoyage / obsolète**
4. `app/Services/TelegramNotificationService.php` : supprimer `sendNewListingNotification` (ou le
   cantonner explicitement à l'admin et l'exclure du flux commande).
5. `app/Http/Controllers/Api/ListingManagerController.php` (l.133, l.254) et
   `app/Http/Controllers/Api/DashboardController.php` (l.148) : retirer l'appel legacy (ou le remplacer
   par un appel admin explicite).
6. `database/migrations/2026_08_24_100003_move_telegram_id_to_profiles.php` : conserver (idempotent)
   mais le marquer comme historique ; pas de changement fonctionnel.

**Amélioration (partiel)**
7. `app/Jobs/ProcessBookOrderNotifications.php` : extraire la résolution canaux/préférences dans un
   service dédié ; corriger la lecture des filtres (ne pas dépendre du « premier préférence activée »).
8. Nouveau : `app/Console/Commands/SendNewsletterCommand.php` (+ éventuel Job) pour `newsletter`/`promos`.
9. `tests/Unit/SubscriptionServiceTest.php` : ajouter tests purge (statut valide) + canaux.

**Frontend — aucun changement bloquant** ; à vérifier après correction backend :
- `next.livrezone.com/frontend/app/dashboard/notifications/page.tsx` (préférences newsletter/promos
  déjà UI ; seront actives une fois l'expéditeur créé).
- `next.livrezone.com/frontend/components/Header.tsx` (badge OK).

---

## 8. RÉSUMÉ EXÉCUTIF

- **Conforme** : logique d'abonnement, visibilité Free/Pro/Premium, différence Pro (différé) vs Premium
  (immédiat), garde Free, inbox + badge, liaison Telegram par `chat_id`, config SMTP/queue.
- **Bugs bloquants** : (1) purge Free écrit `status='inactive'` hors ENUM → à corriger ; (2) liaison
  Telegram utilisateur cassée car `TELEGRAM_BOT_USERNAME` manquant en `.env` ; (3) valeur morte
  `'pending_stock'`.
- **Partiel** : newsletter/promos enregistrées mais jamais envoyées.
- **Obsolète** : `sendNewListingNotification` (diffusion globale) en double du flux per-user.
- **Action immédiate recommandée** : corriger le statut de purge + ajouter les variables Telegram
  serveur, puis décider du sort de la diffusion globale et créer l'expéditeur newsletter/promos.

---

## 9. CORRECTIFS APPLIQUÉS (2026-08-24)

Effectués côté code (non déployés tant que `lz`/`git` non exécutés) :

- **BUG 1 (purge Free)** — `app/Services/SubscriptionService.php` : `status='inactive'` → `'hidden'`
  (conforme à l'ENUM et à la convention admin « désactiver ») ; retrait de `'pending_stock'` hors ENUM
  dans les deux `whereIn` (lignes ~117 et ~159). Aucune migration nécessaire.
- **Telegram — diffusion ADMIN restaurée (révision du 2026-08-24)** : la méthode legacy
  `sendNewListingNotification` a été remplacée par `notifyAdminNewListing`, explicitement
  cantonnée au chat admin (`config services.telegram.chat_id`) et distincte du flux per-user
  `sendToChat` (demandes de livre, par `telegram_id` lié). Appels réintégrés :
  `ListingManagerController` (store + update published→pending_admin) et `DashboardController`
  (republish, **tous statuts** — décision validée par l'utilisateur pour couvrir le cas `published`).
  `sendToChat` (per-user) inchangé. Aucune injection de service réajoutée (appels via `app(...)`).

Restant (non fait) : expéditeur `newsletter`/`promos` (#8 audit), refactor des filtres du Job, tests,
et les actions `.env`/webhook (à charge d'ouahib, voir §6).
