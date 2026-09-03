# Rapport d'incident — Erreur 524 lors de l'utilisation de vscode.livrezone.com — 03/09/2026

**Serveur :** casaos-server (192.168.1.202) — Debian 12, 11,8 Go RAM, 4 cœurs.
**Symptôme :** l'utilisation de vscode.livrezone.com « plante le site » : les domaines
renvoient Error 524 (timeout Cloudflare) alors que la RAM hôte paraît libre ;
revenir à la normale prend ~10-15 min. Problème apparu **après la migration
code-server → rootless** (28/08), malgré les restrictions ajoutées depuis.
**Statut :** cause racine identifiée et prouvée — correctif préparé (§3).

## 1. Chronologie de l'incident du 03/09 (preuves croisées)

| Heure locale | Preuve | Source |
|---|---|---|
| 12:07 | clamd (conteneur root clamav) OOM-killé dans son propre cgroup | journalctl -k |
| 14:52:10 | **node (VS Code server, RSS 1,65 Go) OOM-killé — oom_memcg=/user.slice/user-1001.slice** | journalctl -k |
| 16:00 UTC (17:00 loc.) | OpenPanel resource_usage : **« Memory at 99% »** (2,0G/2,0G) | /home/livrezone/resource_usage.txt |
| 17:40 et 17:42 | Watchdog : FAIL api-next.livrezone.com → HTTP 000 (×2) | /var/log/caddy-watchdog.log |
| 17:43:48 | **2e node OOM-killé (RSS 1,25 Go), même cause slice** | journalctl -k |
| 17:43:51 | reverb crash puis relance auto (policy unless-stopped) | docker inspect (rootless) |
| 17:47 | load average **37** (15 min), PSI mem avg300 18%, PSI io avg300 22% | /proc/loadavg, /proc/pressure |
| ~18:00 | retour au calme (slice 33%, load 1,4) après le kill | slice-memory-watch --test |

## 2. Cause racine

Le **userpackage OpenPanel « RAM réduite »** choisi à la création du site (25/07)
a posé un plafond systemd sur TOUT l'utilisateur `livrezone` (UID 1001) :

- `/etc/systemd/system.control/user-1001.slice.d/50-MemoryMax.conf` → **MemoryMax=2G** ;
- `/etc/systemd/system.control/user-1001.slice.d/50-CPUQuota.conf` → **CPUQuota=200%** (2 cœurs/4).

Or le daemon **Docker rootless** de `livrezone` fait tourner dans ce même slice :
apache, php-fpm-8.5, mariadb, livrezone-redis, meilisearch, reverb **et** l'IDE
openvscode-server (vscode.livrezone.com → Caddy → http://192.168.1.202:8445).

Mécanisme du 524 :

```
VS Code server (node) → 1,25–1,65 Go (Cline, extensions, tsserver sur le monorepo)
+ reste du stack rootless (~0,8–1 Go)
> plafond 2 Go du slice user-1001
→ throttling kernel : memory.events max = 14 555 365 ; reclaim + swap I/O
  (swap hôte 977 Mo, 85% plein) → load 37 (tâches en D-state I/O)
→ apache/php/reverb (dans le slice) gèlent → Caddy voit 000 → Cloudflare 524
→ en dernier recours, OOM kill du node de l'IDE
```

- **« La RAM n'est pas consommée »** : le plafond est au niveau *cgroup* (slice),
  pas machine — l'hôte affiche ~7 Go libres pendant que le stack est asphyxié.
- **Apparu après la migration rootless (28/08)** : avant, l'IDE tournait sur le
  daemon **root** (system.slice, hors plafond) ; depuis, il est DANS le slice
  2 Go avec toute la prod. Le journal OpenPanel confirme : « Memory at 95%,
  CPU at 102% » dès le **28/08 17h-18h**, jour même de la migration.
- **Pourquoi les restrictions ajoutées ne suffisaient pas** :
  - exclusions VS Code (watcherExclude/search.exclude/files.exclude, 28/08) :
    réduisent la conso, mais le node atteint quand même 1,25–1,65 Go ;
  - limite docker `--memory=3G` sur openvscode-server : **supérieure au plafond
    du slice (2G)** → c'est toujours le slice qui cède d'abord ;
  - le watchdog Caddy ne peut pas réveiller un amont asphyxié (FAIL répétés à
    17:40/17:42 malgré les reloads) et teste `code.livrezone.com`, décommissionné
    le 02/09 → FAIL permanent → reload inutile toutes les 2 min (1311 FAIL cumulés).

## 3. Correctif (Option A validée par le propriétaire le 03/09)

Script unique à exécuter en root : **`sudo bash /home/ouahib/fix-524-20260903.sh`**
(idempotent, chaque étape vérifiable) :

1. `systemctl set-property user-1001.slice MemoryMax=6G CPUQuota=300%` — cause
   racine : slice 2G→6G, CPU 2→3 cœurs (hôte 11,8 Go, ~7 libres) ;
2. `docker update --memory 2560m --memory-swap 2560m openvscode-server`
   (rootless) — filet : l'IDE isolé à 2,5G en cas d'emballement (kill scope
   conteneur, prod épargnée) ;
3. `docker update --memory 1536m meilisearch` (rootless) — filet Meili (reco 31/08) ;
4. watchdog : neutraliser `check_domain "code.livrezone.com"` (backup `.bak-20260903`) ;
5. swap : +3G via `/swapfile` (total ≈ 4G — reco 31/08 jamais appliquée ; le
   swap était à 85% le 03/09) ;
6. installer `/usr/local/bin/slice-memory-watch.sh` + `/etc/cron.d/slice-watch`
   (alerte Telegram : slice ≥ 85% / PSI mem ≥ 30% / swap ≥ 90%, rappel 30 min,
   message de récupération < 75% ; pattern tg_send de lz-backup-daily.sh) ;
7. (option, défaut : non) arrêt clamav (~700 Mo ; clamd OOM-killé le 03/09 12:07).

**⚠️ Cohérence OpenPanel :** mettre à jour le userpackage dans le panel
(Admin → utilisateur livrezone → RAM 6 Go) pour qu'une future modification du
compte n'écrase pas le `set-property`.

## 4. Checklist de validation (après exécution du script)

- [ ] `cat /sys/fs/cgroup/user.slice/user-1001.slice/memory.max` → 6442450944
- [ ] ouvrir https://vscode.livrezone.com et travailler 15-20 min (projet, Cline, terminal)
- [ ] pendant l'usage : slice < 60% (`slice-memory-watch.sh`), load < 4, aucun
      nouveau `FAIL [api-next` dans `/var/log/caddy-watchdog.log`
- [ ] https://api-next.livrezone.com et https://next.livrezone.com → 200 via
      Cloudflare **pendant** l'usage de l'IDE
- [ ] `sudo journalctl -k --since -1h | grep -i oom` → vide
- [ ] plus de FAIL `code.livrezone.com` toutes les 2 min dans le log watchdog

## 5. Suivis (non bloquants)

- `MEILI_MAX_MEMORY=1024MB` (env) à la prochaine recréation de meilisearch
  (plus propre que la limite cgroup) ;
- `NODE_OPTIONS=--max-old-space-size=1536` dans openvscode-server à la prochaine
  recréation (contention du node en amont du filet 2,5G) ;
- décision ClamAV « scan à la demande » (étape 7 du script) ;
- committer ce rapport + audit-infra.md après validation.

## 6. Environnement de l'incident

- Daemons : **root** (caddy, livrezone-next, evolution_*, openpanel_*, clamav…)
  et **rootless livrezone** (apache, php-fpm-8.5, mariadb, livrezone-redis,
  meilisearch, reverb, openvscode-server). Conteneur code-server supprimé le
  02/09 ; seul IDE restant : openvscode-server (image mon-openvscode-server:v2).
- Mesures précédentes (contexte) : `.agents/rapport-incidents-watchdog-20260828.md`,
  `.agents/AUDIT-2026-08-25.md` (§28-29/08), `.agents/AUDIT-2026-08-31.md`
  (incident 02/09 + recos non appliquées), `audit-infra.md` (§02/09).

## 7. Déroulé réel du correctif (03/09 soir)

**fix-524-20260903.sh (~18:20)** : ① slice 6G / 3 cœurs ✅ · ② IDE 2,5G ✅ ·
④ watchdog ✅ · ⑥ slice-watch + cron ✅ · ⑦ clamav arrêté (choix propriétaire) ✅ ·
③ meilisearch ❌ (erreur masquée par un `2>/dev/null` du script) ·
⑤ swapfile ❌ silencieux : un `/swapfile` de 1 Go préexistant depuis le 24/07
(inactif) bloquait le `swapon` — la garde `[ ! -f /swapfile ]` avait sauté la
création et le `|| true` avalé l'erreur.

**fix-524-remaining.sh (~18:33)** : `/swapfile` recréé en 3 Go (`dd`, 683 Mo/s,
UUID ca225d74-a5d3-456f-a052-1d7386e9520e) → swap total ≈ 4 Go ✅.
meilisearch : erreur réelle = « Memory limit should be smaller than already
set memoryswap limit, update the memoryswap at the same time » (un memoryswap
était posé à la création du conteneur) → fix par
`docker update --memory 1536m --memory-swap 1536m` → limite 1,5G confirmée
côté docker ET cgroup (1610612736) ✅.

**État vérifié 18:30-18:40** : slice 715 Mo/6 Go (11%), PSI mémoire 0 partout,
swap ≈ 4 Go (sdb3 854 Mo + /swapfile 0), zéro OOM kernel depuis 30 min,
watchdog sans le moindre FAIL/reload depuis 18:23:02 (contre 1 FAIL + reload
toutes les 2 min avant), cron slice-watch actif chaque minute (log vide =
aucune alerte), sites api-next 200 / next 200 / vscode 401 (challenge
basic_auth attendu).

**Reste à faire (propriétaire)** : test de charge réel vscode.livrezone.com
(15-20 min d'utilisation IDE pendant que les sites restent en 200 — la
surveillance Telegram veille) + synchro du userpackage OpenPanel (RAM 6 Go)
pour pérenniser le `set-property`. Suivis optionnels : MEILI_MAX_MEMORY (env)
et NODE_OPTIONS à la prochaine recréation des conteneurs concernés.