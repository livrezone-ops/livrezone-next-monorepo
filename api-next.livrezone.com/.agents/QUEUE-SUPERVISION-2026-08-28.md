# Supervision de la queue `database` — mise en place (28/08/2026)

Contexte : audit §court terme, item 5. Le worker de queue (jobs Scout `SCOUT_QUEUE=database`
+ mails) tourne via cron (`/etc/cron.d/lz-schedule`, `queue:work --stop-when-empty` chaque
minute par `docker exec php-fpm-8.5`). Risque historique : si le runner disparaît ou se
plante, les jobs s'accumulent **silencieusement** (c'est le mécanisme de la récidive
Meilisearch d'août 2026).

## Ce qui est en place

| Composant | Fichier | Rôle |
|---|---|---|
| Commande de santé | `app/Console/Commands/QueueHealthCheck.php` (`php artisan app:queue-health`) | Vérifie : backlog (pending > seuil), jobs delayed (normaux, non alertés), jobs reserved **bloqués** (> 2× `retry_after` = worker mort en plein traitement), âge du plus vieux job, `failed_jobs` non vide. |
| Planification | `routes/console.php` | `app:queue-health` toutes les 5 min (passe par le cron `schedule:run` existant). |
| Test | `tests/Feature/QueueHealthCheckTest.php` | 5 cas : queue saine silencieuse, backlog, reserved bloqué, failed_jobs, delayed ignorés. |

Comportement des alertes : **`Log::critical` uniquement en cas d'anomalie** (choix du
28/08 — pas de canal Telegram/e-mail pour l'instant), exit code FAILURE. À surveiller :
`storage/logs/laravel.log` (grep `Queue database en anomalie`), ou tout agent de collecte
de logs que l'on branchera plus tard.

## Seuils (options de la commande)

- `--max-pending=50` : jobs en attente simultanés
- `--max-age-minutes=30` : ancienneté max du plus vieux job en attente
- `--max-failed=0` : tout job échoué alerte (inspecter via `queue:failed`, rejouer via `queue:retry {id}`)

Ajustables dans `routes/console.php` si besoin, ex. :
`Schedule::command('app:queue-health', ['--max-pending' => 200])->everyFiveMinutes();`

## Exploitation au quotidien

```bash
# État de la queue (tableau + exit code)
docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan app:queue-health

# Échecs et rejeu
docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:failed
docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:retry {uuid}

# ⚠️ Piège documenté (BRIEFING-librairies) : réparer l'index Meilisearch sans vider
# la queue = réparé puis re-supprimé. Toujours vider/drainer la queue AVANT une
# réparation manuelle de l'index.
```

## Runner : état et option « propre »

Le runner cron actuel (`--stop-when-empty` chaque minute) est conservé : pas de daemon à
mourir, auto-relance chaque minute, et la supervision détecte toute dérive. Si l'on veut
le runner Supervisor/systemd de l'audit, l'unité type (côté hôte) est :

```ini
# /etc/systemd/system/lz-queue.service  (user ouahib, DOCKER_HOST socket utilisateur)
[Unit]
Description=LivreZone queue worker (docker exec)
After=docker.service

[Service]
User=ouahib
Environment=DOCKER_HOST=unix:///run/user/1001/docker.sock
ExecStart=/usr/bin/docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:work --tries=3 --timeout=60 --max-time=3600
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
```

En cas d'adoption : désactiver la ligne `queue:work` du cron (garder `schedule:run`) et
ajouter `--stop-when-empty` n'est plus nécessaire. Un test `php artisan app:queue-health`
doit rester vert après bascule.

## Reste à faire

- [x] ~~Déployer en prod~~ ✅ 28/08 : commit `cd863a1` déjà présent sur le volume serveur (même volume que le workspace) ; `migrate:status` rien en attente ; `app:queue-health` premier run vert (0 partout, exit 0).
- [x] ~~Vérifier l'enregistrement du scheduler~~ ✅ 28/08 : `schedule:list` → `*/5 * * * * app:queue-health` (next due 4 min).
- [ ] Cycle complet avec un vrai job : déclencher un forgot-password (compte de test) → vérifier que `En attente` repasse à 0. Fait au passage : « test e-mail réel » resté ouvert dans l'audit depuis le 26/08.
- [ ] Plus tard : brancher un canal d'alerte réel (Telegram admin, bot déjà opérationnel) si les logs critiques ne sont pas consultés régulièrement.

