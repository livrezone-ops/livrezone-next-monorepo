# Incident — Index Meilisearch `books` appauvri (2 champs sur 12) — 06/09/2026

## Constat (06/09, ~13h30)

Inspection de l'index `books` Meilisearch (697 172 documents, conforme aux 697 172 lignes MySQL) :

- **`fieldDistribution` : uniquement `id` (697 172) et `authors_list` (697 172)**.
- Tous les autres champs du `toSearchableArray` ont disparu des documents :
  `title`, `authors`, `isbn_13`, `publisher`, `cover_url`, `default_category_id`,
  `language_id`, `default_level_id`, `created_at`.
- Document exemple (`documents/1`) : `{"id":1,"authors_list":["Hippocrates",…]}`.

## Impact réel en production avant correction

- **Recherche titre/auteur/ISBN dégradée** : seule `authors_list` est searchable →
  chercher « petit » matche des noms d'auteurs, pas les titres.
- **Filtres et facettes inopérants** (catégories, langues, niveaux) : les attributs
  sont déclarés `filterable` côté settings mais absents des documents.
- **Tri `created_at` impossible** → la section « Nouveautés » de la vitrine `/books`
  (livrée ce jour) ne peut pas trier.
- L'hydratation MySQL par PK masque partiellement le problème (les fiches
  s'affichent avec les bonnes données UNE fois l'id trouvé — mais les ids
  retournés par Meili sont faux au regard de la recherche).

## Cause racine (archéologie)

- Aucune tâche document dans Meili entre le 03/09 et le 04/09 (que des
  `settingsUpdate` du cron 03:40).
- Tâches `documentAdditionOrUpdate` le **05/09 à 02h40** (lots de 5 000 docs,
  manuel — rien dans le scheduler à 02:40).
- Aucune commande du dépôt n'écrit `authors_list` seul (grep `addDocuments|updateDocuments`
  vide dans app/) → écriture effectuée hors dépôt (script/tinker ad-hoc, session
  du 04-05/09 sur le filtre auteur `authors_list` commité le 04/09 15h13).
- Hypothèse la plus probable : (re)création d'index + import de documents
  réduits à `{id, authors_list}` pour backfiller le filtre auteur, **remplaçant**
  les documents complets, avec l'intention d'un réimport complet jamais exécuté.

## Correction appliquée (06/09)

1. Règle projet respectée : **queue drainée vérifiée avant intervention**
   (`app:queue-health` : 0 en attente / 0 bloqué / 0 failed).
2. Réimport complet des documents via Scout (toSearchableArray complet) :
   ```bash
   DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec -d php-fpm-8.5 \
     sh -c "php /var/www/html/api-next.livrezone.com/artisan books:import-meili \
     --chunk=5000 > /var/www/html/api-next.livrezone.com/storage/logs/import-meili-books-20260906.log 2>&1"
   ```
   (697 172 docs, ~140 lots de 5 000, rythme observé ~500 docs/s)
3. Vérifications post-import : `fieldDistribution` complet, recherche « petit »
   renvoie des titres réels, facettes catégories/langues/niveaux, tri
   `created_at:desc` (les ids ~1,56 M créés le 29/08 doivent sortir en premier).
4. `books:configure-search` réexécuté par sûreté (idempotent).

## Leçons

- **Jamais d'écriture directe de documents partiels dans un index Meili en prod** —
  passer par Scout (`$model->searchable()`, toSearchableArray complet) ou faire un
  POST (merge) en connaissance de cause ; un PUT / une recréation d'index REMPLACE.
- Le garde-fou aurait été un check simple post-manipulation : `fieldDistribution`
  doit matcher les champs du toSearchableArray (candidat : étendre
  `app:queue-health` ou un check quotidien au cron 03:40, après configure-search).
- À ajouter au cron de 03:40 : vérification du fieldDistribution de `books`
  (alerte critical si champs manquants).

## Suivi

- [x] **Import terminé 06/09** : 697 172/697 172 documents, « ✅ Envoi terminé avec succès » (~55 min, lots de 5 000)
- [x] `fieldDistribution` complet : 12 champs × 697 172 docs (title, authors, authors_list, isbn_13, publisher, cover_url, default_category_id, language_id, default_level_id, **default_subject_id**, created_at, id)
- [x] Recherche « petit » → titres réels (« Petit », « Petit enfant deviendra grand »…) — plus de matchs sur seuls noms d'auteurs
- [x] Tri `created_at:desc` → ids récents (batch 29/08) en tête ; `books:configure-search` réappliqué
- [x] Facettes API end-to-end : 35 catégories / 6 langues avec compteurs réels
- [ ] Vitrine `/books` « Nouveautés » déployée (lz) et tri `recent` vérifié — commit `fb1d718` en attente de test propriétaire
- [x] **Filtre matière (`default_subject_id`) débloqué dans le même passage** (06/09) :
      champ ajouté à `toSearchableArray` (Book.php) + `filterable` (ConfigureBookSearch) —
      697 165/697 172 livres renseignés en base. Reste : UI (FilterSidebar + param API
      `subject`) dans le chantier « Finir le site ».
- [ ] Backlog : check quotidien fieldDistribution au cron 03:40 (après configure-search)
