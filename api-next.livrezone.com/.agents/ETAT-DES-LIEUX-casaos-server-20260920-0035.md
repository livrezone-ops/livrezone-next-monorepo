# État des lieux serveur — casaos-server — 20/09/2026 00:35
_Généré par .agents/migration/inventaire-serveur.sh (lecture seule, secrets rédigés)_


---

## Système

```
casaos-server
```
```
Linux casaos-server 6.1.0-38-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.147-1 (2025-08-02) x86_64 GNU/Linux
```
```
 00:35:15 up 2 days, 15:52,  1 user,  load average: 0,72, 0,64, 0,94
```
```
NAME     SIZE FSTYPE MOUNTPOINT               MODEL                 ROTA
sda    894,3G                                 KINGSTON SA400S37960G    0
└─sda1 894,3G ext4   /media/ouahib/SSD4server                          0
sdb    119,2G                                 AXM14S3-128GM-B          0
├─sdb1   512M vfat   /boot/efi                                         0
├─sdb2 117,8G ext4   /                                                 0
└─sdb3   977M swap   [SWAP]                                            0
```
```
Sys. de fichiers Taille Utilisé Dispo Uti% Monté sur
udev               5,8G       0  5,8G   0% /dev
tmpfs              1,2G     12M  1,2G   2% /run
/dev/sdb2          116G     62G   48G  57% /
tmpfs              5,8G       0  5,8G   0% /dev/shm
tmpfs              5,0M    8,0K  5,0M   1% /run/lock
/dev/sda1          880G    653G  218G  76% /media/ouahib/SSD4server
/dev/sdb1          511M    5,9M  506M   2% /boot/efi
tmpfs              1,2G    1,3M  1,2G   1% /run/user/1001
tmpfs              1,2G     72K  1,2G   1% /run/user/116
tmpfs              1,2G     72K  1,2G   1% /run/user/1000
```
```
               total       utilisé      libre     partagé tamp/cache   disponible
Mem:            11Gi       7,2Gi       272Mi        98Mi       4,5Gi       4,4Gi
Échange:       4,0Gi       1,4Gi       2,5Gi
```
```
# /etc/fstab: static file system information.
#
# Use 'blkid' to print the universally unique identifier for a
# device; this may be used with UUID= as a more robust way to name devices
# that works even if disks are added and removed. See fstab(5).
#
# systemd generates mount units based on this file, see systemd.mount(5).
# Please run 'systemctl daemon-reload' after making changes here.
#
# <file system> <mount point>   <type>  <options>       <dump>  <pass>
# / was on /dev/sdb2 during installation
UUID=c95bee06-ed2b-48b8-9417-1de422e5ac8b /               ext4    errors=remount-ro,usrquota,grpquota 0       1
# /boot/efi was on /dev/sdb1 during installation
UUID=2B27-A13C  /boot/efi       vfat    umask=0077      0       1
# swap was on /dev/sdb3 during installation
UUID=acda16ee-04c2-40bd-b71c-b5331ba3377a none            swap    sw              0       0
/swapfile none swap sw 0 0
UUID=a744e1d4-e902-46e8-b4bf-bca0efd3659b /media/ouahib/SSD4server ext4 defaults,nofail 0 2
```


---

## Docker ROOTFUL — conteneurs

```
livrezone-next	livrezone-next	Up 4 hours	0.0.0.0:3000->3000/tcp, :::3000->3000/tcp
learning-frontend	learning-learning-frontend	Up 25 hours	
learning-backend	learning-learning-backend	Up 25 hours	
cloudflared-rescue	cloudflare/cloudflared:latest	Up 2 days	
evolution_api	evoapicloud/evolution-api:latest	Up 2 days	0.0.0.0:8085->8080/tcp, :::8085->8080/tcp
evolution_postgres	postgres:15-alpine	Up 2 days (healthy)	5432/tcp
evolution_redis	redis:alpine	Up 2 days	6379/tcp
phpmyadmin	phpmyadmin:latest	Up 2 days	0.0.0.0:8888->80/tcp, :::8888->80/tcp
dbgate	dbgate/dbgate:latest	Up 2 days	0.0.0.0:8282->3000/tcp, :::8282->3000/tcp
openpanel	openpanel/openpanel-ui:1.7.66	Up 2 days	0.0.0.0:2083->2083/tcp, :::2083->2083/tcp
openadmin_ftp	openpanel/vsftpd	Up 2 days	0.0.0.0:21->21/tcp, :::21->21/tcp, 0.0.0.0:21000-21010->21000-21010/tcp, :::21000-21010->21000-21010/tcp
clamav	clamav/clamav:latest	Up 2 days (healthy)	
cloudflare-ddns	oznu/cloudflare-ddns:latest	Up 2 days	
openpanel_dns	ubuntu/bind9:latest	Up 2 days	0.0.0.0:53->53/tcp, 0.0.0.0:53->53/udp, :::53->53/tcp, :::53->53/udp, 953/tcp
openpanel_redis	redis:8.6.2-alpine	Up 2 days	6379/tcp
caddy	openpanel/caddy-coraza	Up 2 days	
openpanel_mysql	mariadb:10-focal	Up 2 days	127.0.0.1:3306->3306/tcp
```


---

## Docker ROOTFUL — définition complète de chaque conteneur

**livrezone-next**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**learning-frontend**
```
image: learning-learning-frontend
cmd: node server.js
entrypoint: docker-entrypoint.sh
restart: unless-stopped | network: host | mem: 0
ports: 
extra_hosts: 
mounts:
```
**learning-backend**
```
image: learning-learning-backend
cmd: uvicorn app.main:app --host 0.0.0.0 --port 8091 --proxy-headers --forwarded-allow-ips *
entrypoint: 
restart: unless-stopped | network: host | mem: 0
ports: 
extra_hosts: 
mounts:
  bind /home/ouahib/learning/data -> /data
  bind /media/ouahib/SSD4server/@anglais -> /courses
```
**cloudflared-rescue**
```
image: cloudflare/cloudflared:latest
cmd: tunnel --no-autoupdate --protocol http2 run --token eyJhIjoiYzFjZDllYTgwZGI5NGNjZGNiMzJjMTUyMjcxYzAzOTYiLCJ0IjoiODVjMDFmNGYtOWI4Yy00MmYzLWJhNTctNGI4MGQzNTIwNjEyIiwicyI6IllXSmlaRFUyWlRrdFpHTmlPQzAwT1dNeExUZzRZV010WWpaaU9ETm1PV1F6TXpSaSJ9
entrypoint: cloudflared --no-autoupdate
restart: unless-stopped | network: host | mem: 0
ports: 
extra_hosts: 
mounts:
```
**evolution_api**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got interface {}
```
**evolution_postgres**
```
image: postgres:15-alpine
cmd: postgres
entrypoint: docker-entrypoint.sh
restart: unless-stopped | network: evolution-api_evolution_net | mem: 0
ports: 
extra_hosts: 
mounts:
  volume /var/lib/docker/volumes/evolution-api_postgres_data/_data -> /var/lib/postgresql/data
```
**evolution_redis**
```
image: redis:alpine
cmd: redis-server --appendonly yes
entrypoint: docker-entrypoint.sh
restart: unless-stopped | network: evolution-api_evolution_net | mem: 0
ports: 
extra_hosts: 
mounts:
  volume /var/lib/docker/volumes/evolution-api_redis_data/_data -> /data
```
**phpmyadmin**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**dbgate**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**openpanel**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**openadmin_ftp**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got interface {}
```
**clamav**
```
image: clamav/clamav:latest
cmd: 
entrypoint: /init
restart: always | network: host | mem: 2147483648
ports: 
extra_hosts: 
mounts:
  bind /home -> /home
  bind /root/clamav-db -> /var/lib/clamav
```
**cloudflare-ddns**
```
image: oznu/cloudflare-ddns:latest
cmd: 
entrypoint: /init
restart: unless-stopped | network: cloudflare-ddns_default | mem: 12414091264
ports: 
extra_hosts: 
mounts:
```
**openpanel_dns**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got interface {}
```
**openpanel_redis**
```
image: redis:8.6.2-alpine
cmd: redis-server --unixsocket /tmp/redis/redis.sock --unixsocketperm 770
entrypoint: docker-entrypoint.sh
restart: always | network: root_openpanel_network | mem: 268435456
ports: 
extra_hosts: 
mounts:
  bind /tmp/redis -> /tmp/redis
```
**caddy**
```
image: openpanel/caddy-coraza
cmd: caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
entrypoint: 
restart: unless-stopped | network: host | mem: 1073741824
ports: 
extra_hosts: 
mounts:
  bind /var/log/caddy -> /var/log/caddy
  bind /etc/openpanel/caddy/ssl -> /data/caddy/certificates
  bind /etc/openpanel/caddy/Caddyfile -> /etc/caddy/Caddyfile
  bind /etc/localtime -> /etc/localtime
  bind /etc/openpanel/caddy -> /etc/openpanel/caddy
  bind /etc/openpanel/caddy/coraza_rules.conf -> /etc/openpanel/caddy/coraza_rules.conf
```
**openpanel_mysql**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```


---

## Docker ROOTFUL — images, volumes, réseaux, usage

```
livrezone-next:latest	1.05GB
livrezone-next:rollback-v8-20260919	1.05GB
node:22-slim	227MB
livrezone-next:rollback-20260919b	230MB
learning-learning-frontend:latest	210MB
learning-learning-backend:latest	190MB
livrezone-next:rollback-20260919	230MB
node:22-alpine	168MB
linuxserver/jellyfin:latest	915MB
livrezone-next:rollback-20260918	230MB
mon-openvscode-server:custom	828MB
composer:2	231MB
php:8.5-cli	579MB
cloudflare/cloudflared:latest	63.9MB
quay.io/skopeo/stable:latest	229MB
redis:alpine	119MB
postgres:15-alpine	292MB
openpanel/openpanel-ui:1.7.66	2.38GB
dbgate/dbgate:latest	446MB
phpmyadmin:latest	575MB
clamav/clamav:latest	233MB
evoapicloud/evolution-api:latest	1.28GB
redis:8.6.2-alpine	97.3MB
openpanel/vsftpd:latest	10.2MB
openpanel/caddy-coraza:latest	115MB
ubuntu/bind9:latest	95.9MB
ghcr.io/hotio/qbittorrent:release-5.0.4	136MB
mariadb:10-focal	414MB
oznu/cloudflare-ddns:latest	36.3MB
```
```
DRIVER    VOLUME NAME
local     2dbf3a363839b16c9bec18d66a1297fd9f72d7d8a2333be82b1f85298c52f983
local     97e73570747e33da0d3613d18c48aaf7a567f55315123be6a697d5c56280a518
local     evolution-api_evolution_instances
local     evolution-api_evolution_store
local     evolution-api_postgres_data
local     evolution-api_redis_data
local     livrezone-og-cache
local     livrezone_html_data
local     livrezone_webserver_data
local     lz-next-imgcache
local     root_mysql
```
```
NETWORK ID     NAME                          DRIVER    SCOPE
98dbfc588d29   bridge                        bridge    local
6269399f3f38   cloudflare-ddns_default       bridge    local
2e2d60242711   evolution-api_evolution_net   bridge    local
f00abf2eb888   host                          host      local
5d7540f29097   learning_default              bridge    local
3af0fea71bd0   livrezone_db                  bridge    local
75e0eeb73cac   none                          null      local
c9a5e594c48b   root_openpanel_network        bridge    local
```
```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          29        17        11.79GB   4.632GB (39%)
Containers      17        17        407.7MB   0B (0%)
Local Volumes   11        8         302.3MB   171B (0%)
Build Cache     72        0         1.132GB   1.132GB
```


---

## Docker ROOTLESS (uid 1001) — conteneurs

```
ff_web	nginx:1.27-alpine	Up 2 days	127.0.0.1:8088->80/tcp
ff_app	shinsenter/php:8.5-fpm	Up 2 days	22/tcp, 9000/tcp
ff_meili	getmeili/meilisearch:v1.13	Up 2 days	7700/tcp
ff_queue	shinsenter/php:8.5-fpm	Up 2 days	22/tcp, 9000/tcp
ff_scheduler	shinsenter/php:8.5-fpm	Up 2 days	22/tcp, 9000/tcp
ff_redis	redis:7-alpine	Up 2 days (healthy)	6379/tcp
ff_db	mariadb:11.4	Up 2 days (healthy)	3306/tcp
openvscode-server	mon-openvscode-server:v2	Up 2 days	0.0.0.0:8445->3000/tcp, :::8445->3000/tcp
reverb	shinsenter/php:8.5-fpm	Up 2 days	22/tcp, 9000/tcp, 127.0.0.1:6060->6060/tcp
meilisearch	getmeili/meilisearch:v1.10	Up 2 days	192.168.1.202:7700->7700/tcp
apache	httpd:alpine	Up 2 days	127.0.0.1:32773->80/tcp, 127.0.0.1:32774->443/tcp
livrezone-redis	redis:8-alpine	Up 2 days	6379/tcp
mariadb	mariadb:latest	Up 2 days (healthy)	0.0.0.0:32770->3306/tcp, :::32770->3306/tcp
php-fpm-8.5	shinsenter/php:8.5-fpm	Up 2 days	22/tcp, 9000/tcp
```


---

## Docker ROOTLESS — définition complète de chaque conteneur

**ff_web**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**ff_app**
```
image: shinsenter/php:8.5-fpm
cmd: php-fpm
restart: unless-stopped | network: fastfacture_ff_net | mem: 0
ports: 
mounts:
  bind /home/livrezone/docker-data/volumes/livrezone_html_data/_data/fastfacture.livrezone.com -> /var/www/html
```
**ff_meili**
```
image: getmeili/meilisearch:v1.13
cmd: /bin/sh -c /bin/meilisearch
restart: unless-stopped | network: fastfacture_ff_net | mem: 0
ports: 
mounts:
  volume /home/livrezone/docker-data/volumes/fastfacture_ff_meili/_data -> /meili_data
```
**ff_queue**
```
image: shinsenter/php:8.5-fpm
cmd: php artisan queue:work --tries=3 --timeout=120 --sleep=1
restart: unless-stopped | network: fastfacture_ff_net | mem: 0
ports: 
mounts:
  bind /home/livrezone/docker-data/volumes/livrezone_html_data/_data/fastfacture.livrezone.com -> /var/www/html
```
**ff_scheduler**
```
image: shinsenter/php:8.5-fpm
cmd: php artisan schedule:work
restart: unless-stopped | network: fastfacture_ff_net | mem: 0
ports: 
mounts:
  bind /home/livrezone/docker-data/volumes/livrezone_html_data/_data/fastfacture.livrezone.com -> /var/www/html
```
**ff_redis**
```
image: redis:7-alpine
cmd: redis-server --appendonly yes
restart: unless-stopped | network: fastfacture_ff_net | mem: 0
ports: 
mounts:
  volume /home/livrezone/docker-data/volumes/fastfacture_ff_redis/_data -> /data
```
**ff_db**
```
image: mariadb:11.4
cmd: mariadbd
restart: unless-stopped | network: fastfacture_ff_net | mem: 0
ports: 
mounts:
  volume /home/livrezone/docker-data/volumes/fastfacture_ff_db/_data -> /var/lib/mysql
```
**openvscode-server**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**reverb**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**meilisearch**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**apache**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**livrezone-redis**
```
image: redis:8-alpine
cmd: redis-server
restart: unless-stopped | network: livrezone_db | mem: 0
ports: 
mounts:
```
**mariadb**
```

template parsing error: template: :2:19: executing "" at <.Config.Cmd>: wrong type for value; expected []string; got []interface {}
```
**php-fpm-8.5**
```
image: shinsenter/php:8.5-fpm
cmd: php-fpm --allow-to-run-as-root
restart: unless-stopped | network: livrezone_db | mem: 1073741824
ports: 
mounts:
  bind /etc/openpanel/wordpress/wp-cli.phar -> /usr/local/bin/wp
  bind /home/livrezone/php.ini/8.5.ini -> /usr/local/etc/php/conf.d/zz-docker-shinsenter-php.ini
  bind /home/livrezone/php.ini/8.5.ini -> /usr/local/etc/php/php.ini
  bind /home/livrezone/docker-data/volumes/livrezone_html_data/_data -> /var/www/html
  bind /media/ouahib/SSD4server/books/covers -> /data/books/covers
```


---

## Docker ROOTLESS — images, volumes, usage

```
mariadb:11.4	455MB
mon-openvscode-server:v2	1.64GB
mon-openvscode-server:custom	1.18GB
node:22	1.64GB
redis:7-alpine	57.8MB
redis:8-alpine	160MB
shinsenter/php:8.5-fpm	489MB
mariadb:latest	476MB
httpd:alpine	97.3MB
alpine:latest	12.9MB
gitpod/openvscode-server:latest	848MB
nginx:1.27-alpine	74.5MB
getmeili/meilisearch:v1.13	240MB
getmeili/meilisearch:v1.10	232MB
```
```
DRIVER    VOLUME NAME
local     fastfacture_ff_db
local     fastfacture_ff_meili
local     fastfacture_ff_redis
local     livrezone_html_data
local     livrezone_mysql_data
local     livrezone_mysql_dumps
local     livrezone_webserver_data
```
```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          14        10        6.812GB   3.78GB (55%)
Containers      14        14        247.2MB   0B (0%)
Local Volumes   7         6         5.18GB    4.225GB (81%)
Build Cache     10        0         871.2MB   871.2MB
```


---

## Tailles des données (data-root rootless + SSD4server)

```
3,7G	/home/livrezone/docker-data/meilisearch_data
```
```
44G	/media/ouahib/SSD4server/books
```


---

## Cron / systemd

```
```
```
```
```
total 68
drwxr-xr-x   2 root root  4096  3 sept. 18:24 .
drwxr-xr-x 149 root root 12288 20 sept. 00:32 ..
-rw-r--r--   1 root root   285 10 janv.  2023 anacron
-rw-r--r--   1 root root    48 28 août  18:12 caddy-watchdog
-rw-r--r--   1 root root    14 13 nov.   2025 csf-cron
-rw-------   1 root root    48 24 juil. 21:50 csf_update
-rw-r--r--   1 root root   201  5 mars   2023 e2scrub_all
-rw-r--r--   1 root root    57  2 sept. 18:36 fix-livrezone-permissions
-rw-r--r--   1 root root    74 24 juil. 21:50 lfd-cron
-rw-r--r--   1 root root   694 30 août  02:48 lz-backup
-rw-r--r--   1 root root   493  3 sept. 00:05 lz-schedule
-rw-------   1 root root  3088 24 juil. 21:51 openpanel
-rw-r--r--   1 root root   712 13 juil.  2022 php
-rw-r--r--   1 root root   102  2 mars   2023 .placeholder
-rw-r--r--   1 root root   236  3 sept. 18:24 slice-watch
```
```
# /etc/cron.d/anacron: crontab entries for the anacron package

SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

30 7-23 * * *   root	[ -x /etc/init.d/anacron ] && if [ ! -d /run/systemd/system ]; then /usr/sbin/invoke-rc.d anacron start >/dev/null; fi
* * * * * root /usr/local/bin/caddy-watchdog.sh
SHELL=/bin/sh
30 3 * * 0 root test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/x86_64-linux-gnu/e2fsprogs/e2scrub_all_cron
10 3 * * * root test -e /run/systemd/system || SERVICE_MODE=1 /sbin/e2scrub_all -A -r
@reboot root /usr/local/bin/fix-livrezone-permissions.sh
SHELL=/bin/sh
0 0 * * * root /usr/sbin/csf --lfd restart > /dev/null 2>&1
# /etc/cron.d/lz-backup — Backup quotidien LivreZone → Google Drive
# Étape 0-bis — AUDIT-2026-08-25.md (CRUCIAL)
# Installation : sudo install -m 644 -o root -g root lz-backup /etc/cron.d/lz-backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Backup quotidien à 04:15 (décalé du scheduler Laravel déjà actif chaque minute ;
# dump --single-transaction : aucun verrou bloquant sur InnoDB)
15 4 * * * root /usr/local/bin/lz-backup-daily.sh >> /var/log/lz-backup-cron.log 2>&1

# Test mensuel de restauration (« un backup non testé n'existe pas »)
30 5 1 * * root /usr/local/bin/lz-backup-restore-test.sh >> /var/log/lz-backup-cron.log 2>&1
# Laravel scheduler LivreZone - toutes les minutes via Docker rootless
* * * * * root flock -n /tmp/lz-schedule.lock sh -c 'DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan schedule:run' >> /dev/null 2>&1
* * * * * root flock -n /tmp/lz-queue.lock sh -c 'DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:work --stop-when-empty' >> /dev/null 2>&1

# /etc/cron.d/php@PHP_VERSION@: crontab fragment for PHP
#  This purges session files in session.save_path older than X,
#  where X is defined in seconds as the largest value of
#  session.gc_maxlifetime from all your SAPI php.ini files
#  or 24 minutes if not defined.  The script triggers only
#  when session.save_handler=files.
#
#  WARNING: The scripts tries hard to honour all relevant
#  session PHP options, but if you do something unusual
#  you have to disable this script and take care of your
#  sessions yourself.

# Look for and purge old sessions every 30 minutes
09,39 *     * * *     root   [ -x /usr/lib/php/sessionclean ] && if [ ! -d /run/systemd/system ]; then /usr/lib/php/sessionclean; fi
# Surveillance mémoire slice user-1001 (incident 524 du 03/09/2026)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
* * * * * root /usr/local/bin/slice-memory-watch.sh >> /var/log/slice-watch.log 2>&1
```
```
NEXT                        LEFT          LAST                        PASSED      UNIT                         ACTIVATES
Sun 2026-09-20 00:39:00 +01 3min 37s left Sun 2026-09-20 00:09:00 +01 26min ago   phpsessionclean.timer        phpsessionclean.service
Sun 2026-09-20 03:10:15 +01 2h 34min left Sun 2026-09-13 03:10:38 +01 6 days ago  e2scrub_all.timer            e2scrub_all.service
Sun 2026-09-20 03:26:29 +01 2h 51min left Sat 2026-09-19 12:57:55 +01 11h ago     apt-daily.timer              apt-daily.service
Sun 2026-09-20 03:50:41 +01 3h 15min left Sat 2026-09-19 08:19:11 +01 16h ago     plocate-updatedb.timer       plocate-updatedb.service
Sun 2026-09-20 05:20:31 +01 4h 45min left Sat 2026-09-19 07:54:44 +01 16h ago     man-db.timer                 man-db.service
Sun 2026-09-20 06:34:45 +01 5h 59min left Sat 2026-09-19 06:03:30 +01 18h ago     apt-daily-upgrade.timer      apt-daily-upgrade.service
Sun 2026-09-20 07:33:25 +01 6h left       Sat 2026-09-19 23:32:30 +01 1h 2min ago anacron.timer                anacron.service
Sun 2026-09-20 08:58:12 +01 8h left       Sat 2026-09-19 08:58:12 +01 15h ago     systemd-tmpfiles-clean.timer systemd-tmpfiles-clean.service
Sun 2026-09-20 11:13:44 +01 10h left      Sun 2026-09-20 00:05:18 +01 30min ago   fwupd-refresh.timer          fwupd-refresh.service
Mon 2026-09-21 00:00:00 +01 23h left      Sun 2026-09-20 00:00:00 +01 35min ago   dpkg-db-backup.timer         dpkg-db-backup.service
Mon 2026-09-21 00:00:00 +01 23h left      Sun 2026-09-20 00:00:00 +01 35min ago   logrotate.timer              logrotate.service
Mon 2026-09-21 00:04:46 +01 23h left      Mon 2026-09-14 00:04:07 +01 6 days ago  fstrim.timer                 fstrim.service

12 timers listed.
Pass --all to see loaded but inactive timers, too.
```


---

## Caddy / WAF (OpenPanel)

```
total 76
drwxr-xr-x  6 root root 4096  6 sept. 12:07 .
drwxr-xr-x 28 root root 4096 24 juil. 21:48 ..
-rw-r--r--  1 root root  362  2 sept. 11:28 Caddyfile
-rw-r--r--  1 root root  736 27 août  18:46 Caddyfile.bak-2026-08-27
-rw-r--r--  1 root root  325 24 juil. 21:48 check.conf
-rw-r--r--  1 root root  510  2 sept. 19:48 code.livrezone.com.conf.removed-20260902
-rw-r--r--  1 root root 8527  9 août  01:20 coraza_rules.conf
drwxr-xr-x 10 root root 4096 24 juil. 21:51 coreruleset
-rw-r--r--  1 root root  406 17 août  01:39 custom_waf_api.conf
drwxr-xr-x  2 root root 4096 15 sept. 23:10 domains
-rw-r--r--  1 root root 2269  2 sept. 19:53 fastfacture.livrezone.com.conf.removed-20260902
-rw-r--r--  1 root root 2295  6 sept. 12:07 livrezone.com.conf.removed-20260906
-rw-r--r--  1 root root 2242  2 sept. 11:55 next.livrezone.com.conf.bak-20260902-next502
-rw-r--r--  1 root root 2250  3 sept. 22:16 next.livrezone.com.conf.bak-20260903-nextimage
-rw-r--r--  1 root root  308 24 juil. 21:51 redirects.conf
drwxr-xr-x  3 root root 4096 25 juil. 01:39 ssl
drwxr-xr-x  2 root root 4096 24 juil. 21:48 templates
```
```
total 64
drwxr-xr-x 2 root   root   4096 15 sept. 23:10 .
drwxr-xr-x 6 root   root   4096  6 sept. 12:07 ..
-rw-r--r-- 1 root   root   2502  3 sept. 00:42 api-next.livrezone.com.conf
-rw-r--r-- 1 root   root   2213 27 juil. 15:23 apps.livrezone.com.conf
-rw-r--r-- 1 root   root    232 25 juil. 09:50 casa.livrezone.com.conf
-rw-r--r-- 1 root   root    244 31 juil. 01:05 dbgate.livrezone.com.conf
-rw-r--r-- 1 root   root    272 19 août  23:33 deepseek.livrezone.com.conf
-rw-r--r-- 1 root   root   2441 13 sept. 21:34 fastfacture.livrezone.com.conf
-rw-r--r-- 1 root   root    242 25 juil. 10:09 jellyfin.livrezone.com.conf
-rw-r--r-- 1 root   root    487 15 sept. 23:12 learning.livrezone.com.conf
-rw-r--r-- 1 root   root   2764  6 sept. 12:09 livrezone.com.conf
-rw-r--r-- 1 root   root   2213 30 août  21:21 mimo.livrezone.com.conf
-rw-r--r-- 1 root   root    984  6 sept. 20:21 next.livrezone.com.conf
-rw-r--r-- 1 root   root    233 25 juil. 10:12 qb.livrezone.com.conf
-rw-r--r-- 1 ouahib ouahib  580  2 sept. 00:06 vscode.livrezone.com.conf
-rw-r--r-- 1 root   root    568  3 sept. 01:48 was.livrezone.com.conf
```
```
== /etc/openpanel/caddy/domains/api-next.livrezone.com.conf ==
# HTTP block (port 80) - Handles HTTP traffic
http://api-next.livrezone.com, http://www.api-next.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log api-next.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/custom_waf_api.conf
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/api-next.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTP traffic (port 80)
    reverse_proxy http://127.0.0.1:32773 {
      header_up Host {host}
    }
  }
}










# HTTPS block (port 443) - Handles HTTPS traffic
https://api-next.livrezone.com, https://www.api-next.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log api-next.livrezone.com

  route {

	    # WebSocket Reverb
    handle /app/* {
        reverse_proxy 127.0.0.1:6060
    }




    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/custom_waf_api.conf
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/api-next.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTPS traffic (port 443)
    handle {
        reverse_proxy https://127.0.0.1:32774 {
          transport http {
            tls_insecure_skip_verify
          }
          header_up Host {host}
        }
    }



    # Terminate TLS and pass to Varnish
#    reverse_proxy http://127.0.0.1:32773 {
#      header_up Host {host}
#    }

  }

  # SSL (only when SSL certificate is requested)
  tls {
    on_demand
  }
}
== /etc/openpanel/caddy/domains/apps.livrezone.com.conf ==
# HTTP block (port 80) - Handles HTTP traffic
http://apps.livrezone.com, http://www.apps.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log apps.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/apps.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTP traffic (port 80)
    reverse_proxy http://127.0.0.1:32773 {
      header_up Host {host}
    }
  }
}










# HTTPS block (port 443) - Handles HTTPS traffic
https://apps.livrezone.com, https://www.apps.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log apps.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/apps.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTPS traffic (port 443)
    reverse_proxy https://127.0.0.1:32774 {
      transport http {
        tls_insecure_skip_verify
      }
      header_up Host {host}
    }

#    # Terminate TLS and pass to Varnish
#    reverse_proxy http://127.0.0.1:32773 {
#      header_up Host {host}
#    }

  }

  # SSL (only when SSL certificate is requested)
  tls {
    on_demand
  }
}
== /etc/openpanel/caddy/domains/casa.livrezone.com.conf ==
# CasaOS
http://casa.livrezone.com {

    encode zstd gzip

    reverse_proxy http://127.0.0.1:8080
}

https://casa.livrezone.com {

    encode zstd gzip

    reverse_proxy http://127.0.0.1:8080

    tls {
        on_demand
    }
}
== /etc/openpanel/caddy/domains/dbgate.livrezone.com.conf ==
# DbGate
http://dbgate.livrezone.com {

    encode zstd gzip

    reverse_proxy http://192.168.1.202:8282
}

https://dbgate.livrezone.com {

    encode zstd gzip

    reverse_proxy http://192.168.1.202:8282

    tls {
        on_demand
    }
}
== /etc/openpanel/caddy/domains/deepseek.livrezone.com.conf ==
deepseek.livrezone.com {
    encode zstd gzip

    @needsauth not header Upgrade websocket

    basic_auth @needsauth {
        ouahib $2a$14$DDBY02BWGfihWLH9UarjM.2G78XRouSM5ILDS1OFxjYyoFBIHQQ0S
    }

    reverse_proxy 127.0.0.1:3080
    tls {
        on_demand
    }
}
== /etc/openpanel/caddy/domains/fastfacture.livrezone.com.conf ==
# fastfacture.livrezone.com — bascule stack dédiée ff_web (127.0.0.1:8088) le 13/09/2026
# Reconstruit depuis fastfacture.livrezone.com.conf.removed-20260902 (vhost retiré lors de l'incident du 02/09)
# ⚠️ Ne JAMAIS déposer de fichier .bak/.save dans ce dossier (glob import domains/* — panne 521 du 02/09)

# HTTP block (port 80) - Handles HTTP traffic
http://fastfacture.livrezone.com, http://www.fastfacture.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log fastfacture.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/fastfacture.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Stack dédiée FastFacture (nginx ff_web, HTTP interne)
    reverse_proxy http://127.0.0.1:8088 {
      header_up Host {host}
    }
  }
}

# HTTPS block (port 443) - Handles HTTPS traffic
https://fastfacture.livrezone.com, https://www.fastfacture.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log fastfacture.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/fastfacture.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Stack dédiée FastFacture (nginx ff_web, HTTP interne)
    reverse_proxy http://127.0.0.1:8088 {
      header_up Host {host}
    }

  }

  # SSL (only when SSL certificate is requested)
  tls {
    on_demand
  }
}
== /etc/openpanel/caddy/domains/jellyfin.livrezone.com.conf ==
# Jellyfin
http://jellyfin.livrezone.com {

    encode zstd gzip

    reverse_proxy http://127.0.0.1:8097
}

https://jellyfin.livrezone.com {

    encode zstd gzip

    reverse_proxy http://127.0.0.1:8097

    tls {
        on_demand
    }
}
== /etc/openpanel/caddy/domains/learning.livrezone.com.conf ==
http://learning.livrezone.com {
	import domain_log learning.livrezone.com
	redir https://learning.livrezone.com{uri} permanent
}

https://learning.livrezone.com {
	import domain_log learning.livrezone.com

	encode zstd gzip

	@needsauth not header Upgrade websocket

	basic_auth @needsauth {
		ouahib $2a$14$ZGmyGoFAhdlswimKi8UoWODx2p9tke9IspOcBpyTWUH7.rZQoUO2e
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:8091
	}

	handle {
		reverse_proxy 127.0.0.1:3091
	}

	tls {
		on_demand
	}
}
== /etc/openpanel/caddy/domains/livrezone.com.conf ==
# HTTP block (port 80) - Handles HTTP traffic
http://livrezone.com, http://www.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            # 03/09/2026 : /_next/image (optimiseur Next.js) — endpoint statique en
            # lecture seule ; les URL encodees du parametre url declenchent le CRS.
            SecRule REQUEST_URI "@streq /_next/image" "id:100900,phase:1,pass,nolog,ctl:ruleEngine=Off"
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTP traffic (port 80)
    reverse_proxy http://192.168.1.202:3000 {
      header_up Host {host}
    }
  }
}










# HTTPS block (port 443) - Handles HTTPS traffic
https://livrezone.com, https://www.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            # 03/09/2026 : /_next/image (optimiseur Next.js) — endpoint statique en
            # lecture seule ; les URL encodees du parametre url declenchent le CRS.
            SecRule REQUEST_URI "@streq /_next/image" "id:100900,phase:1,pass,nolog,ctl:ruleEngine=Off"
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTPS traffic (port 443)
    reverse_proxy http://192.168.1.202:3000 { 
      header_up Host {host}
    }

#    # Terminate TLS and pass to Varnish
#    reverse_proxy http://127.0.0.1:32773 {
#      header_up Host {host}
#    }

  }

  # SSL (only when SSL certificate is requested)
  tls {
    on_demand
  }
}
== /etc/openpanel/caddy/domains/mimo.livrezone.com.conf ==
# HTTP block (port 80) - Handles HTTP traffic
http://mimo.livrezone.com, http://www.mimo.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log mimo.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/mimo.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTP traffic (port 80)
    reverse_proxy http://127.0.0.1:32773 {
      header_up Host {host}
    }
  }
}










# HTTPS block (port 443) - Handles HTTPS traffic
https://mimo.livrezone.com, https://www.mimo.livrezone.com {

  # compress
  encode zstd gzip

  # logging
  import domain_log mimo.livrezone.com

  route {

    # redirects
    import /etc/openpanel/caddy/redirects.conf

    # modsecurity
    coraza_waf {
        load_owasp_crs
        directives `
            Include /etc/openpanel/caddy/coraza_rules.conf
            Include /etc/openpanel/caddy/coreruleset/crs-setup.conf.example
            Include /etc/openpanel/caddy/coreruleset/rules/*.conf
            SecRuleEngine On
            SecAuditEngine RelevantOnly
            SecRuleRemoveById 007
            SecRuleRemoveByTag example
            SecAuditLog /var/log/caddy/coraza_waf/mimo.livrezone.com.log
            SecAuditLogParts AHFZ
            SecAuditLogFormat json
        `
    }

    # Handle HTTPS traffic (port 443)
    reverse_proxy https://127.0.0.1:32774 {
      transport http {
        tls_insecure_skip_verify
      }
      header_up Host {host}
    }

#    # Terminate TLS and pass to Varnish
#    reverse_proxy http://127.0.0.1:32773 {
#      header_up Host {host}
#    }

  }

  # SSL (only when SSL certificate is requested)
  tls {
    on_demand
  }
}
== /etc/openpanel/caddy/domains/next.livrezone.com.conf ==
# ============================================================
# Étape 4 migration 06/09/2026 (ZCode) : 301 permanent
# next.livrezone.com + www.next.livrezone.com -> https://livrezone.com{uri}
# Ancienne conf (reverse_proxy 192.168.1.202:3000 + WAF) en backup :
#   /tmp/next.livrezone.com.conf.bak-20260906
#   + copie repo api-next.livrezone.com/.agents/caddy-backups/
# Rollback : restaurer le backup dans ce fichier, puis
#   docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
#   docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
# ============================================================

http://next.livrezone.com, http://www.next.livrezone.com {
  import domain_log next.livrezone.com
  redir https://livrezone.com{uri} permanent
}

https://next.livrezone.com, https://www.next.livrezone.com {
  import domain_log next.livrezone.com
  redir https://livrezone.com{uri} permanent

  tls {
    on_demand
  }
}
== /etc/openpanel/caddy/domains/qb.livrezone.com.conf ==
# qBittorrent
http://qb.livrezone.com {

    encode zstd gzip

    reverse_proxy http://127.0.0.1:8181
}

https://qb.livrezone.com {

    encode zstd gzip

    reverse_proxy http://127.0.0.1:8181

    tls {
        on_demand
    }
}
== /etc/openpanel/caddy/domains/vscode.livrezone.com.conf ==
# HTTP (Redirection automatique vers HTTPS)
http://vscode.livrezone.com {
    encode zstd gzip
    redir https://vscode.livrezone.com{uri} permanent
}

# HTTPS
https://vscode.livrezone.com {
    encode zstd gzip

    # Authentification par mot de passe sécurisée
    basic_auth {
        ouahib $2a$14$ZGmyGoFAhdlswimKi8UoWODx2p9tke9IspOcBpyTWUH7.rZQoUO2e
    }

    reverse_proxy http://192.168.1.202:8445 {
        # Retry automatique si openvscode-server n'est pas encore prêt
        lb_try_duration 5m
        lb_try_interval 5s
    }

    tls {
        on_demand
    }
}
== /etc/openpanel/caddy/domains/was.livrezone.com.conf ==
# HTTP (Redirection automatique vers HTTPS)
http://was.livrezone.com {
    encode zstd gzip
    redir https://was.livrezone.com{uri} permanent
}

# HTTPS
https://was.livrezone.com {
    encode zstd gzip

    # Authentification par mot de passe sécurisée
    basic_auth {
        ouahib $2a$14$ZGmyGoFAhdlswimKi8UoWODx2p9tke9IspOcBpyTWUH7.rZQoUO2e
    }

    reverse_proxy http://192.168.1.202:8085 {
        # Retry automatique si openwas-server n'est pas encore prêt
        lb_try_duration 5m
        lb_try_interval 5s
    }

    tls {
        on_demand
    }
}
```


---

## Réseau

```
lo               UNKNOWN        127.0.0.1/8 ::1/128 
enp14s0          DOWN           
enx00e04c681175  UP             192.168.1.202/24 fe80::1623:57cd:e33d:febd/64 
wlp2s0           DOWN           
br-3af0fea71bd0  UP             172.24.0.1/16 fe80::42:64ff:fee3:9812/64 
br-5d7540f29097  DOWN           172.25.0.1/16 
br-6269399f3f38  UP             172.23.0.1/16 fe80::42:e7ff:fe6c:5bf8/64 
br-c9a5e594c48b  UP             172.20.0.1/24 fe80::42:76ff:fe25:7ca7/64 
docker0          UP             172.17.0.1/16 fe80::42:51ff:febf:613e/64 
br-2e2d60242711  UP             172.26.0.1/16 fe80::42:eaff:fe0d:4ce3/64 
vethf230980@if11 UP             fe80::9c0a:dff:fe12:6d68/64 
veth861e8db@if13 UP             fe80::1c38:68ff:fe47:4cfe/64 
veth73d55f9@if15 UP             fe80::e8b8:c1ff:fe78:50db/64 
vethb62e25f@if17 UP             fe80::28b7:aeff:fe96:4d80/64 
veth1fe9df8@if21 UP             fe80::3827:43ff:fed0:431b/64 
vetha0d3062@if23 UP             fe80::f8c9:9aff:fef6:8924/64 
veth67b8bb6@if25 UP             fe80::d838:62ff:fec5:c7de/64 
veth2ee0bed@if27 UP             fe80::e054:9dff:fe71:d174/64 
veth39616f7@if29 UP             fe80::10c3:64ff:fe29:44ec/64 
veth6325449@if31 UP             fe80::d040:4ff:fe66:be90/64 
veth1ab1ffc@if33 UP             fe80::c4de:3dff:fe48:2e05/64 
veth5267f15@if35 UP             fe80::fa:ff:fe9b:a07/64 
vetha57afb4@if307 UP             fe80::603d:5cff:fe81:e510/64 
```
```
State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
LISTEN 0      4096       127.0.0.1:39221      0.0.0.0:*          
LISTEN 0      200          0.0.0.0:3310       0.0.0.0:*          
LISTEN 0      511          0.0.0.0:3091       0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:3000       0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:8088       0.0.0.0:*          
LISTEN 0      2048         0.0.0.0:2087       0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:2083       0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:37885      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:8888       0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:8445       0.0.0.0:*          
LISTEN 0      50           0.0.0.0:139        0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:38739      0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:6060       0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:8282       0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:53         0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:32770      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21         0.0.0.0:*          
LISTEN 0      128          0.0.0.0:22         0.0.0.0:*          
LISTEN 0      50           0.0.0.0:445        0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:35163      0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:34939      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:8085       0.0.0.0:*          
LISTEN 0      2048         0.0.0.0:8091       0.0.0.0:*          
LISTEN 0      4096   192.168.1.202:7700       0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:3306       0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:32774      0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:32773      0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:41849      0.0.0.0:*          
LISTEN 0      128        127.0.0.1:631        0.0.0.0:*          
LISTEN 0      4096       127.0.0.1:42333      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21005      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21004      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21007      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21006      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21001      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21000      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21003      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21002      0.0.0.0:*          
LISTEN 0      4096         0.0.0.0:21009      0.0.0.0:*          
```


---

## Repos git (code = référence de la migration)

**/home/livrezone/docker-data/volumes/livrezone_html_data/_data/api-next.livrezone.com**
```
origin	https://github.com/livrezone-ops/livrezone-next-monorepo.git (fetch)
origin	https://github.com/livrezone-ops/livrezone-next-monorepo.git (push)
upstream	git@github.com:livrezone-ops/livrezone-next-monorepo.git (fetch)
upstream	git@github.com:livrezone-ops/livrezone-next-monorepo.git (push)
main
a99767f docs(migration): runbook nouveau serveur + stratégie SSD4server (supersédée) + prompt n8n
16b5e15 feat(covers): scripts migration couvertures (externes→internes, PC, remplacement)
f57563d ui(front): SmartCoverImage généralisé + catégories masquées côté client
3
```
**/home/livrezone/docker-data/volumes/livrezone_html_data/_data/next.livrezone.com**
```
origin	https://github.com/livrezone-ops/livrezone-next-monorepo.git (fetch)
origin	https://github.com/livrezone-ops/livrezone-next-monorepo.git (push)
upstream	git@github.com:livrezone-ops/livrezone-next-monorepo.git (fetch)
upstream	git@github.com:livrezone-ops/livrezone-next-monorepo.git (push)
main
a99767f docs(migration): runbook nouveau serveur + stratégie SSD4server (supersédée) + prompt n8n
16b5e15 feat(covers): scripts migration couvertures (externes→internes, PC, remplacement)
f57563d ui(front): SmartCoverImage généralisé + catégories masquées côté client
3
```


---

## Clés du .env partagé (NOMS SEULEMENT — valeurs rédigées)

```
APP_NAME
APP_ENV
APP_KEY
APP_DEBUG
APP_URL
APP_LOCALE
APP_FALLBACK_LOCALE
APP_FAKER_LOCALE
APP_MAINTENANCE_DRIVER
BCRYPT_ROUNDS
LOG_CHANNEL
LOG_STACK
LOG_DEPRECATIONS_CHANNEL
LOG_LEVEL
DB_CONNECTION
DB_HOST
DB_PORT
DB_DATABASE
DB_USERNAME
DB_PASSWORD
SESSION_DRIVER
SESSION_LIFETIME
SESSION_ENCRYPT
SESSION_PATH
SESSION_DOMAIN
SESSION_SAME_SITE
SESSION_SECURE_COOKIE
BROADCAST_CONNECTION
FILESYSTEM_DISK
QUEUE_CONNECTION
REVERB_SERVER_HOST
REVERB_SERVER_PORT
REVERB_HOST
REVERB_PORT
REVERB_SCHEME
REVERB_APP_ID
REVERB_APP_KEY
REVERB_APP_SECRET
VITE_REVERB_APP_KEY
VITE_REVERB_HOST
VITE_REVERB_PORT
VITE_REVERB_SCHEME
CACHE_STORE
MEMCACHED_HOST
REDIS_CLIENT
REDIS_HOST
REDIS_PASSWORD
REDIS_PORT
MAIL_MAILER
MAIL_HOST
MAIL_PORT
MAIL_USERNAME
MAIL_PASSWORD
MAIL_ENCRYPTION
MAIL_FROM_ADDRESS
MAIL_FROM_NAME
MAIL_SCHEME
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION
AWS_BUCKET
AWS_USE_PATH_STYLE_ENDPOINT
VITE_APP_NAME
SANCTUM_STATEFUL_DOMAINS
FRONTEND_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
BOOK_COVERS_ORIGINAL_PATH
BOOK_COVERS_PUBLIC_PATH
BOOK_COVERS_TEMP_PATH
BOOK_COVERS_URL
TELEGRAM_ENABLED
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
TELEGRAM_BOT_USERNAME
TELEGRAM_WEBHOOK_SECRET
SCOUT_DRIVER
MEILISEARCH_HOST
MEILISEARCH_KEY
ANTI_SCRAPING_ENABLED
ANTI_SCRAPING_MAX_REQUESTS
MAX_FREE_LISTINGS
PRO_PRICE
PREMIUM_PRICE
PROMO_PRO_FREE
PRO_NOTIFICATION_DELAY_HOURS
PAYMENT_SIMULATOR
CMI_ENABLED
FATOURATI_ENABLED
SCOUT_QUEUE
WHATSAPP_ENABLED
WHATSAPP_API_URL
WHATSAPP_API_KEY
WHATSAPP_INSTANCE
```


---

## Versions clés

```
Docker version 20.10.24+dfsg1, build 297e128
v18.20.4
PHP 8.3.33 (cli) (built: Jul 30 2026 15:43:59) (NTS)
```
