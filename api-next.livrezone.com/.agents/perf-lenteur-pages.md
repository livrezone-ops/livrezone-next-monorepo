# Diagnostic & Plan — Lenteur des pages (/books, /librairies)

Contexte : l'utilisateur constatait `/librairies` ~2.7–3.6 s et `/books` jusqu'à 5 s,
avec un pic à 11 s sur `/api/reference-data`. On soupçonnait les facettes Meilisearch,
puis un passage inutile par Cloudflare, puis Redis/MariaDB.

**ÉTAT ACTUEL (tests refaits le 23/08/2026) : les lenteurs NE SONT PLUS REPRODUCTIBLES.**
Voir `.agents/constats_lenteur.txt` et les nouvelles mesures ci-dessous.

---

## 1. Mesures (depuis l'extérieur, via curl)

Pages (total) — 3 appels chacune :

| Page | appel 1 | appel 2 | appel 3 |
|------|--------|--------|--------|
| `/librairies` | 0.54 s | 0.36 s | 0.38 s |
| `/books` | 0.56 s | 0.46 s | 0.36 s |
| `/demandes` | 0.31 s | 0.22 s | 0.32 s |
| `/annonces` | 0.28 s | 0.47 s | 0.28 s |

API directe — 4 appels chacune :

| Endpoint | min | max |
|----------|-----|-----|
| `/api/reference-data` | 0.25 s | 0.42 s |
| `/api/libraries?limit=12` | 0.19 s | 0.29 s |
| `/api/books?limit=1` | 0.21 s | 0.43 s |
| `/api/demandes?limit=1` | 0.24 s | 0.29 s |

Mesures **côté serveur (conteneur de prod, localhost)** selon `constats_lenteur.txt` :
- `curl http://127.0.0.1:3000/librairies` → ~0.038 s
- `curl http://127.0.0.1:3000/books` → ~0.073 s

=> Le SSR réel est extrêmement rapide. Les ~0.2–0.5 s mesurés de l'extérieur sont
majoritairement la latence réseau local → Cloudflare → serveur, pas le SSR.

## 2. Cause racine — RÉVISÉE

### 2.1 Les facettes Meilisearch : NON
Meilisearch est rapide (books/demandes ~0.2–0.3 s). Les facettes sont calculées
dans une seule requête par endpoint.

### 2.2 Hypothèse Cloudflare / INTERNAL_API_URL : RÉFUTÉE
`constats_lenteur.txt` prouve que :
- `INTERNAL_API_URL=https://api-next.livrezone.com` est **défini**.
- `docker exec livrezone-next getent hosts api-next.livrezone.com` → `192.168.1.202`
  (IP LAN privée, **pas** Internet/Cloudflare).
- Le SSR localhost mesure 0.038 s pour `/librairies` (donc le fetch API est
  négligeable) → le chemin API n'est pas en cause.

=> **Ne PAS modifier `INTERNAL_API_URL`.** L'hypothèse "Next sort vers Internet
puis revient par Cloudflare" n'est pas démontrée.

### 2.3 Cause la plus probable : pression RAM/CPU (swap) — Jellyfin
Contexte serveur : **12 Go RAM, i5**, et Jellyfin actif (transcode = gros
consommateur CPU + mémoire). Hypothèse la plus probable :
- Lors des pics, la RAM vient à manquer → **MariaDB / Redis / PHP passent en swap**
  (ou contention CPU avec Jellyfin) → latences de requêtes qui s'envolent.
- Le pic de **11 s** sur `/api/reference-data` (cache Laravel) est la signature
  typique d'un stall **disque/swap** (attente IO, pas CPU calcul).
- Comportement **transitoire et non reproductible** : dès que la charge redescend
  (ou que Jellyfin est inactif), tout revient à la normale (mesures actuelles
  rapides) — cohérent avec une pression ressource passagère, pas un bug code.

Les anciennes mesures externes (3.6 s, 5 s, 11 s) capturaient cet incident,
désormais résolu. Aucune preuve contre Redis/MariaDB en fonctionnement normal.

## 3. Travail à faire

### Tâche 1 — NE PAS modifier INTERNAL_API_URL
L'architecture est validée (résolution LAN, SSR à 0.038 s). Laisser en l'état.

### Tâche 2 — Plan de surveillance (à activer dès la réapparition)
Puisque le problème n'est pas reproductible, la consigne est de **mesurer
immédiatement** lors de la prochaine occurrence (cf. `constats_lenteur.txt`) :
```bash
# SSH requis (sudo pour docker)
# 1. Endpoint suspect
curl -s -o /dev/null -w "%{time_total}\n" http://127.0.0.1:3000/api/reference-data
curl -s -o /dev/null -w "%{time_total}\n" http://127.0.0.1:3000/api/libraries?limit=12

# 2. Redis
redis-cli ping
redis-cli --intrinsic-latency 1

# 3. MariaDB
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec mariadb mysql -e "SELECT 1;"

# 4. Laravel logs + charge système
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 tail -n 50 /var/www/html/api-next.livrezone.com/storage/logs/laravel.log

# 5. PRESSION RAM/CPU/SWAP (hypothèse Jellyfin)
free -h
swapon --show          # swap présent ? utilisé ?
vmstat 1 5             # colonne si = swap in/out, wa = attente IO
dmesg | grep -i "out of memory\|oom\|killed"   # OOM killer ?
ps aux --sort=-%mem | head   # quel process mange la RAM (jellyfin ?)
systemctl status jellyfin   # etat / transcoding
```

### Tâche 5 — Mitigations RAM/CPU (si la pression mémoire est confirmée)
- **Limiter Jellyfin** : plafonner le transcodage (résolutions, sessions
  concurrentes), ou réduire sa mémoire allouée / sa priorité (`nice`/`systemd
  MemoryMax`).
- **Vérifier le swap** : un swap sur disque lent aggrave les pics ; préférer
  suffisamment de RAM, ou un swap sur SSD rapide. Éviter `swappiness` trop haut.
- **Prioriser l'app** : `systemd` `CPUWeight`/`MemoryMax` sur les conteneurs
  LivreZone vs Jellyfin, ou déplacer Jellyfin sur une autre machine.
- Si la RAM est systématiquement saturée, envisager un passage à 16+ Go.

### Tâche 3 — (DÉJÀ FAIT) Réduire les fetches SSR sur `/books`
`BookCatalogueService` calcule les facettes en **une seule** requête Meilisearch
(auto-exclusion du filtre langue), et `app/books/page.tsx` passe `facets: false`
aux 6 appels par section. On passe de ~28 à ~8 requêtes Meilisearch par chargement
`/books`. Optimisation saine, à conserver. Build via `lz` si pas déjà fait.

### Tâche 4 — Rebuild frontend (si modification du code)
```bash
ssh ouahib@192.168.1.202
lz
```

## 4. Vérification
Les nouvelles mesures (§1) montrent déjà tout le trafic rapide. Dès qu'une lenteur
réapparaît, appliquer Tâche 2 pour identifier si c'est Redis, MariaDB, ou la
reconstruction du cache Laravel (pic sur `reference-data`).

## 5. Fichiers concernés
- `frontend/lib/books-api.ts` — `API_BASE` (laisser INTERNAL_API_URL tel quel).
- `frontend/lib/listings-api.ts` — idem.
- `frontend/app/books/page.tsx` — `facets: false` sur les sections (déjà fait).
- `app/Services/BookCatalogueService.php` — facette unique (déjà fait).
- `.agents/constats_lenteur.txt` — relevé serveur (référence).
- Infra serveur — Redis / MariaDB (surveillance, Tâche 2).
