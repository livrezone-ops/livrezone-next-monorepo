# PROMPT DE SESSION — 30/08 (à coller tel quel dans le prochain chat)

Tu es Cline, workspace `api-next.livrezone.com` (Laravel 13 API) + front `next.livrezone.com/frontend` (Next.js 16). Serveur casaos-server, conteneurs rootless (user 1001, DOCKER_HOST=unix:///run/user/1001/docker.sock).

## ÉTAT AU 30/08 — À NE PAS REFAIRE
- Étape 0-bis backup Google Drive : ✅ CLÔTURÉE (rclone gdrive-livrezone, cron 04:15, restauration testée 34/34 tables, Telegram validé dans les 2 sens). Détails : `.agents/AUDIT-2026-08-30.md` + `/home/ouahib/lz-backup/README-lz-backup.md`.
- Tests backend : 84/84 verts (257 assertions). Watchdog Caddy clos, Redis rétabli, incident Meili 29/08 résolu.
- Miniatures 640 : ANNULÉES par décision propriétaire (ne pas les traiter).
- Fix formulaire annonce : API live via bind mount ; les commits front existent (`71bc9b1`, `f9715cd` = 1ʳᵉ suggestion ISBN sur Entrée ; `9a5ae4d` = prix step 0.01) mais le front N'EST PAS redéployé.

## OBJECTIF DE LA SESSION — ÉTAPE 1 : FINIR LE SITE (produit)
Plan détaillé : `.agents/AUDIT-2026-08-30.md` § PROCHAINE ÉTAPE. Références : `.agents/AUDIT-2026-08-25.md` (§ Revue des parcours publics).

Ordre d'exécution :
1. **Redéploiement front `lz`** (demande-moi la commande de build/deploy habituelle) puis re-test visuel du formulaire d'annonce (ISBN + prix).
2. **P1 — Redirection `/register`** : `app/register/` n'existe pas (404 direct ; inscription = onglet de `/login`). Rediriger vers `/login?tab=register` (next.config redirects ou middleware) — vérifier que les e-mails/links qui pointent vers /register aboutissent.
3. **P1 — Redirection `/demandes/create`** : 404 en accès direct (`app/demandes/page.tsx`, `app/demandes/DemandesClient.tsx`). Rediriger vers le flow de création existant (OrderBookButton côté /books), message si non connecté.
4. **P2 — CTA « Créer une demande »** sur `/demandes` (visible connecté + invité → renvoi login).
5. **P2 — CTA « S'inscrire »** dans `components/Header.tsx` → `/login?tab=register`.
6. **P1 — Résilience settings Meili** côté front : fallback gracieux si `/indexes/*/settings` échoue (facettes/filtres) ; côté API vérifier que les 4 jobs `*:configure-search` rejouent les settings après restauration.
7. **Clôture** : repasser les 3 règles React Compiler en `error` dans `frontend/eslint.config.mjs` (`react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react-hooks/static-components`), CI verte (eslint+tsc, pint+phpunit), push GitHub, mise à jour `.agents/AUDIT-2026-08-30.md` (cocher ce qui est fait).

Sur chaque fichier touché : ajouter AbortController sur les fetch en useEffect (P3, au fil de l'eau).

## RÈGLES PROJET (impératives)
- Ne JAMAIS supprimer une fonctionnalité existante sauf remplacement amélioré et documenté ; toute bascule compare avant/après.
- URL API : centraliser si touché (dette P5 — 39 usages hardcodés), sinon ne pas élargir le périmètre.
- Ne rien casser côté prod : l'API sert via bind mount (tout changement PHP est immédiatement live) — valider `php artisan` + tests avant de finir.
- Terminer chaque ticket par : lint/eslint OK, tests OK, audit mis à jour.

Commence par m'afficher ton plan d'exécution pas à pas, puis enchaîne sur le point 1.
