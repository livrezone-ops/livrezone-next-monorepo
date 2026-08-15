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
| Moyenne | Annonces page | Liste publique avec filtres (catégorie, niveau, matière, prix, ville) + pagination |
| Moyenne | Profil / Bibliothèque | Page publique vendeur + bibliothèque dashboard |
| Moyenne | Hero messages via API Laravel | Remplacer `hero-messages.json` par une table + endpoint |
| Faible | Couvertures uniformes | public_path vs Storage |
| Faible | Tri avancé / facettes | Sidebar filtres dashboard |
| Faible | Seeders | Cohérence nouvelle base |