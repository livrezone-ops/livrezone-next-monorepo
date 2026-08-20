# Admin — Page d'administration LivreZone

## Contexte

Développement d'une page d'administration `/admin` pour le frontend Next.js, adossée à des endpoints API Laravel protégés. Elle permet de gérer les utilisateurs, les annonces (listings) et le JSON du hero de la page d'accueil.

## Décisions (validées avec l'utilisateur)

1. **Hero JSON** → stocké en **base Laravel** (table `hero_messages`), survit aux déploiements. La home page fetch l'API avec repli sur le fichier local `frontend/data/hero-messages.json`.
2. **Activation/désactivation des users** → ajout d'une **migration ciblée** (colonne `is_active` sur `users`, défaut `true`).
3. **Reset mot de passe** → **reporté** (doit refaire le login côté standard email/mot de passe ; Google seul actuellement).
4. **Sécurisation `/admin`** → **403** explicite pour un utilisateur connecté non-admin ; **redirection `/login`** pour un non-connecté.
5. **Commandes artisan admin** → ajout de `make_admin`, `is_admin`, `revoke_admin` (par id utilisateur, avec confirmation `y/n`).

## Modifications effectuées

### Backend Laravel — `api-next.livrezone.com`

**Migrations**
- `database/migrations/2026_08_20_000001_add_is_active_to_users_table.php` — colonne `is_active` (bool, défaut `true`, indexée).
- `database/migrations/2026_08_20_000002_create_hero_messages_table.php` — table `hero_messages` (langue, direction, titre, description, actions, `is_active`, `sort_order`).

**Modèles**
- `app/Models/User.php` — ajout de `is_active` dans `$fillable` et `$casts`.
- `app/Models/HeroMessage.php` — nouveau modèle + méthode `toHeroMessageShape()` alignée sur le type `HeroMessage` frontend.

**Middleware**
- `app/Http/Middleware/EnsureAdmin.php` — 401 si non authentifié, 403 si `!is_admin`.
- `bootstrap/app.php` — enregistrement de l'alias middleware `'admin' => EnsureAdmin::class`.

**Contrôleurs**
- `app/Http/Controllers/Api/AdminController.php` — endpoints :
  - `GET /admin/users` (liste + stats : total, actifs, désactivés, en ligne ; agrégation des sessions pour "connecté/hors ligne")
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
- `app/Http/Controllers/Api/Auth/SocialAuthController.php` — bloque le login des comptes `is_active=false` (redirection `/login?error=account_disabled`).

**Seeder**
- `database/seeders/HeroMessagesTableSeeder.php` — seed des 8 messages hero (FR/AR) existants.
- Ajout au `DatabaseSeeder`.

**Commandes artisan** — `routes/console.php`
- `make_admin {user}` — promeut admin (id) avec confirmation y/n.
- `is_admin {user}` — vérifie le rôle admin (id).
- `revoke_admin {user}` — retire le rôle admin (id) avec confirmation.

### Frontend Next.js — `next.livrezone.com/frontend`

- `app/admin/page.tsx` — page `/admin` sécurisée côté serveur (403 non-admin, redirect login).
- `components/AdminClient.tsx` — interface à 3 onglets : **Utilisateurs** / **Annonces** / **Hero** (tableaux, filtres, recherche, bulk actions, éditeur JSON).
- `app/page.tsx` — le hero charge désormais les messages depuis `GET /api/hero-messages` (SSR, `revalidate: 300`, repli sur le fichier local).

## Déploiement effectué

- Migrations exécutées dans `php-fpm-8.5` :
  ```
  docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan migrate
  docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan db:seed --class=HeroMessagesTableSeeder
  ```
- Endpoint public `/api/hero-messages` testé OK (8 messages renvoyés).
- Route protégée `/api/admin/users` → **401** sans session (middleware admin actif).
- Frontend : `lz` → build Next.js OK après correction de 2 erreurs TypeScript (`m` typé dans `page.tsx`, `getAvatarUrl(u.profile)` dans `AdminClient.tsx`).

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