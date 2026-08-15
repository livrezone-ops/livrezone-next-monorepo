# Roadmap LivreZone — Session 4 & 5 (14/08/2026)

## Fonctionnel en production

- Auth Google OAuth (Sanctum + Socialite)
- Complétion de profil (villes, logo, nickname)
- Dashboard listing : liste, inline-edit, update status (sold/deleted/archived), republish, bulk-status, bulk-discount
- Création d'annonce (formulaire complet + recherche ISBN)
- Édition d'annonce (photo, ISBN, PUT)
- Listing detail public (client-side, TanStack Query, policy par statut)
- Messages Toast (hook useToasts)
- Quantité forcée à 1, validation backend catégorie/niveau/matière

## Welcome page (accueil public SEO)

- Hero carrousel dynamique (mur éditorial de couvertures, messages JSON fr/ar, RTL, auto-play)
- 7 grilles horizontales (récemment ajoutés, scolaire, romans, mangas & BD, jeunesse, universitaire, religion)
- Bannière vente + section « Pourquoi LivreZone » (scroll horizontal sur mobile)
- Titres SEO (H1 unique visible, H2 par section, métas, JSON-LD)
- Messages hero configurable via `data/hero-messages.json` (préparé pour migration table Laravel)
- Nombre de couvertures du hero configurable via `.env` (`HERO_COVERS_NUMBER_PER_SECTION`)

## Prochaines sessions

| Priorité | Sujet | Notes |
|---|---|---|
| Haute | Route [login] not defined | Middleware Authenticate → retour JSON 401 |
| Haute | Déployer welcome page | Build + rebuild conteneur `livrezone-next` |
| En cours | Annonces page | SEO : SSR liste + filtres, generateMetadata par filtre, canonical, H1/breadcrumb, JSON-LD (BreadcrumbList + ItemList), codes filtres alignés base. Reste : filtre matière, prix, ville |
| Moyenne | Profil / Bibliothèque | Page publique vendeur + bibliothèque dashboard |
| Moyenne | Hero messages via API Laravel | Remplacer `hero-messages.json` par une table + endpoint |
| Faible | Couvertures uniformes | public_path vs Storage |
| Faible | Tri avancé / facettes | Sidebar filtres dashboard |
| Faible | Seeders | Cohérence nouvelle base |

## Détail SEO page /annonces (fait, à déployer)

- SSR : la grille, le H1, le compteur et le breadcrumb sont rendus côté serveur (plus de spinner au crawl).
- `generateMetadata` par variante de filtre (catégorie, niveau, état, recherche) : title/description/OG uniques.
- `canonical` normalisé (paramètres triés, `page=1` retiré) ; `noindex, follow` sur les paginations > 1.
- JSON-LD BreadcrumbList + ItemList.
- Codes de filtres alignés sur la base (`SCOLAIRE`, `1BAC`, ...) via `lib/reference-data.ts`.
- Fichiers : `app/annonces/page.tsx`, `components/ListingsSearch.tsx`, `lib/listings-api.ts`, `lib/reference-data.ts`.

## Bug corrigé (page /annonces)

- Fetch client pointait sur `NEXT_PUBLIC_API_URL + /api/listings` → `…/api/api/listings` (404) → mockups affichés après un clic filtre.
- Fix : normalisation de la base URL (retrait du `/api` final), adoption des données SSR à chaque navigation (plus de double appel), suppression du fallback mock (jamais de fausses données).
- Pluriel du compteur (`1 annonce` / `N annonces`).

## Page /annonces alignée sur dev.livrezone.com/annonces

- Sidebar `FilterSidebar.tsx` : portage de `filter-sidebar.blade.php` — accordéons (Catégories en arbre, Langues, Audience/Niveau grisé hors catégorie scolaire, État, Prix avec double slider), boutons Appliquer/Effacer, drawer mobile.
- API `ListingController::index` étendu : multi-catégories/niveaux/langues/états (CSV de codes) + prix (`min_price`/`max_price`) + compat params historiques (`c`, `l`, `lvl`, `cond`, `min`, `max`) avec inclusion des enfants + affinage parent/enfant.
- Layout page : fil d'Ariane, H1 « Annonces », compteur d'articles, tri, bascule grille/liste, pagination chiffrée.
- SEO conservé : SSR + `generateMetadata` multi-filtres + canonical + JSON-LD.
- Fichiers : `app/annonces/page.tsx`, `components/FilterSidebar.tsx`, `components/ListingsSearch.tsx`, `lib/listings-api.ts`, `lib/listings-filters.ts`, `lib/reference-data.ts`, `app/Http/Controllers/Api/ListingController.php`.