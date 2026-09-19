# Migration complète de LivreZone vers le NOUVEAU SERVEUR

*Stratégie rédigée le 20/09/2026. Décision propriétaire : **le site tournera
exclusivement sur le nouveau serveur** (la machine actuelle, 192.168.1.202,
est remplacée). C'est le « point 6 » des audits 28/08 mené à terme.
**Rien n'est exécuté — ce document est le plan.** Le runbook détaillé avec
commandes exactes sera complété à J-7 (état des lieux obligatoire).*

Prérequis de lecture : `.agents/AUDIT-2026-08-25.md` (point 6 + leçon incident
Apache 28/08), `.agents/MIGRATION-SSD4SERVER-STRATEGIE.md` (supersédée, reste
le modèle de procédure rsync/fenêtre/rollback), `.agents/INFRASTRUCTURE.md`,
`.agents/ROTATION-MOTS-DE-PASSE.md`.

---

## 1. CE QUI DÉMÉNAGE (périmètre inventorié au 19-20/09)

### Données (l'irremplaçable)
| Quoi | Taille | Où aujourd'hui |
|---|---|---|
| MariaDB livrezone (books 697k, listings, users, orders) | 750 Mo | volume rootless `docker-data/volumes/livrezone_mysql_data` |
| Meilisearch (654 k docs) | 3,7 Go | bind `docker-data/meilisearch_data` |
| **Couvertures books** | **44 Go** | **SSD4server** `/media/ouahib/SSD4server/books/covers` (lu par `book-cover-proxy`) |
| Code (repos git API + frontend) | 4,3 Go | `docker-data/volumes/livrezone_html_data/_data` (bind mounts) |
| Cache OG frontend | ~200 Mo | volume rootful `livrezone-og-cache` (régénérable) |
| `.env` partagé + secrets | — | racine API (APP_KEY, DB, OAuth, SES, Telegram, Reverb, Meili, Redis) — cf. rotation |

### Conteneurs ROOTLESS (uid 1001 = user `livrezone`, data-root `/home/livrezone/docker-data`)
mariadb, meilisearch, apache (frontal API), php-fpm-8.5 (API), livrezone-redis,
reverb (websockets), queue/scheduler Laravel, openvscode-server (custom
`mon-openvscode-server:custom`, limité 3 Go — reconstruire via
`/workspace/.dev-image-build/`), + stack fastfacture `ff_*`
(décommissionnée mais conservée : migrer éteinte ou abandonner — décision).

### Conteneurs ROOTFUL
`livrezone-next` (frontend :3000), **caddy (+ WAF Coraza, confs
`/etc/openpanel/caddy/domains/`)**, stack OpenPanel (openpanel, dns, redis,
mysql, ftp), **evolution-api + postgres + redis** (WhatsApp), clamav,
cloudflare-ddns (⚠️ cf. piège §5), cloudflared-rescue, phpmyadmin, dbgate,
stack learning (perso), jellyfin + qbittorrent (perso — images restaurées
19/09, à NE PAS oublier, cf. mémoire nettoyage Docker).

### DNS Cloudflare (zone livrezone.com)
`livrezone.com` (→ conteneur livrezone-next), `next.livrezone.com`,
`api-next.livrezone.com` (⚠️ résout aujourd'hui vers l'IP de CETTE machine),
+ sous-domaines perso. Baisser les TTL à 300 s **48 h avant** la bascule.

### Ce qui est reconstruit, pas migré
Images Docker (re-pull/build), cache images Next (`/.next/cache`, ~10 Go max),
caches divers. **Tout autre volume non listé = à inventorier à J-7 avant de
décider** (piège : le volume `livrezone_html_data` EST le code, cf. mémoire).

## 2. DÉCISIONS PROPRIÉTAIRE RESTANTES (avant d'écrire le runbook final)

1. **Specs du nouveau serveur** (RAM/CPU/disques) — recommandation : ≥ 16 Go
   RAM, 4+ cœurs, disque système ≥ 512 Go distinct du SSD de données ; le
   worker ffmpeg vidéo (stack marketing) y sera enfin viable.
2. **L'ancienne machine** : gardée en fallback J+7 (recommandé), puis
   reformatée/reconvertie ? Elle garde tout intact pendant la validation.
3. **Les services perso** (jellyfin, qbittorrent, learning, openvscode-server)
   migrent aussi, ou restent/abandon ? (Ils ne bloquent pas le site.)
4. **Date/fenêtre de bascule** (creux de trafic, soirée/week-end).
5. **OpenPanel** : réinstaller l'panel sur le nouveau serveur, ou Caddy seul
   (plus simple, moins de surface) — opportunité de simplification, à trancher.

## 3. ARCHITECTURE CIBLE — recommandation

**Reproduire la structure actuelle à l'identique** (rootless uid 1001 +
rootful, mêmes noms de conteneurs, mêmes chemins relatifs) pour minimiser le
risque de bascule. **Toute simplification (tout-rootful, suppression
OpenPanel, fastfacture abandonné) se fait APRÈS la bascule validée, jamais
pendant.** Exception assumée : remplacer le couple disque système 128 Go +
SSD4server par un disque système confortable + SSD4server en disque de
données (couvertures + MySQL + Meili dessus dès le départ — la stratégie
« données sur SSD » prévue ici s'applique directement à la nouvelle machine).

## 4. PLAN EN 6 PHASES

**Phase 0 — Nouvelle machine (J-14 → J-7)**
Installation OS durcie (ssh clé, firewall: 80/443 + LAN uniquement, fail2ban,
mises à jour auto), Docker rootful + rootless, **créer l'utilisateur
`livrezone` en uid 1001** (les permissions des volumes/bind copiés en
dépendent), installer rclone + remote Drive (sans toucher au remote de
l'ancienne machine pendant la transition).

**Phase 1 — État des lieux J-7 (sur l'ancienne machine)**
Générer l'inventaire complet versionné dans ce dossier :
`docker ps -a` + `docker inspect` de CHAQUE conteneur (flags complets de
recréation), `docker volume ls`, crontabs (root + livrezone), confs Caddy
(domains/ + WAF), contenu `.env` (chiffré), règles firewall actuelles,
version exacte des images (tags figés). Ce dump EST la source de vérité du
runbook.

**Phase 2 — Pré-copies à chaud (J-7 → J-1, sans interruption)**
- Couvertures 44 Go → SSD4server sera déplacé physiquement : PAS besoin de
  copie réseau si le SSD va au nouveau serveur. MAIS copie de sûreté des
  seules couvertures vers le nouveau serveur si la bascule devait glisser
  (44 Go à 1 Gb/s ≈ 10 min, faire une copie quand même).
- Code : `rsync -a` complet + `git push` de tous les repos (état pushé =
  référence).
- Meili + MySQL : premier rsync à chaud (deltas ensuite).
- Dumps de sûreté : `mysqldump --single-transaction` J-1 + `meili dump`.

**Phase 3 — FENÊTRE DE BASCULE (coupe courte, 1-2 h)**
1. Bandeau maintenance Caddy sur l'ANCIENNE machine.
2. Stop queue/scheduler → `mysqldump` final → stop mariadb → stop meili.
3. Deltas rsync (minutes).
4. Sur le NOUVEAU serveur : recréer la stack dans l'ordre — mariadb → meili
   → redis → php-fpm/apache → reverb → queue/scheduler → frontend → caddy.
5. **DNS Cloudflare** : pointer `livrezone.com` / `next` / `api-next` vers la
   nouvelle IP (TTL 300 posé à J-2). ⚠️ **Arrêter `cloudflare-ddns` sur
   l'ANCIENNE machine AVANT** de le configurer sur la nouvelle (sinon les
   deux se battent pour la même enregistrement — conflit documenté §5).
6. Vérifications complètes (checklist §6) sur le nouveau serveur.
7. Retirer le bandeau maintenance. L'ancienne machine reste UP mais
   intouchée (rollback possible à tout moment).

**Phase 4 — Rollback (écrit AVANT, valable jusqu'à J+7)**
Re-pointer les DNS vers 192.168.1.202 (TTL 300 = effectif en ~5 min),
re-delta MySQL/Meili si des écritures ont eu lieu sur la nouvelle machine
(réimport des dumps faits pendant la fenêtre inverse), bandeau maintenance
le temps du re-delta. L'ancienne machine n'ayant rien perdu, la perte max =
les écritures depuis la bascule (à mesurer : site jeune, faible écriture
hors commandes — lister les tables d'écriture à J-7).

**Phase 5 — Après-bascule (J+0 → J+7)**
- Surveillance 48 h : logs (erreurs `[og]`, queue, reverb), trafic, OAuth
  (connexions Google réelles), test paiement simulé.
- Reconfigurer les backups rclone/Drive DEPUIS la nouvelle machine + test de
  restauration (un backup non testé n'existe pas).
- **Rotation des secrets recommandée pendant la fenêtre** (APP_KEY excepté —
  il chiffre des données : le MIGRER tel quel, rotation séparée documentée
  plus tard) : mots de passe DB, Meili, Redis, Telegram, SES — le transfert
  de machine est le moment idéal (cf. `ROTATION-MOTS-DE-PASSE.md`).
- J+7 OK : ancienne machine éteinte/archivée (image disque de sûreté avant
  réutilisation).

**Phase 6 — Le nouveau serveur fait vivre la suite**
C'est LÀ que la stack marketing rentre enfin : **n8n + Postiz + worker
Python/ffmpeg** (cadrage `.agents/PROMPT-SESSION-N8N.md` — mise à jour
calendrier faite le 20/09), puis les simplifications différées (§2.5).

## 5. PIÈGES SPÉCIFIQUES (collectés, à relire avant la fenêtre)

1. **cloudflare-ddns** : les deux machines ne doivent JAMAIS le faire tourner
   en même temps (course à l'enregistrement DNS).
2. **IP codée en dur** : `--add-host api-next.livrezone.com:192.168.1.202`
   dans `deploy.sh` (build ET run) et confs Caddy/WAF → remplacer par la
   nouvelle IP sur la nouvelle machine ; `next.config.ts`
   `dangerouslyAllowLocalIP` (anti-SSRF) à revalider.
3. **`livrezone_html_data` = LE CODE** (data-root rootless) — le copier en
   rsync, ne jamais le laisser à un `docker volume prune`.
4. **uid 1001** : créer `livrezone` avec cet uid exact sur la nouvelle
   machine, sinon permissions des volumes cassées.
5. **Meili** : figer la version (tag image exact) — une montée de version
   implicite via `latest` casserait l'index 654 k docs.
6. **WAF Coraza** : les règles (`next.livrezone.com.conf`, id 100900
   /_next/image…) doivent suivre ; retester PUT/DELETE bloqués + og:image OK.
7. **OAuth Google** : le domaine ne change pas → rien à faire côté console,
   mais tester une connexion réelle dès la bascule.
8. **Reverb/websockets** : URL wss identiques (domaine inchangé), vérifier le
   port exposé et l'appairage clé.
9. **Evolution API** : ses identifiants WhatsApp sont liés à l'instance —
   prévoir re-scan QR ou export/import de sa base Postgres.
10. **Sauvegardes** : ne couper le cron rclone de l'ancienne machine qu'après
    le premier backup réussi DEPUIS la nouvelle.

## 6. CHECKLIST DE VÉRIFICATION (fenêtre de bascule)

- [ ] Accueil + fiche annonce + recherche (Meili) + facettes
- [ ] Connexion classique + Google OAuth + dashboard
- [ ] Création/modification annonce → cache OG régénéré (logs `[og]`)
- [ ] Partage Facebook d'une fiche (Sharing Debugger) → carte v10 OK
- [ ] Couverture proxy OK (thumbnails + originals)
- [ ] Notification e-mail (forgot-password) + Telegram admin + WhatsApp (si actif)
- [ ] Queue santé (`app:queue-health`) + scheduler + reverb (websocket)
- [ ] Cron de sauvegarde + premier backup Drive depuis la nouvelle machine
- [ ] HTTPS/WAF : aucune 403/5xx nouveau motif dans les logs Caddy
