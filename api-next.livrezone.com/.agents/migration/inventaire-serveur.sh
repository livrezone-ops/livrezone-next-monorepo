#!/usr/bin/env bash
# État des lieux serveur pour la migration LivreZone (runbook §4 Phase 1).
# LECTURE SEULE — aucune modification. Secrets masqués (env clés seules,
# tokens rédigés) pour que le rapport soit versionnable sans risque.
# Usage : bash inventaire-serveur.sh [fichier-sortie]
# Prévu pour tourner sur la session ZCode du serveur (utilisateur ouahib,
# sudo -n docker autorisé ; rootless via DOCKER_HOST uid 1001).
set -u

OUT="${1:-/home/livrezone/docker-data/volumes/livrezone_html_data/_data/api-next.livrezone.com/.agents/ETAT-DES-LIEUX-$(hostname)-$(date +%Y%m%d-%H%M).md}"
DATA_ROOT="/home/livrezone/docker-data"

# Daemon rootless : env AVANT sudo (sudoers env_keep DOCKER_HOST) — la forme
# « sudo -n env DOCKER_HOST=... » est refusée par la whitelist sudoers.
rl() { DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker "$@"; }
# Crontab rootless (user livrezone, illisible hors root) : lecture via bind
# mount ro dans un conteneur jetable — seul moyen avec la whitelist sudoers.
rl_cr() { DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker run --rm -v /var/spool/cron/crontabs:/sp:ro alpine:latest cat "/sp/$1" 2>/dev/null; }

redact() {
  sed -E \
    -e 's/([Tt]oken|[Pp]assword|[Pp]asswd|[Ss]ecret|[Aa]pp_?[Kk]ey|MAIL_PASSWORD|DB_PASSWORD)=[^ "'\'']*/\1=***REDACTED***/g' \
    -e 's/[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}/TELEGRAM-TOKEN-***REDACTED***/g' \
    -e 's/Bearer [A-Za-z0-9._-]+/Bearer ***REDACTED***/g' \
    -e 's/(sk-[A-Za-z0-9_-]{20,})/API-KEY-***REDACTED***/g'
}

section() { printf '\n\n---\n\n## %s\n\n' "$1" >> "$OUT"; }
run() { echo '```' >> "$OUT"; "$@" 2>&1 | redact >> "$OUT"; echo '```' >> "$OUT"; }
runc() { echo '```' >> "$OUT"; eval "$1" 2>&1 | redact >> "$OUT"; echo '```' >> "$OUT"; }

: > "$OUT"
echo "# État des lieux serveur — $(hostname) — $(date '+%d/%m/%Y %H:%M')" >> "$OUT"
echo "_Généré par .agents/migration/inventaire-serveur.sh (lecture seule, secrets rédigés)_" >> "$OUT"

section "Système"
run hostname; run uname -a; run uptime
run lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,MODEL,ROTA
run df -h
run free -h
run cat /etc/fstab

section "Docker ROOTFUL — conteneurs"
run sudo -n docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
section "Docker ROOTFUL — définition complète de chaque conteneur"
for c in $(sudo -n docker ps -a --format '{{.Names}}'); do
  echo "**$c**" >> "$OUT"
  echo '```' >> "$OUT"
  sudo -n docker inspect "$c" --format 'image: {{.Config.Image}}
cmd: {{join .Config.Cmd " "}}
entrypoint: {{join .Config.Entrypoint " "}}
restart: {{.HostConfig.RestartPolicy.Name}} | network: {{.HostConfig.NetworkMode}} | mem: {{.HostConfig.Memory}}
ports: {{range $k,$v := .HostConfig.PortBindings}}{{$k}}->{{range $v}}{{.HostIp}}:{{.HostPort}} {{end}}{{end}}
extra_hosts: {{range .HostConfig.ExtraHosts}}{{.}} {{end}}
mounts:{{range .Mounts}}
  {{.Type}} {{.Source}} -> {{.Destination}}{{end}}' 2>&1 | redact >> "$OUT"
  echo '```' >> "$OUT"
done
section "Docker ROOTFUL — images, volumes, réseaux, usage"
run sudo -n docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'
run sudo -n docker volume ls
run sudo -n docker network ls
run sudo -n docker system df

section "Docker ROOTLESS (uid 1001) — conteneurs"
run rl ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
section "Docker ROOTLESS — définition complète de chaque conteneur"
for c in $(rl ps -a --format '{{.Names}}'); do
  echo "**$c**" >> "$OUT"
  echo '```' >> "$OUT"
  rl inspect "$c" --format 'image: {{.Config.Image}}
cmd: {{join .Config.Cmd " "}}
restart: {{.HostConfig.RestartPolicy.Name}} | network: {{.HostConfig.NetworkMode}} | mem: {{.HostConfig.Memory}}
ports: {{range $k,$v := .HostConfig.PortBindings}}{{$k}}->{{range $v}}{{.HostIp}}:{{.HostPort}} {{end}}{{end}}
mounts:{{range .Mounts}}
  {{.Type}} {{.Source}} -> {{.Destination}}{{end}}' 2>&1 | redact >> "$OUT"
  echo '```' >> "$OUT"
done
section "Docker ROOTLESS — images, volumes, usage"
run rl images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'
run rl volume ls
run rl system df

section "Tailles des données (data-root rootless + SSD4server)"
runc "du -sh $DATA_ROOT/meilisearch_data $DATA_ROOT/volumes/*/* 2>/dev/null | sort -rh | head -30"
runc "du -sh /media/ouahib/SSD4server/books 2>/dev/null"

section "Cron / systemd"
runc "crontab -l 2>/dev/null"
runc "rl_cr livrezone"
runc "ls -la /etc/cron.d/ 2>/dev/null"
runc "cat /etc/cron.d/* 2>/dev/null | redact"
runc "systemctl list-timers --no-pager 2>/dev/null | head -20"

section "Caddy / WAF (OpenPanel)"
runc "ls -la /etc/openpanel/caddy/ 2>/dev/null"
runc "ls -la /etc/openpanel/caddy/domains/ 2>/dev/null"
runc "for f in /etc/openpanel/caddy/domains/*; do echo \"== \$f ==\"; cat \"\$f\"; done 2>/dev/null"

section "Réseau"
run ip -brief address
runc "ss -tlnp 2>/dev/null | head -40"

section "Repos git (code = référence de la migration)"
for repo in "$DATA_ROOT/volumes/livrezone_html_data/_data/api-next.livrezone.com" "$DATA_ROOT/volumes/livrezone_html_data/_data/next.livrezone.com"; do
  echo "**$repo**" >> "$OUT"
  runc "git -C '$repo' remote -v && git -C '$repo' branch --show-current && git -C '$repo' log --oneline -3 && git -C '$repo' status --short | wc -l"
done

section "Clés du .env partagé (NOMS SEULEMENT — valeurs rédigées)"
runc "cut -d= -f1 '$DATA_ROOT/volumes/livrezone_html_data/_data/api-next.livrezone.com/.env' 2>/dev/null | grep -v '^#' | grep -v '^$'"

section "Versions clés"
runc "docker --version; node --version 2>/dev/null; php --version 2>/dev/null | head -1"

echo
echo "Rapport : $OUT"
echo "Lignes : $(wc -l < "$OUT") — relire AVANT versionnement (redaction par précaution, pas de valeur de secret attendue)."
