# BRIEFING SESSION — Bug /librairies : total incomplet (Meilisearch ↔ MariaDB)
Date de préparation : 28/08 (après-midi) — à lire EN PREMIER dans la nouvelle session.

## 1. Symptôme
La page /librairies (et GET /api/libraries) n'affiche pas la totalité des librairies.
La base contient **4 profils `librairie`** (ids 1 ouahiblibrary, 2 rachidlibrary, 6 livrezone, 10 fournimax).

## 2. État vérifié le 28/08 après-midi (preuves fraîches, à ne PAS refaire)
- `GET /api/libraries` → renvoie les librairies (total < 4 selon les moments ; déjà observé 3, 2).
- **Index Meilisearch `profiles` : `numberOfDocuments: 3`** (attendu ≥ 4).
- **`fieldDistribution` : `profile_type` présent sur 2 docs seulement sur 3** → un doc stale SANS `profile_type` (le doc 8 `hafsaa-wifak` du diagnostic audit — jamais normalisé) + un doc librairie manquant.
- Tâches Meilisearch récentes : toutes `succeeded` (des `documentAdditionOrUpdate` sur `listings` actives à 10:33) → Meilisearch sain, le problème est côté Scout/Laravel.
- Hôte Meili : `http://192.168.1.202:7700`, clé dans `.env` (`MEILISEARCH_KEY`), résolution OK depuis code-server rootless.

## 3. Historique (section « RÉSOLU — 28/08 » de l'audit = INCOMPLÈTE, le bug a récidivé)
- 28/08 matin : doc du profil 2 (`rachidlibrary`) reconstruit à l'identique du `toSearchableArray()` et poussé via API → `total: 4` vérifié.
- **Récidive le jour même** : l'index est repassé à 3 docs. Cause racine NON traitée :
  `Scout ModelObserver::saved` appelle `unsearchable()` (suppression du doc) à chaque save d'un profil
  non-librairie (défaut `wasSearchableBeforeUpdate() = true`). Toute bascule `librairie → passionné(e)`
  (ex. compte test) supprime le doc ; il ne revient que si le profil est re-sauvé EN tant que librairie
  (via queue `SCOUT_QUEUE=database`). Entre-temps /librairies est faux.
- Preuves historiques : 8 suppressions réelles (tâches 3987, 4310, 4467, 4660, 4752, 5040, 5075, 5083)
  + 199 suppressions no-op le 27/08.

## 4. Plan de diagnostic (nouvelle session)
1. Identifier QUI disparaît maintenant : `curl -s -H "Authorization: Bearer $MEILISEARCH_KEY" 'http://192.168.1.202:7700/indexes/profiles/documents?limit=20'` et comparer aux ids SQL :
   `php artisan tinker` → `Profile::where('profile_type','librairie')->pluck('id','nickname')`.
2. Vérifier la tâche qui a supprimé le doc : `GET /tasks?indexUid=profiles&limit=20` (type documentDeletion, dates/uids).
3. Corréler avec les `updated_at` des profils non-librairies → confirmer le mécanisme observer.
4. Vérifier la queue : `php artisan queue:failed` / table `jobs` (`SCOUT_QUEUE=database`) — une suppression en attente peut rejouer APRÈS une réparation manuelle (piège : réparer l'index sans vider la queue = réparé puis re-supprimé).

## 5. Fix proposé (traiter la CAUSE, pas seulement resynchroniser)

> ✅ **TRAITÉ le 28/08 soir (commit `4fe0df1`, poussé)** — voir section « ✅ RÉSOLU (définitif) » de l'audit : anti-dérive `Profile` livrée, resync quotidien 03:30 en place, test unitaire 5 cas (79/79), réindexation + suppression du doc stale 8 effectuées, `GET /api/libraries` total: 4 stable. Cause précise de la récidive : jobs de suppression Scout en retard rejoués à 01:07 UTC, 13 min après la réparation manuelle (piège §4.4 confirmé).
- [ ] **Anti-dérive dans `app/Models/Profile.php`** (option hygiène de l'audit, à implémenter) :
  hook `saving` capturant le `profile_type` pré-save + override `wasSearchableBeforeUpdate()`
  pour qu'un profil qui RESTE librairie ne soit jamais marqué unsearchable, et qu'une bascule
  librairie → autre déclenche la suppression UNE fois proprement (pas de tempête no-op).
- [ ] **Réindexation officielle** : `php artisan scout:import "App\\Models\\Profile"` (19 profils) — normalise aussi le doc 8 (ajout de `profile_type`).
- [ ] **Garde-fou** : resync quotidien de l'index `profiles` dans `routes/console.php` (après `app:process-subscriptions` 03:00) — auto-heal < 24 h.
- [ ] **Test** : unitaire sur l'observer (save librairie → doc présent ; bascule → doc absent ; re-bascule → doc présent), + vérif `GET /api/libraries` total: 4 stable après plusieurs saves de profils.

## 6. Rappels d'environnement (28/08, post-migration)
- Tout se lance depuis code-server rootless : `php artisan` OK (DNS `mariadb`), tests `php vendor/bin/phpunit` OK (74/74 au 28/08).
- Meilisearch joignable sur `http://192.168.1.202:7700` (clé = `MEILISEARCH_KEY` du `.env`).
- Cache front `/librairies` : Next `revalidate: 60` — après fix, forcer la revalidation ou attendre 60 s.
- Règle projet : ne jamais supprimer une fonctionnalité ; comparer avant/après ; commit + push
  (push : `GIT_SSH_COMMAND='ssh -i /home/ouahib/.ssh/id_ed25519' git push origin main` — clé GitHub côté hôte).
