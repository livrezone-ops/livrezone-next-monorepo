# PROMPT DE SESSION — NOTIFICATIONS (à coller tel quel dans le nouveau chat)

Tu es Cline, workspace `api-next.livrezone.com` (Laravel 13 API) + front `next.livrezone.com/frontend` (Next.js 16). Serveur casaos-server, conteneurs rootless (user 1001). Déploiement front : commande `lz` (build Next.js + restart conteneur + `optimize:clear`). API : live via bind mount (tout changement PHP est immédiatement en prod — valider `php -l` + tests avant de finir). Références : `.agents/AUDIT-2026-08-30.md` et `.agents/AUDIT-2026-08-25.md`.

## ÉTAT ACTUEL — À NE PAS REFAIRE
- Étape 1 (finir le site) quasi clôturée : redirections `/register` + `/demandes/create`, header (S'inscrire + topbar « Demander un livre »), formulaire de demande cloné sur ListingForm (recherche ISBN catalogue, catégories en cascade 3 niveaux, commentaire), règles React Compiler en `error` (0 violation), ESLint/TSC 0 erreur. Détails complets dans `.agents/AUDIT-2026-08-30.md`.
- Meili : settings auto-heal quotidien 03:40 sur les 4 index ; `scout:import Profile` fait (19 profils).
- PHP CLI hôte = 8.3 (redis/gd/intl installés) ; prod tourne dans le conteneur `php-fpm-8.5` :
  `sudo docker --context livrezone exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan <cmd>`

## OBJECTIF DE LA SESSION — REVOIR LA GESTION DES NOTIFICATIONS (page + paramétrage)

État existant à auditer AVANT de toucher (règle projet : ne jamais supprimer une fonctionnalité, documenter avant/après) :
- Front : `app/dashboard/notifications/page.tsx` (liste des notifications, préférences, statut Telegram ; déjà refactoré conformité React Compiler) — commencer par une lecture complète
- API : endpoints `/profile/notifications` (liste + préférences), `/profile/telegram/link` (génération lien) ; notifications transactionnelles Laravel (`Notification` facade / channels `mail` + `telegram` ?) — cartographier d'abord : quelles notifications existent (ordre reçu, demande matchée, abonnement, admin...), quels canaux, quelles préférences persistées (table ? colonnes JSON ?)
- Telegram : bot existant (token/chat dans `.env`, utilisé par le backup) — vérifier ce qui est déjà branché côté utilisateur

Plan d'exécution proposé (à ajuster avec le propriétaire) :
1. **Audit** : cartographier toutes les notifications émises (côté API : grep `Notification::send`, `->notify(`, mailables) + le schéma de préférences + le rendu front actuel. Présenter le tableau avant de coder.
2. **Page** : revoir la liste des notifications (lisibilité, non-lues/lues, mark-as-read, pagination, états vides, mobile).
3. **Paramétrage** : revoir le bloc préférences (par type × par canal : in-app / e-mail / Telegram), persistance côté API, toggle optimiste, feedback visuel.
4. **Telegram** : clarifier le flow de liaison du compte (génération du lien, deep-link bot, statut connecté/déconnecté) et le rendre évident dans la page.
5. **Clôture** : ESLint 0 erreur (règles React Compiler en `error` — ne pas réintroduire de `set-state-in-effect`), TSC 0 erreur, `php -l` + tests backend verts, audit `.agents/AUDIT-2026-08-30.md` mis à jour, puis demander au propriétaire de lancer `lz`.

## RÈGLES PROJET (impératives)
- Ne JAMAIS supprimer une fonctionnalité existante sauf remplacement amélioré et documenté (comparer avant/après).
- Terminer chaque ticket par : lint/eslint OK, tests OK, audit mis à jour.
- AbortController sur tout fetch en useEffect (P3, au fil de l'eau).
- Commence par l'audit (point 1) et présente ton plan détaillé AVANT toute modification.
