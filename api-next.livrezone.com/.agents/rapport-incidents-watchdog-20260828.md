# Rapport d'incidents — Migration code-server rootless & stabilité système
**Dernière mise à jour :** 29 août 2026  
**Serveur :** `casaos-server` (192.168.1.202) — Debian 12, Docker rootless (livrezone UID 1001)

---

## Architecture globale

```
Internet → Caddy (root docker) → Apache (rootless docker) → PHP-FPM → Laravel API
                               → code-server (rootless docker)
                               → Next.js (root docker)
                               → Reverb / Redis / MariaDB (rootless docker)
```

> **Point critique :** Caddy réside dans le daemon Docker **root**, tandis que les backends Laravel/IDE résident dans le daemon Docker **rootless** (utilisateur `livrezone`). Ces deux daemons ont des cycles de démarrage et de gestion réseau distincts.

---

## INCIDENT 1 — code-server sature le serveur au démarrage (CPU & I/O Wait)

### Problème
Dès le lancement de code-server après la bascule rootless, le serveur devenait inaccessible (load average > 30 à 50, I/O wait > 31%, swap saturée).

### Cause
La commande `chmod -R o+rw` appliquée sur le volume du workspace (`/home/livrezone/docker-data/volumes/livrezone_html_data/_data`) a mis à jour le timestamp (`ctime`) de **centaines de milliers de fichiers**. 
Au démarrage, le service *File Watcher* (Node.js) de code-server a considéré l'intégralité de ces fichiers comme modifiés et a tenté de tous les réindexer en mémoire vive simultanément (notamment `vendor/`, `node_modules/`, `storage/`, `.next/`). Résultat : emballement du CPU, saturation des I/O disque, épuisement de la mémoire vive et OOM Killer.

### Solution appliquée
Ajout des directives d'exclusion dans la configuration de l'IDE :
```json
{
    "files.watcherExclude": {
        "**/.git/objects/**": true,
        "**/node_modules/**": true,
        "**/vendor/**": true,
        "**/storage/**": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/vendor": true,
        "**/storage": true,
        "**/.git": true
    }
}
```

---

## INCIDENT 2 — Extension Cline cassée (`command 'cline.settingsButtonClicked' not found`)

### Problème
L'extension Cline (Claude Dev) ne démarrait pas dans l'interface web de code-server. Le bouton des paramètres affichait l'erreur `command 'cline.settingsButtonClicked' not found`.

### Cause
**Conflit de répertoires et traces multiples :** L'extension était installée simultanément dans deux répertoires :
- `/config/extensions/saoudrizwan.claude-dev-4.1.16-universal` (copie manuelle lors de la migration)
- `/config/.local/share/code-server/extensions/saoudrizwan.claude-dev-4.1.16-universal` (installation gérée par code-server)

VS Code détectait des extensions invalides ("Invalid extensions detected") et bloquait le runtime de l'extension. De plus, d'anciens résidus de GitHub Copilot (`.copilot/`, `.cache/copilot/`, `globalStorage/github.copilot-chat`) créaient des interférences.

### Solution appliquée
1. Nettoyage radical de tous les dossiers d'extensions et mémoires caches globales :
   ```bash
   rm -rf /config/extensions/
   rm -rf /config/.local/share/code-server/extensions/*
   rm -rf /config/data/User/globalStorage/
   rm -rf /config/.cline /config/Cline /config/.copilot /config/.cache/copilot
   echo [] > /config/.local/share/code-server/extensions/extensions.json
   ```
2. Réinstallation propre via la CLI interne : `code-server --install-extension saoudrizwan.claude-dev`.

---

## INCIDENT 3 — Erreurs `EACCES: permission denied` sur `/config/data/User/`

### Problème
L'interface de code-server affichait des erreurs constantes de permission refusée à l'ouverture du navigateur :
```
EACCES: permission denied, stat '/config/data/User/settings.json'
EACCES: permission denied, stat '/config/data/User/systemExtensionsCache.json'
```

### Cause
**User Namespace Remapping de Docker rootless :**  
Dans le fichier `docker-compose.yml`, `PUID=1001` et `PGID=1001` étaient spécifiés. À l'intérieur du conteneur, le processus tourne sous l'UID 1001. Cependant, sur l'hôte, le daemon rootless applique un décalage de subUID (+165536). L'UID 1001 interne correspond donc à l'UID hôte **166536** (mapping vérifié `uid_map` : interne 1 → 165536, donc interne 1001 → 165536+1000). ⚠️ Correction 29/08 : l'estimation initiale « 166537 » avait un décalage d'1 et a fait échouer le premier `setfacl` ; le setfacl final cible 166536 (et 166537 par sécurité). Tout nouveau fichier généré par l'IDE n'était accessible ni par `ouahib` (1000) ni par `livrezone` (1001).

### Solution appliquée
1. Ajustement récursif des droits via un conteneur alpine rootless :
   ```bash
   chmod -R a+rwX /config/data /config/.local /config/etc
   ```
2. Création d'un script d'initialisation automatique au démarrage de s6-overlay (`/config/etc/cont-init.d/99-fix-permissions.sh`) :
   ```bash
   #!/bin/sh
   chmod -R a+rwX /config/data /config/.local 2>/dev/null || true
   ```

---

## INCIDENT 4 — Caddy perd les backends rootless (Site & IDE inaccessibles)

### Problème
Périodiquement ou après un redémarrage, `code.livrezone.com` et `api-next.livrezone.com` renvoyaient une erreur HTTP 000 / connexion refusée. Un redémarrage manuel de Caddy et OpenPanel était requis.

### Cause
- **Délai d'initialisation des deux daemons :** Caddy (daemon root) démarre immédiatement au boot. Les conteneurs rootless (Apache port 32773, code-server port 8443) mettent 20 à 30 secondes de plus à démarrer. Caddy constatait l'indisponibilité initiale des upstreams et les marquait comme inaccessibles.
- **Health check défectueux (erreur temporaire) :** L'ajout temporaire d'un `health_uri /healthz` dans la configuration Caddy a aggravé le problème car code-server ne possède pas ce point d'entrée, ce qui poussait Caddy à déclarer l'upstream mort en boucle.
- **Instabilité de vpnkit :** Le pilote réseau `vpnkit` utilisé par rootlesskit est sujet à des blocages lors de charges I/O élevées.

### Solution appliquée
1. Retrait du health check défaillant dans `code.livrezone.com.conf` et conservation du retry passif :
   ```caddy
   lb_try_duration 5m
   lb_try_interval 5s
   ```
2. Mise en place d'un **watchdog automatique** via cron sur l'hôte (`/usr/local/bin/caddy-watchdog.sh` planifié dans `/etc/cron.d/caddy-watchdog`) qui teste les domaines toutes les minutes et recharge Caddy à chaud en cas de coupure (résolution observée en moins de 60 secondes).

---

## INCIDENT 5 — OAuth Cline / Connexion au compte impossible

### Problème
La connexion au compte Cline (pour récupérer les crédits gratuits GLM et DeepSeek) échouait car le lien de retour tentait d'ouvrir le protocole natif `vscode://`.

### Cause
code-server s'exécute dans un navigateur Web et n'a pas accès direct aux gestionnaires de protocoles du système d'exploitation sans redirection web adaptée.

### Solution appliquée
Ajout de la variable d'environnement dans le service `code-server` du `docker-compose.yml` :
```yaml
environment:
  - PROXY_DOMAIN=code.livrezone.com
```
code-server transforme ainsi le callback `vscode://` en URL web HTTPS (`https://code.livrezone.com/vscode-app-uri-callback?...`), ce qui permet au navigateur de finaliser l'authentification OAuth.

---

## INCIDENT 6 — Disparition du workspace dans Edge & saturation lors de l'accès à `?folder=/workspace/livrezone`

### Problème
- Lors de l'ouverture de code-server dans Microsoft Edge, l'arborescence des projets était introuvable ou affichait une fenêtre vide.
- L'accès manuel à `https://code.livrezone.com/?folder=/workspace/livrezone` déclenchait systématiquement un blocage complet du serveur (Load average grimpant à 53, swap épuisée, crash système OOM).

### Causes
1. **Absence de `DEFAULT_WORKSPACE` dans `docker-compose.yml` :**  
   L'image `linuxserver/code-server` possède une variable par défaut : `"${DEFAULT_WORKSPACE:-/config/workspace}"`. En l'absence de cette variable dans le compose, l'IDE ouvrait par défaut `/config/workspace` (qui ne contenait aucun projet).
2. **Confusion sur le chemin réel des projets :**  
   Le volume monté dans le conteneur est :
   `/home/livrezone/docker-data/volumes/livrezone_html_data/_data` → `/workspace`  
   Les projets réels se trouvent directement à la racine de `/workspace/` (`api-next.livrezone.com`, `next.livrezone.com`, etc.).  
   Le sous-dossier `/workspace/livrezone` était un dossier vide accidentel contenant uniquement un fichier de configuration.
3. **Absence de protection Watcher au niveau du projet :**  
   Les règles d'exclusion de l'Incident 1 n'avaient été configurées qu'au niveau utilisateur (`/config/data/User/settings.json`). Dès lors qu'un nouveau workspace était ouvert ou après réinitialisation du profil, le watcher inotify de VS Code scannait à nouveau l'ensemble des dépendances (`vendor`, `node_modules`, `.next`), provoquant le crash immédiat.

### Solutions appliquées
1. **Exclusion permanente au niveau Workspace :**  
   Création de `/workspace/.vscode/settings.json` directement au sein du volume partagé :
   ```json
   {
       "files.exclude": {
           "apps.livrezone.com": true,
           "facturasahla.livrezone.com": true,
           "fastfacture.livrezone.com": true,
           "livrezone.com": true,
           "vendor": true,
           "next.livrezone.com/.git-backup": true
       },
       "search.exclude": {
           "**/node_modules": true,
           "**/.next": true,
           "**/storage/framework": true,
           "**/storage/logs": true,
           "**/vendor": true
       },
       "files.watcherExclude": {
           "**/.git/objects/**": true,
           "**/node_modules/**": true,
           "**/.next/**": true,
           "**/vendor/**": true,
           "**/storage/framework/**": true,
           "**/storage/logs/**": true,
           "**/bootstrap/cache/**": true,
           "**/public/build/**": true
       },
       "git.scanRepositories": ["/workspace"],
       "git.autoRepositoryDetection": false,
       "git.autorefresh": false
   }
   ```
   *Ce fichier fait partie intégrante du dossier racine et reste persistant même si le conteneur ou la configuration utilisateur de code-server est réinitialisé.*

2. **Configuration du workspace par défaut dans `docker-compose.yml` :**
   Ajout de la variable d'environnement :
   ```yaml
   environment:
     - DEFAULT_WORKSPACE=/workspace
   ```
   Reconstruction du conteneur avec `docker compose up -d --force-recreate code-server`. Désormais, toute ouverture de `https://code.livrezone.com/` charge directement et automatiquement `/workspace`.

3. **Nettoyage :** Suppression du répertoire vide parasite `/workspace/livrezone`.

4. **Résultat :** Le serveur reste parfaitement stable lors de l'accès au workspace (Load average mesuré à **0.62**, RAM stable).

---

## SOLUTION CIBLE & RECOMMANDATIONS FUTURES

### 1. Pérennisation des droits de fichiers (ACL)
Pour éviter de devoir réexécuter des commandes `chmod` / `chown` après chaque reconstruction Docker ou génération de build, il est fortement conseillé d'utiliser les listes de contrôle d'accès (ACL) avec héritage automatique par défaut :

```bash
# Applique les droits rwx aux utilisateurs 'livrezone' et 'ouahib' sur les fichiers existants
sudo setfacl -R -m u:livrezone:rwx,u:ouahib:rwx /home/livrezone/docker-data/volumes/livrezone_html_data/_data

# Le flag -d (default) garantit que TOUT NOUVEAU fichier créé héritera automatiquement de ces droits
sudo setfacl -R -d -m u:livrezone:rwx,u:ouahib:rwx /home/livrezone/docker-data/volumes/livrezone_html_data/_data
```

### 2. Migration du backend réseau rootless (`vpnkit` → `slirp4netns`)
Pour éliminer les blocages réseau résiduels du daemon rootless :
- Remplacer `--net=vpnkit` par `--net=slirp4netns` dans `/home/livrezone/bin/dockerd-rootless.sh`.
- Redémarrer la session systemd utilisateur : `systemctl --user -M livrezone@ restart docker`.

---

## Synthèse de l'état actuel

| Composant | Statut | Commentaire |
|---|---|---|
| Accès au Workspace | ✅ Opérationnel | Ouverture directe de `/workspace` via `DEFAULT_WORKSPACE` |
| Charge serveur & RAM | ✅ Normalisé | Load average ~0.6, File Watcher maîtrisé par `.vscode/settings.json` |
| Authentification Cline | ✅ Fonctionnel | OAuth validé grâce à `PROXY_DOMAIN=code.livrezone.com` |
| Caddy Reverse Proxy | ✅ Sécurisé | Watchdog cron actif toutes les 60 secondes |
| Extensions VS Code | ✅ Stabilisé | Répertoire unique `/config/.local/share/code-server/extensions/` |
| Droits disques | 🟡 À verrouiller | Passerelle `setfacl -d` prête à être appliquée |
