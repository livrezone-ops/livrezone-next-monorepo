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

## Prochaines sessions

| Priorité | Sujet | Notes |
|---|---|---|
| Haute | Route [login] not defined | Middleware Authenticate → retour JSON 401 |
| Haute | Welcome page | Page d'accueil Next.js publique SEO |
| Moyenne | Annonces page | Liste publique avec filtres (catégorie, niveau, matière, prix, ville) + pagination |
| Moyenne | Profil / Bibliothèque | Page publique vendeur + bibliothèque dashboard |
| Faible | Couvertures uniformes | public_path vs Storage |
| Faible | Tri avancé / facettes | Sidebar filtres dashboard |
| Faible | Seeders | Cohérence nouvelle base |