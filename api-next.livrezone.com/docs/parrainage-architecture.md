# Système de parrainage — Architecture (as-built, 07/09/2026)

> Implémentation alignée sur le code existant : `SubscriptionService` (moteur d'expiration
> Pro, pattern settings), `DiscountCode` (coupons consommés tel quel au checkout),
> `TelegramNotificationService::notifyAdmin` (alertes admin), `UserNotification` (in-app),
> vérification email signée + Socialite, trustProxies Cloudflare.

## 1. Décisions produit

| Décision | Choix | Justification |
|---|---|---|
| Récompenses | Sur les **inscriptions validées** (email vérifié) | Les visites sont triviales à falsifier ; payer dessus = payer du trafic fantôme. |
| Visites | **Toujours comptées** par utilisateur (`referral_shares_count`) — et l'admin peut publier des paliers conditionnés aux visites s'il le veut | Stats, gamification, et liberté éditoriale totale. |
| Paliers | Chaque palier choisi librement sa condition (`condition_type`: `signups` ou `visits`) et son contenu — « offres » publiées par l'admin comme des annonces : livres, réductions, coupons, jours Pro | L'admin garde la main, sans développement. |
| Attribution | **Automatique** dès le palier atteint + **notification Telegram admin** (« tel user a atteint tel palier/limite ») | Zéro friction pour le parrain ; l'admin voit tout et agit a posteriori. |
| Double sens | Bonus filleul configurable (jours de Pro offerts à l'inscription parrainée, défaut 0, activable en admin) | Multiplie ~×2 la conversion des inscriptions parrainées. |

**Échelle de paliers par défaut** (seeder `ReferralSeeder`, modifiable librement) :
1 inscription → 7 j Pro · 5 → 1 mois Pro · 10 → 3 mois Pro · 20 → livre numérique ·
50 → −50 % annuel · 100 → livre physique.

---

## 2. Base de données

### 2.1 Colonnes ajoutées à `profiles` (2026_09_07_000001)

Le parrainage vit sur **profiles** (identité plateforme : abonnement, telegram_id… déjà
là), pas sur users (auth). `referred_by_id` reste un id **users** : c'est l'utilisateur
qui a parrainé.

| Colonne | Rôle |
|---|---|
| `referral_code` (unique, nullable) | Code court 8 car. sans ambiguïté (pas de 0/O/1/I). Généré paresseusement au premier usage — profils existants intouchés. |
| `referred_by_id` FK users | Fige le parrain à l'inscription. Premier cookie gagne, jamais réattribué. |
| `referral_shares_count` (index) | **Visites uniques** comptées via le lien. |
| `referral_signups_count` (index) | **Inscriptions validées** uniquement. |
| `referral_blocked_at` | Exclusion du programme (fraude confirmée) sans toucher au compte. |

⚠️ Colonnes volontairement **hors fillable** : écrites uniquement par les services
(`forceFill`/`increment`), jamais en mass assignment. Les deux compteurs sont indexés sur
profiles → classement admin `ORDER BY` direct (les tables `referral_visits/signups/grants`
référencent quant à elles des id users).

### 2.2 Tables créées

- **`referral_rewards`** — les offres/paliers. `condition_type` ENUM('signups','visits'),
  `reward_type` ENUM('pro_days','percent_discount','coupon','ebook','premium_ebook',
  'physical_book','gift'), `reward_payload` JSON typé par type, `threshold_value`,
  `repeatable` (accordé à chaque multiple du seuil), `max_grants_per_user`,
  `unit_cost` (coût estimé → ROI admin), `is_active`, `sort_order`.
- **`referral_visits`** — lignes immuables (purge 90 j) : `fingerprint_hash`
  (sha256 IP+UA+Accept-Language+APP_KEY), `ip_hash` (HMAC, RGPD), UA, referer, landing,
  pays (CF-IPCountry), `is_bot`, `counted`.
- **`referral_signups`** — attribution filleul : `referrer_user_id`,
  `filleul_user_id UNIQUE` (1 filleul = 1 parrain à vie, garanti DB), statut
  `pending → valid | invalid` (+`invalid_reason`), snapshot IP/fingerprint.
- **`referral_reward_grants`** — ledger : `unique(reward_id, user_id, signup_id)`,
  statut `granted → delivered | cancelled`, `delivery` JSON (code coupon, jours
  crédités, adresse de livraison, compteur de téléchargements), `granted_at`,
  `delivered_at`.
- **`referral_blacklists`** — `type` ENUM('ip','email_domain','fingerprint'), seedée
  avec ~30 domaines email temporaires courants.

### 2.3 Réglages (pattern `settings` + cache, même mécanique que SubscriptionService)

`App\Services\Referral\ReferralSettings` — allowlist dédiée (les clés parrainage ne
polluent pas la source de vérité des abonnements) :

| Clé | Défaut |
|---|---|
| `referral_enabled` | `false` (l'admin ouvre explicitement) |
| `referral_filleul_bonus_days` | `0` |
| `referral_cookie_days` | `30` (borné 1–90) |
| `referral_min_account_age_hours` | `0` (porté par le délai du job) |
| `referral_max_visits_per_day` | `100` |
| `referral_max_signups_per_day` | `10` |
| `referral_max_rewards_per_month` | `3` (paliers à 1 inscription exemptés) |
| `referral_notify_admin` | `true` |

---

## 3. Workflow

### 3.1 Contrat frontend (SPA)
1. Au chargement de la landing avec `?ref=CODE` (route `/ref/CODE` → redirect) : appeler
   **`POST /api/referral/track`** `{code, path}` — les requêtes doivent inclure les
   credentials (déjà le cas pour l'auth Sanctum SPA : cookies only envoyés si
   `withCredentials`). L'API pose le cookie **`lz_ref`** (HttpOnly, signed, `lax`,
   durée = réglage) et compte la visite.
2. Rien d'autre : à l'inscription (`/auth/register`, web OU provider), l'API lit le
   cookie tout seul (repli : champ optionnel `ref_code` dans le payload).

### 3.2 Visite (`ReferralTrackingService::trackVisit`)
Ordre des gardes : IP blacklistée → fingerprint du parrain lui-même (auto-parrainage
mémorisé 30 j) → bot (UA connus, HEAD, absence d'Accept-Language) → dédoublonnage
même fingerprint < 24 h → cap visites/jour (au-delà : loggée mais non comptée + alerte
admin 1×/jour). Visite comptée → `referral_visits` + `referral_shares_count++` +
évaluation des paliers « visites » si le compteur **franchit exactement** un seuil.

### 3.3 Inscription (`attributeSignup`, branché dans AuthController + SocialAuthController)
Cookie `lz_ref` (ou `ref_code`) → parrain résolu et éligible → `referral_signups`
status `pending` + `users.referred_by_id`. Invalidations immédiates (+ alerte admin) :
email jetable/blacklisté, IP blacklistée, fingerprint du parrain, fingerprint déjà vu
sur une autre attribution (multi-comptes). Comptes provider (Google) : considérés
validés d'office (email vérifié par le fournisseur). Toute erreur de tracking est
avalée (`report()`) — ne fait JAMAIS échouer une inscription.

### 3.4 Validation = seul déclencheur (`ReferralRewardService::onSignupValidated`)
Branché dans `AuthController::verifyEmail` (le hook Laravel natif n'est pas utilisé ici :
vérification manuelle par lien signé). `pending → valid` + `referral_signups_count++`
→ cap inscriptions/jour (au-delà : comptée mais évaluation gelée + alerte admin,
relançable via endpoint) → bonus filleul → job **`EvaluateReferralRewards`** en file
(délai = âge minimum du compte si configuré).

### 3.5 Évaluation & attribution (`evaluate`)
Transaction + `lockForUpdate` sur le parrain → zéro double crédit, jobs concurrents ou
rejoués inclus. Cap mensuel appliqué (y compris pendant une évaluation qui débloquerait
plusieurs paliers d'un coup ; paliers ≤ 1 inscription exemptés). Pour chaque palier
actif : compteur selon `condition_type`, `repeatable` (multiples), `max_grants_per_user`
→ `grantReward` : ledger + livraison + notification in-app parrain + **Telegram admin**.

### 3.6 Livraison
| Type | Mécanique |
|---|---|
| `pro_days` | Ligne `payments` amount 0, method `referral`, `transaction_id` dérivé du grant (idempotent), `expires_at = max(now, expiry courant) + days` + profile → `pro`. Intégrée au moteur d'expiration existant. **Premium actif** : pas de déclassement → coupon de valeur équivalente (jours × prix Pro/30). Profil absent (anciens comptes) : créé comme `ensureProfileExists`. |
| `percent_discount` / `coupon` | Création d'un `DiscountCode` unique (max_uses 1, +30 j, types `percent`/`fixed`) → consommé tel quel par le checkout existant. |
| `ebook` / `premium_ebook` | Fichier sur disque `local` privé (chemin jamais exposé) → endpoint téléchargement tokenisé, 3 max, status → `delivered`. |
| `physical_book` / `gift` | Le parrain saisit son adresse (`claim`) → alerte admin → l'admin marque `delivered` depuis le registre. |

---

## 4. Endpoints

### Public
- `POST /api/referral/track` — visite + cookie (throttle 60/min).
- `GET /api/referral/summary` — programme actif + paliers publics (page marketing).

### Utilisateur (auth:sanctum)
- `GET /api/referral/me` — code, lien, compteurs, paliers avec **progression %**
  (ex. 7/10 → 70 %, `remaining`), grants.
- `GET /api/referral/me/grants` — historique.
- `POST /api/referral/me/grants/{grant}/claim` — adresse (livraison physique).
- `GET /api/referral/me/grants/{grant}/download` — ebook (3 max).

### Admin (`auth:sanctum` + `admin`, POST partout — WAF OpenPanel bloque PUT/DELETE)
- `GET|POST /api/admin/referral/settings`
- `GET|POST /api/admin/referral/rewards` · `POST .../{reward}` · `POST .../{reward}/toggle` · `POST .../{reward}/delete` (refusée si déjà attribuée → désactiver)
- `GET /api/admin/referral/stats` — parrains, filleuls, visites, inscriptions validées, conversion, récompenses par type, coût estimé (Σ unit_cost), top 10, séries 30 j
- `GET /api/admin/referral/users?sort=referral_signups_count|referral_shares_count` — **classement** (colonnes indexées), filtres search/min, paginé
- `POST /api/admin/referral/users/{user}/evaluate` — relance d'évaluation (après revue de cap)
- `POST /api/admin/referral/users/{user}/toggle-block` — geler/dégeler du programme
- `GET /api/admin/referral/grants` · `POST .../{grant}/deliver` · `POST .../{grant}/cancel`
- `GET|POST /api/admin/referral/blacklists` · `POST .../{blacklist}/delete`
- `GET /api/admin/referral/visits` · `GET /api/admin/referral/signups` — audit

## 5. Notifications admin (Telegram, chat `services.telegram.chat_id`)
`TelegramNotificationService::notifyAdmin()` (nouvelle méthode générique, **sans
parse_mode** : les noms d'utilisateurs arbitraires cassent le parsing Markdown).
Déclencheurs : 🎁 palier atteint · 🚧 cap visites/jour · 🚧 cap inscriptions/jour ·
🚧 cap récompenses/mois · ⚠️ inscription suspecte · 📦 livre à expédier.
Anti-spam : clé d'événement → 1 notification/jour max (`Cache::add`).
Coupable via `referral_notify_admin=false`.

## 6. Anti-fraude (résumé)
Bots filtrés (UA/HEAD/Accept-Language) — Cloudflare Bot Fight en étage 1 ·
auto-parrainage bloqué (fingerprint mémorisé à la vue de son propre lien) ·
multi-comptes (1 attribution par fingerprint, `unique(filleul)` DB) ·
emails temporaires (blacklist seedée + CRUD admin) · caps journaliers/mensuels avec
alertes admin · dédoublonnage visites 24 h · comptes provider traités comme vérifiés ·
action a posteriori : `toggle-block` + annulation des grants. RGPD : IP en HMAC,
cookie first-party fonctionnel (à mentionner dans la politique de confidentialité).

## 7. Cas limites couverts
Programme désactivé en vol (plus de tracking/évaluation, grants conservés) · palier
modifié/supprimé (idempotence DB, suppression refusée si déjà attribué) · filleul
supprimé (historique conservé, compteur non décrémenté) · parrain bloqué (plus
d'évaluation) · cookie expiré (pas d'attribution) · premium qui gagne du Pro (coupon
équivalent) · double évaluation concurrente (lock) · job rejoué (idempotent) ·
profils manquants (créés comme ensureProfileExists) · seuils franchisés par saut
(endpoint `evaluate` admin).

## 8. Tests & déploiement

**Tests** : `tests/Feature/ReferralTest.php` — 15 tests / 68 assertions (tracking,
dédoublonnage, bots, self-ref, attribution cookie, email temporaire, palier → Pro,
idempotence, palier visites, cap mensuel, conversion premium→coupon, CRUD admin,
autorisation non-admin, stats/classement). Suite complète : 107 tests, 1 échec
préexistant hors périmètre (`WhatsAppDemandNotificationTest` — insert dans la colonne
générée `effective_price` sous SQLite, introduit par 1c5cd88).

**Déploiement** (à jouer par le propriétaire) :
```bash
php artisan migrate --force                       # 6 migrations 2026_09_07_*
php artisan db:seed --class=ReferralSeeder        # réglages + 6 paliers + blacklists
php artisan test --filter=ReferralTest            # smoke
```
Puis côté admin : **Marketing → Parrainage** → activer `referral_enabled`, vérifier les
paliers et les caps, activer le bonus filleul si souhaité. Côté front : appeler
`POST /api/referral/track` au chargement de la landing avec `?ref=` (avec credentials).
La purge 90 j est planifiée (`referral:purge-visits`, 03:50).
