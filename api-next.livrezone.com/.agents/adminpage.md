# Admin — Page d'administration LivreZone

## Contexte

Développement d'une page d'administration `/admin` pour le frontend Next.js, adossée à des endpoints API Laravel protégés. Elle permet de gérer les utilisateurs, les annonces (listings) et le JSON du hero de la page d'accueil.

## Décisions (validées avec l'utilisateur)

1. **Hero JSON** → **source de vérité = fichier local** `frontend/data/hero-messages.json`. L'admin lit le fichier, l'édite sous forme de **tableau** (lignes éditables), et l'enregistrement **réécrit le fichier**. La home page lit directement le fichier. La table `hero_messages` et ses endpoints ne sont plus consommés par le frontend (conservés côté API, non utilisés).
2. **Activation/désactivation des users** → ajout d'une **migration ciblée** (colonne `is_active` sur `users`, défaut `true`).
3. **Statut "en ligne"** → basé sur la **colonne `last_login_at`** sur `users` (remplie à chaque connexion), et non sur la table `sessions` (peu fiable : `user_id` NULL pour la plupart des sessions). Fenêtre "en ligne" : **5 minutes** (`ONLINE_WINDOW_SECONDS = 300`).
4. **Sécurisation `/admin`** → **403** explicite pour un utilisateur connecté non-admin ; **redirection `/login`** pour un non-connecté.
5. **Commandes artisan admin** → ajout de `make_admin`, `is_admin`, `revoke_admin` (par id utilisateur, avec confirmation `y/n`).
6. **Reset mot de passe** → **reporté** (doit refaire le login côté standard email/mot de passe ; Google seul actuellement).

## Modifications effectuées

### Backend Laravel — `api-next.livrezone.com`

**Migrations**
- `database/migrations/2026_08_20_000001_add_is_active_to_users_table.php` — colonne `is_active` (bool, défaut `true`, indexée).
- `database/migrations/2026_08_20_000002_create_hero_messages_table.php` — table `hero_messages` (langue, direction, titre, description, actions, `is_active`, `sort_order`).
- `database/migrations/2026_08_20_000003_add_last_login_at_to_users_table.php` — colonne `last_login_at` (timestamp nullable) sur `users`.

**Modèles**
- `app/Models/User.php` — ajout de `is_active` dans `$fillable` et `$casts` ; ajout de `last_login_at` (fillable + cast `datetime`) ; nouvelle méthode `isOnline(int $windowSeconds = 300): bool`.
- `app/Models/HeroMessage.php` — nouveau modèle + méthode `toHeroMessageShape()` alignée sur le type `HeroMessage` frontend.

**Middleware**
- `app/Http/Middleware/EnsureAdmin.php` — 401 si non authentifié, 403 si `!is_admin`.
- `bootstrap/app.php` — enregistrement de l'alias middleware `'admin' => EnsureAdmin::class`.

**Contrôleurs**
- `app/Http/Controllers/Api/AdminController.php` — endpoints :
  - `GET /admin/users` (liste + stats : total, actifs, désactivés, en ligne ; statut "connecté/hors ligne" et filtre **basés sur `last_login_at`**, fenêtre 5 min)
    - **Correction** : la réponse renvoie désormais la collection transformée (avec `connection.online`), et non plus les modèles bruts — le champ `connection` était calculé puis **jamais renvoyé** (d'où l'affichage systématique "Hors ligne"). Le statut en ligne est calculé via **`User::isOnline()`** (cohérent avec `/api/user`).
    - **Optimisation** : `listings_count` par utilisateur en N+1 remplacé par un seul `GROUP BY user_id`. Helper mort `sessionStatsForUsers()` supprimé.
  - `POST /admin/users/{user}/status` (`is_active` true/false)
  - `GET /admin/listings` (filtres : online, offline, pending, archived, deleted + recherche + tri + compteurs par statut)
  - `POST /admin/listings/bulk-status` (bulk : activate/deactivate/delete)
  - `POST /admin/listings/{listing}/status` (action single)
  - `GET /admin/hero-messages`
  - `PUT /admin/hero-messages` (remplace tous les messages, en transaction)
- `app/Http/Controllers/Api/HeroController.php` — endpoint **public** `GET /hero-messages` (messages actifs).

**Routes** — `routes/api.php`
- `Route::get('/hero-messages', [HeroController::class, 'index'])` (public)
- Groupe `Route::middleware(['auth:sanctum','admin'])->prefix('admin')` pour users/listings/hero.

**Auth**
- `app/Http/Controllers/Api/Auth/SocialAuthController.php` — bloque le login des comptes `is_active=false` (redirection `/login?error=account_disabled`) ; **remplit `last_login_at = now()`** à chaque connexion (user existant et nouveau).
- `routes/api.php` — `GET /user` expose désormais `is_online` (via `User::isOnline()`).

**Seeder**
- `database/seeders/HeroMessagesTableSeeder.php` — seed des 8 messages hero (FR/AR) existants.
- Ajout au `DatabaseSeeder`.

**Commandes artisan** — `routes/console.php`
- `make_admin {user}` — promeut admin (id) avec confirmation y/n.
- `is_admin {user}` — vérifie le rôle admin (id).
- `revoke_admin {user}` — retire le rôle admin (id) avec confirmation.

### Frontend Next.js — `next.livrezone.com/frontend`

- `app/admin/page.tsx` — page `/admin` sécurisée côté serveur (403 non-admin, redirect login). Lit `searchParams` (`tab`, `filter`) pour initialiser l'onglet et le filtre. **Par défaut**, l'onglet **Annonces** est ouvert avec le filtre **`pending_admin`** (statut "En attente"). Deep-link possible : `/admin?tab=users` ou `/admin?tab=listings&filter=pending`.
- `components/AdminClient.tsx` — interface à 3 onglets : **Utilisateurs** / **Annonces** / **Hero** (tableaux, filtres, recherche, bulk actions, éditeur JSON).
  - Onglet **Annonces** : ouvert par défaut, filtré sur `pending_admin` ; boutons de filtre (Tout / En ligne / Hors ligne / En attente / Archivé / Supprimé) avec compteurs par statut.
  - Onglet **Utilisateurs** : colonne **Dernière connexion** (affiche `last_login_at`), badge En ligne/Hors ligne (basé sur `connection.online` renvoyé par l'API via `User::isOnline()`).
  - Onglet **Hero** : éditeur sous forme de **tableau éditables** (ajout/suppression de lignes), plus de textarea JSON.
- `components/Header.tsx` — lien **Administration** dans le menu déroulant utilisateur, affiché uniquement si `user.is_admin`.
- `hooks/useAuth.ts` — ajout de `is_admin?: boolean` dans l'interface `User`.
- `app/api/hero-messages/route.ts` — route Next.js (GET/PUT) qui lit/écrit `data/hero-messages.json` (PUT protégé : admin uniquement).
- `app/page.tsx` — le hero lit désormais les messages depuis le fichier local `data/hero-messages.json` (source de vérité).

## Déploiement effectué

- Migrations exécutées dans `php-fpm-8.5` :
  ```
  docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan migrate
  docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan db:seed --class=HeroMessagesTableSeeder
  ```
- La migration `2026_08_20_000003_add_last_login_at_to_users_table` a été appliquée (batch 13) ; `last_login_at` renseigné pour les comptes s'étant re-connectés.
- Endpoint public `/api/hero-messages` testé OK (8 messages renvoyés).
- Route protégée `/api/admin/users` → **401** sans session (middleware admin actif).
- Frontend : `lz` → build Next.js OK.

> **État (post-déploiement `lz`)** : la refonte "en ligne" sur `last_login_at` est déployée. Correctif appliqué côté backend — `GET /admin/users` renvoyait les modèles bruts sans le champ `connection` (statut "Hors ligne" affiché pour tous) ; désormais la collection transformée est renvoyée et le statut en ligne utilise `User::isOnline()`. `/admin` ouvre par défaut sur l'onglet **Annonces** filtré sur `pending_admin`.

## Commandes artisan (gestion admin)

```bash
# depuis la machine serveur, conteneur Laravel
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec -it php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan make_admin 1
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec -it php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan is_admin 1
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec -it php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan revoke_admin 1
```

## Sujets ouverts / à venir

- Login + inscription **standard** (email + mot de passe) pour remplacer l'unique Socialite → nécessaire pour la réinitialisation de mot de passe côté admin.
- Page frontend de réinitialisation de mot de passe.
- Le bouton "envoyer demande de changement de mot de passe" est désactivé en attendant.

## Note technique

- La base réelle est `nextlivrezonebd` (la doc mentionne `nextlivrezonedb` — la réalité prime).
- `docker exec --workdir` n'est pas honoré sur ce setup → toujours utiliser le chemin absolu `php /var/www/html/api-next.livrezone.com/artisan`.