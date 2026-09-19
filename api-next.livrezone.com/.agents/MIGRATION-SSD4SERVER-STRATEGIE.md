# Stratégie de transfert du site sur SSD4server

*Rédigée le 19/09/2026 à la demande du propriétaire. **Document de stratégie —
rien n'est exécuté.** Complète le « point 6 » des audits 28/08 (migration) ;
le volet domaine a déjà été traité séparément par l'option POINTEUR du 06/09
(cf. `MIGRATION-livrezone-com-2026-09-06.md`). Ce doc traite le volet
STOCKAGE.*

> **🔴 SUPERSÉDÉE le 20/09 : le propriétaire prévoit d'ACHETER UN NOUVEAU
> SERVEUR et d'y installer le SSD4server.** La bascule des données sur CETTE
> machine n'a donc plus d'objet — le SSD va déménager. ⚠️ Dépendance critique
> à traiter AVANT tout débranchement : **les couvertures du site en prod
> (44 Go, `books/covers/`) vivent sur ce SSD** — le proxy `book-cover-proxy`
> les lit directement. Débrancher le SSD = site sans couvertures (OG cards
> comprises). Options : copier les couvertures sur le disque de ce serveur
> AVANT le démontage, faire migrer le site complet sur le nouveau serveur
> (plan d'origine de l'audit 28/08), ou servir les couvertures depuis le
> nouveau serveur par le réseau. Ce document reste utile comme MODÈLE de
> procédure (pré-copie rsync, fenêtre courte, comptages avant/après, rollback
> écrit avant exécution) pour la migration vers le nouveau serveur.

## 1. État des lieux mesuré (19/09/2026)

| Élément | Localisation | Taille | Notes |
|---|---|---|---|
| **Disque système** `/` | `/dev/sdb2` AXM14 128 Go | **20 Go libres (83 %)** | tout le site vit ici aujourd'hui |
| **SSD4server** | `/dev/sda1` Kingston SA400 960 Go, ext4, fstab `nofail` | **218 Go libres (76 %)** | SSD SATA interne ; héberge déjà médias perso (vidéos 519 G, photos 79 G) et **les couvertures books (44 G)** |
| Données MariaDB (livrezone) | volume `/home/livrezone/docker-data/volumes/livrezone_mysql_data/_data` | **750 Mo** | stack ROOTLESS uid 1001 |
| Dumps MariaDB | volume `livrezone_mysql_dumps` | ~vide | |
| Index Meilisearch | bind `/home/livrezone/docker-data/meilisearch_data` | **3,7 Go** | 654 k docs, reconstruisible mais long |
| Code (repos git api + front) | `/home/livrezone/docker-data/volumes/livrezone_html_data/_data` | 4,3 Go | dépôts ACTIFS, chemins d'outillage ZCode codés dessus |
| **Docker rootful** | `/var/lib/docker` | **37,3 Go d'images (30,1 Go récupérables !) + 3,7 Go build cache** | 158 images, 19 actives — accumulate d'anciens builds/tags rollback |

**Conclusion chiffrée** : le cœur de données à déplacer ne fait que **~4,5 Go**
(Meili + MySQL). Le disque système n'est PAS rempli par les données du site
mais par **30 Go d'images Docker mortes** (plus 3,7 Go de cache de build).

## 2. Deux actions distinctes, dans CET ordre

### Action A (préalable recommandé, gain immédiat ~30 Go) — nettoyage Docker rootful

✅ **EXÉCUTÉ le 19/09 soir — bilan : ~29 Go libérés, / passe de 83 % (20 Go
libres) à 56 % (49 Go libres).** Détail : 3,7 Go cache de build + 21,7 Go
images orphelines (dangling) + 0,7 Go retenues par 2 conteneurs débris de la
session v8 (`suspicious_napier`/`suspicious_kepler`, supprimés) + 2 Go
d'images inutilisées > 30 jours. **Conservé volontairement** : les 5 tags
`livrezone-next` (latest + 4 rollback), `node:22-slim`/`node:22-alpine`
(outillage de test OG), `mon-openvscode-server:custom` + `mon-code-server`
(décision dev distant), `composer:2`, `php:8.5-cli`, `skopeo`, bases de
données clients (mariadb, postgres, redis…). Après coup : 27 images (dont 17
actives), tous les conteneurs Up, frontend 200. Reste ~3,6 Go
« récupérables » théoriques = couches partagées + images jeunes conservées à
dessein.

⚠️ **CORRECTION du 19/09 (retour propriétaire)** : la passe > 30 j avait
aussi supprimé `linuxserver/jellyfin:latest` et `hotio/qbittorrent:release-5.0.4`
(images des services PERSO, sans conteneur actif sur ce serveur) →
**restaurées par re-pull dans la foulée** (jellyfin = build plus récent du
même tag ; qbittorrent 5.0.4 exact via `ghcr.io/hotio/qbittorrent`, hotio
ayant quitté Docker Hub). **Règle propriétaire désormais permanente : le
nettoyage ne vise que les images backup/doublons — NE JAMAIS toucher aux
images jellyfin/qbittorrent ni à tout service perso, même sans conteneur
actif.** À lister explicitement AVANT chaque futur prune :

```
sudo -n docker pull linuxserver/jellyfin:latest
sudo -n docker pull ghcr.io/hotio/qbittorrent:release-5.0.4
# vérifier avant prune : docker images | grep -E "jellyfin|qbittorrent"
```

La procédure ci-dessous reste la référence pour les prochains
nettoyages :

1. Lister les images actives + tags ROLLBACK à préserver
   (`livrezone-next:rollback-*`, images des conteneurs actifs) → les noter
   dans ce doc avant tout prune.
2. `docker image prune -f` (dangling) PUIS
   `docker image prune -a --filter "until=720h" -f` (inutilisées > 30 j —
   les tags rollback récents sont automatiquement préservés) ;
   `docker builder prune -f` pour le cache (sans risque).
3. Vérifier ensuite que `deploy.sh` reconstruit toujours (`livrezone-next`
   rebuilt de toute façon) et que les rollback tags voulus existent encore.

⚠️ Ne JAMAIS `docker system prune -a --volumes` (volumes rootful inclus :
OG cache, données evolution-api…).

### Action B — migration des DONNÉES du site vers SSD4server

Périmètre retenu (recommandation) : **données uniquement** —
- `/home/livrezone/docker-data/meilisearch_data` (3,7 Go)
- `/home/livrezone/docker-data/volumes/livrezone_mysql_data` (750 Mo)
- futurs dumps (`livrezone_mysql_dumps`)
- (option) données du futur n8n → directement créées sur SSD4server
  (`SSD4server/livrezone/n8n`), cohérent avec la décision « n8n local ».

**PAS le code** (`livrezone_html_data`) : dépôts git actifs, chemins codés
dans les sessions/outils ZCode, gain faible (4,3 Go) pour un risque élevé de
casser l'outillage. À re-discuter plus tard si / redevient plein.

**PAS les images Docker non plus** (décision 20/09) : les images sont
re-téléchargeables/reconstructibles — ce ne sont pas des données. Les
déplacer exigerait de changer le `data-root` des deux daemons (rootful ET
rootless) : arrêt de TOUS les conteneurs y compris le proxy Caddy (coupure
totale du site, pas juste fenêtre courte), et dépendance au montage `nofail`
— si SSD4server est absent au boot, plus rien ne démarre. Gain (~12 Go) sans
objet depuis le nettoyage (49 Go libres). Les volumes de données, eux,
passent sur SSD4server par recréation des conteneurs avec des bind mounts —
sans toucher au data-root.

Destination : `/media/ouahib/SSD4server/livrezone/{meili,mysql,dumps,n8n}`
(sous-dossier dédié, jamais la racine du SSD partagée avec les médias).

## 3. Plan de bascule par service (fenêtre de coupure courte)

Règle permanente : **fenêtre + rollback écrits AVANT exécution** (leçon
incident Apache 28/08). Anciennes données laissées INTACTES sur `/` jusqu'à
validation à J+7 — le rollback = recréer le conteneur avec l'ancien chemin.

Ordre : **Meilisearch d'abord** (le plus volumineux, et reconstruisible via
dump en cas de pépin), **MariaDB ensuite** (le plus critique, fenêtre plus
courte grâce à la répétition).

Pour chaque service :

1. **Pré-copie à chaud** : `rsync -a` initial vers SSD4server (service en
   marche, incohérences tolérées à ce stade).
2. **Fenêtre** : mode maintenance → **stop** conteneur → `rsync -a --delete`
   (delta, quelques secondes/minutes) → **recréation du conteneur** avec le
   montage pointant sur SSD4server → démarrage → vérifs.
3. **Vérifications** : Meili = recherche site + facettes + health ; MySQL =
   connexions, annonces, compteur de lignes clés vs avant (`SELECT COUNT(*)`
   books/listings/profiles/orders notés AVANT la bascule).
4. Détails spécifiques :
   - **Meili** : préserver la clé API (dans l'env du conteneur, inchangée) ;
     alternative sans rsync : `meili dump` → restore. rsync à froid préféré
     (plus simple, version figée).
   - **MySQL** : InnoDB propre après arrêt propre du conteneur ; vérifier
     `custom.cnf` (bind inchangé) ; le socket `/home/livrezone/sockets/mysqld`
     reste où il est (petit, hors périmètre).
   - **Permissions rootless** : le conteneur tourne en uid 1001 (livrezone) →
     `chown -R 1001:1001` des répertoires copiés (sinon MySQL/Meili refusent
     de démarrer).
5. **Garde anti-`nofail`** : le SSD est monté avec `nofail` — si le disque est
   absent au boot, les services démarreraient SANS leurs données. Mitigation
   obligatoire : vérifier au boot (script systemd user ou check dans les
   healthchecks existants) que `/media/ouahib/SSD4server/livrezone` existe
   avant de lancer les conteneurs, sinon alerter Telegram admin et NE PAS
   démarrer mariadb/meili sur les chemins vides.

## 4. Rollback (par service, indépendant)

1. Stop du conteneur concerné.
2. Recréation avec le montage d'ORIGINE (ancien chemin sur `/`, intact).
3. Vérifs identiques à la bascule.
4. Suppression de la copie SSD seulement après décision propriétaire.

Coût : une fenêtre de quelques minutes, zéro perte de données (double copie
pendant toute la période de validation).

## 5. Prérequis avant toute exécution

- [ ] Backup Drive à jour + restauration testée (déjà en place — relancer avant).
- [ ] Action A (nettoyage Docker) validée et exécutée → / respire.
- [ ] Comptages SQL notés avant bascule.
- [ ] Propriétaire valide périmètre + fenêtre horaire.
- [ ] Ce runbook complété des commandes exactes de recréation des conteneurs
      (inventorier les `docker run` d'origine : `docker inspect` → flags
      complets, à consigner dans ce doc AVANT la bascule).

## 6. Après bascule

- Surveillance 48 h : logs MySQL/Meili, latence recherche, IO disque
  (concurrence avec Jellyfin/qBittorrent sur le même SSD — surveiller, sans
  inquiétude majeure sur du SATA SSD).
- Mettre à jour les chemins dans les sauvegardes rclone/Drive si elles
  couvrent ces répertoires.
- Mise à jour `INFRASTRUCTURE.md`, `roadmap.md` (point 6 : volet stockage
  traité), audit, et mémoire.
- Ne PAS supprimer les anciennes données de `/` avant J+7 de fonctionnement
  nominal.
