# WISHLIST & CART — MÉTHODOLOGIE COMPLÈTE

Document de référence pour toute évolution des modules **Wishlist (Favoris)** et **Panier (Cart)**.
Il décrit l'architecture de bout en bout : règles fonctionnelles, backend Laravel, frontend Next.js, et pièges à connaître.

---

## 1. RÈGLES FONCTIONNELLES

### Wishlist (Favoris) ❤️
- Sauvegarde des coups de cœur pour consultation ultérieure.
- Bouton Cœur sur les BookCards (overlay hover) et sur la page détail.
- Compteur dynamique dans le Header (icône Cœur).
- Action **toggle** : ajout / suppression instantanée.

### Panier (Cart) 🛒
- Préparation de commande / réservation sur une marketplace multi-vendeurs (livres neufs & occasions).
- Regroupement et ventilation des articles par vendeur.
- Bouton orange `#F97316` "Panier" sur le hover des BookCards et bouton d'action sur la page produit.
- Compteur dynamique dans le Header (icône Panier).

### Gestion des visiteurs (GUEST) — Règle des 24h
- Invité (non connecté) : chaque article enregistré dans `localStorage` avec `addedAt` / `expiresAt`.
- Tout élément de plus de 24h est purgé à l'ouverture de l'app ou à l'accès panier/wishlist.
- **Pop-up incitative** dès qu'un invité ajoute un article :
  - "Se connecter pour sauvegarder" (redirection Google OAuth) — bouton principal.
  - "Continuer en invité (valable 24h)" — bouton secondaire.

### Utilisateurs connectés & fusion (MERGE)
- Persistance permanente en base (`favorites` et `cart_items`), sans limite 24h.
- À la connexion : envoi des articles locaux valides (< 24h) via `/api/wishlist/merge` et `/api/cart/merge`, puis **suppression du localStorage**.

---

## 2. ARCHITECTURE TECHNIQUE

### Backend (Laravel API REST)
- **Wishlist = table `favorites`** (modèle `Favorite`). Ne PAS créer de table `wishlists` (l'existant prime).
- **Panier = table `cart_items`** (modèle `CartItem`) : `user_id`, `listing_id`, `quantity`, unique `[user_id, listing_id]`.
- Authentification : Sanctum (`auth:sanctum`). Bearer token ou cookies SPA.
- Validation stricte via FormRequests → 422. Réponses JSON cohérentes.

### Frontend (Next.js 16 — App Router)
- Store **React Context + localStorage** (pas de Zustand : non installé).
- React Query (TanStack) pour les données serveur des comptes connectés.
- Mises à jour optimistes (compteurs et boutons réactifs).
- Modale réutilisable `SaveCartModal`.

---

## 3. ENDPOINTS API

Tous sous `auth:sanctum` dans `routes/api.php`.

| Méthode | URL | Rôle |
|---|---|---|
| GET | `/api/wishlist` | Liste des favoris (avec listings + cover + user) |
| POST | `/api/wishlist` | Ajouter un favori (`listing_id`) — unique |
| DELETE | `/api/wishlist?listing_id={id}` | Retirer un favori (**query param**) |
| POST | `/api/wishlist/merge` | Fusion guest → compte (`listing_ids[]`) |
| GET | `/api/cart` | Panier groupé par vendeur + sous-totaux |
| POST | `/api/cart` | Ajouter un article (`listing_id`, `quantity` optionnel) — quantité bornée au stock |
| PUT | `/api/cart` | Màj quantité (`listing_id`, `quantity`) — bornée au stock |
| DELETE | `/api/cart?listing_id={id}` | Retirer un article (**query param**) |
| POST | `/api/cart/merge` | Fusion guest → compte (`items[{listing_id,quantity}]`) — quantités cumulées **bornées au stock** |

> **Format DELETE unifié** : `listing_id` est fourni **exclusivement en query string** (`DELETE /api/wishlist?listing_id=123`). Les FormRequests `WishlistDestroyRequest` / `CartDestroyRequest` valident ce query param (422 en cas d'absence/invalidité). Le frontend envoie désormais `api.delete(path, { params: { listing_id } })` (plus de body).

### Fichiers backend
- Contrôleurs : `app/Http/Controllers/Api/WishlistController.php`, `CartController.php`
- FormRequests : `app/Http/Requests/Api/` (WishlistStore/Destroy/Merge, CartStore/Update/Destroy/Merge)
- Modèle `User` : trait `HasApiTokens` (Sanctum) obligatoire pour les tokens.

---

## 4. FRONTEND — STORE `lib/commerce-store.tsx`

### Rôles
- Source de vérité **guest** = `localStorage` (clés `livrezone_wishlist_v1`, `livrezone_cart_v1`).
- Source de vérité **connecté** = serveur via React Query (queries `["commerce","wishlist"]` et `["commerce","cart"]`).

### Cycle de vie
1. **Hydratation au montage** : lecture + purge (> 24h) du localStorage.
2. **Persistance** : n'écrit dans localStorage que si `isAuthenticated === false` (jamais pour un connecté).
3. **Sync serveur** : si connecté, les données serveur remplacent l'état local.
4. **Merge à la connexion** : lit le localStorage, pousse via les endpoints merge, puis `safeRemove` des clés.
5. **Déconnexion** : purge localStorage + état vidé + `mergedForUserId.current = null`.

### Échec partiel de la fusion (comportement retenu)
- Chaque clé (`WS_KEY` / `CT_KEY`) est purgée **dès que son merge réussit**.
- Une clé dont le merge **échoue** est **conservée** dans le localStorage et sera **ré-essayée automatiquement** au prochain chargement/connexion (retry).
- La fusion n'est considérée complète que lorsque les deux merges ont abouti (ou qu'il n'y avait rien à fusionner).
- Pas de vidage inconditionnel en cas d'erreur : les données ne sont jamais perdues silencieusement.

### Actions exposées via `useCommerce()`
- `wishlist`, `cart`, `wishlistCount`, `cartCount`
- `cartSellers` (groupé par vendeur avec `itemCount`, `subtotal`, `phone`)
- `isInWishlist(id)`, `toggleWishlist(listing)`
- `isInCart(id)`, `cartQuantity(id)`, `addToCart(listing, qty?)` → **retourne `false` si déjà au panier**
- `removeFromCart(id)`, `updateCartQuantity(id, qty)` (clampé 1..availableQuantity)
- `guestModalOpen`, `guestItem`, `guestModalType`, `closeGuestModal`
- `isAuthenticated`
- `buildListingUrl(listing)` → URL page détail `/{nickname}/{id}-{isbn}-{slug}`
- `isListingAvailable(listing)` (exporté) → statut `published` ET stock > 0

### Types
- `StoreListing` : id, title, price, discountPrice, cover, coverThumb, isbn, user_id, sellerNickname, sellerPhone, city, availableQuantity, status, available
- `CartLine`, `CartSellerGroup`, `PersistedLine` (forme localStorage avec timestamps)

---

## 5. COMPOSANTS FRONTEND

| Composant | Fichier | Rôle |
|---|---|---|
| `CommerceProvider` | `lib/commerce-store.tsx` | Provider global (dans `app/providers.tsx`, sous `QueryClientProvider`) |
| `SaveCartModal` | `components/SaveCartModal.tsx` | Pop-up incitative guest (Google + continuer invité) |
| `CartCard` | `components/CartCard.tsx` | Ligne panier : thumbnail 160, quantité +/- (clamp), confirmation suppression |
| `FavoriteCard` | `components/FavoriteCard.tsx` | Carte favori compacte : thumbnail, Panier, suppression directe |
| Page `/cart` | `app/cart/page.tsx` | Sections par vendeur + WhatsApp + résumé |
| Page `/favorites` | `app/favorites/page.tsx` | Grille de FavoriteCard |
| Header | `components/Header.tsx` | Compteurs dynamiques + rendu `SaveCartModal` |
| BookCard | `components/BookCard.tsx` | Boutons Cœur + Panier (désactivé si déjà au panier) |
| ListingDetailsCard | `components/ListingDetailsCard.tsx` | Boutons favoris/panier + badge "Déjà au panier" |

---

## 6. RÈGLES UI & COMPORTEMENT (à respecter)

1. **Pas de ré-insertion** : si un article est déjà au panier, `addToCart` ne fait rien (retourne `false`) et les boutons affichent un état désactivé vert **"Déjà au panier"**.
2. **Quantité** : gérée uniquement dans la page panier. Min = 1, max = `availableQuantity` (ou 99). Boutons `+`/`-` désactivés aux bornes.
3. **Mention guest** : la mention "valable 24h" n'apparaît que si `!isAuthenticated`.
4. **Thumbnails** : utiliser `coverThumb` (160px) en priorité, fallback `cover`.
5. **Liens** : titre et couverture → `buildListingUrl` (page détail).
6. **Sections vendeur** : entête "Vendeur {nickname}".
7. **WhatsApp** : bouton "Envoyer le panier au vendeur" par section (si téléphone disponible).
8. **Confirmation suppression** : uniquement pour le panier (CartCard), pas pour les favoris.
9. **Mention paiement** : "Un service de récupération et de livraison sera bientôt disponible par le site" (pas de mention "paiement en ligne").
10. **Responsive** : lignes du panier sans chevauchement sur mobile (layout empilé).
11. **Listings indisponibles** : un listing est **indisponible** si `status !== "published"` OU stock `quantity = 0` (ou listing supprimé). Affichage grisé avec badge "Annonce indisponible" / "Indisponible", contrôles de quantité et bouton "Panier" **désactivés**, bouton retirer conservé.
12. **Clamp de stock (serveur + client)** : la quantité d'un panier est bornée par le stock du listing (`quantity`), plafonné à 99. Appliqué côté serveur (`store`, `update`, `merge`) ET côté client (`addToCart`, `updateCartQuantity`). Le merge cumule `qty_local + qty_serveur` puis borne au stock.

---

## 7. PIÈGES DÉJÀ RENCONTRÉS (importants)

### Bug du doublement de quantité au refresh ❗
- **Cause** : l'effet de persistance réécrivait les données serveur dans le localStorage une fois connecté ; au refresh, l'effet de merge relisait le localStorage (non vide) et re-fusionnait → `increment('quantity')` doublait les quantités.
- **Correctif (à NE PAS régresser)** :
  - La persistance n'écrit que si `isAuthenticated === false`.
  - Les timestamps originaux sont préservés (vrai TTL 24h, pas de reset à chaque écriture).
  - Purge du localStorage à la déconnexion.

### WAF Caddy bloque DELETE/PUT/PATCH ❗
- Le WAF Coraza/OWASP CRS (règle `911100` "méthodes autorisées") bloque DELETE sur `api-next.livrezone.com` et `livrezone.com`.
- **Correctif SCOPÉ (recommandé)** : ne PAS désactiver `911100` globalement. Créer un fichier d'exemptions ciblées et l'inclure **AVANT** les règles CRS :

  Fichier `/etc/openpanel/caddy/custom_waf_api.conf` :
  ```
  SecRule REQUEST_URI "@beginsWith /api/wishlist" "id:900001,phase:1,pass,nolog,ctl:ruleRemoveById=911100"
  SecRule REQUEST_URI "@beginsWith /api/cart"     "id:900002,phase:1,pass,nolog,ctl:ruleRemoveById=911100"
  ```

  Dans les domaines (`/etc/openpanel/caddy/domains/api-next.livrezone.com.conf` et `livrezone.com.conf`), remplacer la ligne globale `SecRuleRemoveById 911100` par `Include /etc/openpanel/caddy/custom_waf_api.conf`, placé **immédiatement après** `Include .../crs-setup.conf.example` et **avant** `Include .../rules/*.conf`.

  ⚠️ **Important** : l'Include d'exemption doit être chargé AVANT le CRS, sinon `911100` s'exécute avant le `ctl:ruleRemoveById` et le DELETE reste bloqué (403).
- Après modification : `docker exec caddy caddy validate --config /etc/caddy/Caddyfile` puis `reload`.
- **Vérification** : `DELETE /api/wishlist?listing_id=...` doit passer (atteindre Laravel), `DELETE` sur un autre chemin (ex: `/api/dashboard/...`) doit rester bloqué (403).

### Clamp de stock du panier ❗
- `store`, `update` et `merge` de `CartController` bornent la quantité au stock du listing (`quantity`, plafonné à 99).
- Le merge cumule `qty_local + qty_serveur` puis borne : si le total dépasse le stock, la quantité est saturée au stock et la réponse inclut `clamped` (nombre d'articles bornés).
- Test : `tests/Feature/CartMergeClampTest.php` (couvre `qty_local + qty_serveur > availableQuantity`).

### Règle DELETE uniforme (query param)
- `DELETE /api/wishlist?listing_id={id}` et `DELETE /api/cart?listing_id={id}` : le body n'est **jamais** utilisé.
- FormRequests : `WishlistDestroyRequest`, `CartDestroyRequest`.
- Frontend : `api.delete(path, { params: { listing_id } })`.

### Rollback des mises à jour optimistes
- Les mutations sont **optimistes** (état local mis à jour immédiatement), puis chaque action connectée appelle l'API et `queryClient.invalidateQueries({ queryKey: ["commerce"] })`.
- En cas d'erreur 422/500 : l'état optimiste reste affiché **jusqu'au refetch déclenché par l'invalidation**, qui re-synchronise depuis le serveur (rollback automatique via l'effet de galerie `setWishlist(serverWishlist)` / `setCart(lines)`).
- Pas de rollback manuel dans le store : le refetch serveur EST le mécanisme de rollback. Les erreurs sont silencieuses (`.catch(() => {})`) mais l'état converge vers le serveur.

### Isoler le panier par utilisateur
- **Connecté** : le panier est lié au `user_id` en base (clé unique `[user_id, listing_id]`).
- **Invité** : localStorage du navigateur (par appareil/navigateur). Chaque fenêtre privée a son propre panier — comportement voulu.
- La fusion transfert les lignes locales vers le compte, puis vide le localStorage.

### Modèle `User` sans `HasApiTokens`
- Ajouter `use Laravel\Sanctum\HasApiTokens;` et le trait dans `User` (sinon pas de `createToken`, pas de Bearer).

---

## 8. VIGILANCE ARCHITECTURE (pas d'action immédiate)

- Le Context React unique (`CommerceProvider`) englobe wishlist + cart + compteurs + header. Si l'app grossit, les re-renders peuvent devenir en cascade (chaque changement de wishlist/cart re-rend tous les consommateurs).
- Ne pas corriger maintenant ; surveiller les performances (métriques React, profiler si latence).
- Si besoin à terme : découper en stores séparés (wishlist / cart / modale), ou utiliser `useSyncExternalStore` pour isoler les abonnés.

---

## 9. MÉTHODOLOGIE D'EXÉCUTION (déjà utilisée)

1. Backend d'abord : contrôleurs, FormRequests, routes.
2. Tester sur le serveur (artisan indisponible sur la machine Windows) :
   - `php artisan route:list --path=wishlist` / `--path=cart`
   - `vendor/bin/pint` (fix auto) puis `--test`
   - Tests curl avec Bearer token (généré via tinker : `User::find(1)->createToken('...')->plainTextToken`)
   - Pour se connecter à la base depuis code-server : `DB_HOST=192.168.1.202 DB_PORT=32770 php artisan tinker ...`
3. Frontend ensuite : store, provider, modale, Header, BookCard, page détail, pages `/cart` et `/favorites`.
4. Vérifications : `npx tsc --noEmit`, `npm run lint` (fichiers modifiés uniquement), `npm run build`.
5. WAF Caddy si DELETE/PUT/PATCH bloqués.
6. Commit ciblé + push depuis `\\192.168.1.202\_data` (dépôt Git, pas le workspace).

---

## 10. GIT

Le dépôt Git principal se trouve dans `_data` (SMB `\\192.168.1.202\_data`).
```
git -C "\\192.168.1.202\_data" add <chemins>
git -C "\\192.168.1.202\_data" commit -m "feat(api+frontend): ..."
git -C "\\192.168.1.202\_data" push origin main
```
Voir `.agents/GIT.md` pour plus de détails.
