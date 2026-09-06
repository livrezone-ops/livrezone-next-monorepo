# Runbook rotation des secrets — 06/09/2026 (reporté par le propriétaire)

À exécuter **un par un, dans l'ordre, en testant entre chaque**. Les saisies
`read -s` / interactives n'apparaissent ni dans l'historique bash, ni dans la
ligne de commande, ni dans le chat.

## Étape 0 — Sauvegarde obligatoire

```bash
sudo docker --context livrezone exec -it mariadb mariadb-dump -u root -p --all-databases > /root/db-backup-$(date +%F).sql
```

## 1. Comptes du site (admin + vendeurs)

```bash
read -s -p "Nouveau mot de passe : " PW && echo
DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec -e PW="$PW" php-fpm-8.5 \
  php /var/www/html/api-next.livrezone.com/artisan tinker --execute='App\Models\User::where("email","TON_EMAIL")->first()->update(["password"=>Hash::make(getenv("PW"))]);'
unset PW
```

## 2. MariaDB — utilisateur de l'appli UNIQUEMENT (jamais root : OpenPanel/phpMyAdmin l'utilisent)

```bash
grep ^DB_USERNAME /home/livrezone/docker-data/volumes/livrezone_html_data/_data/api-next.livrezone.com/.env
sudo docker --context livrezone exec -it mariadb mariadb -u root -p
# dans MariaDB : ALTER USER 'UTILISATEUR_DB'@'%' IDENTIFIED BY 'NouveauMotDePasse'; FLUSH PRIVILEGES; exit
read -s -p "Même mot de passe : " DBPW && echo
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DBPW}|" /home/livrezone/docker-data/volumes/livrezone_html_data/_data/api-next.livrezone.com/.env
unset DBPW
# test : doit afficher 1
DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan tinker --execute='echo DB::selectOne("select 1 ok")->ok;'
```

## 3. Meilisearch — nouvelle master key (index persistants dans le volume)

```bash
openssl rand -hex 32
sudo docker --context livrezone inspect meilisearch --format '{{.Config.Image}} | {{json .Mounts}} | {{json .HostConfig.PortBindings}}'
sudo docker --context livrezone rm -f meilisearch
sudo docker --context livrezone run -d --name meilisearch --restart unless-stopped \
  -e MEILI_MASTER_KEY="NouvelleCle" -e MEILI_ENV=production \
  -v <volume-vu-dans-inspect> -p 192.168.1.202:7700:7700 <l-image>
read -s -p "Même clé : " MK && echo
sed -i "s|^MEILISEARCH_KEY=.*|MEILISEARCH_KEY=${MK}|" /home/livrezone/docker-data/volumes/livrezone_html_data/_data/api-next.livrezone.com/.env
unset MK
# test : doit afficher ≥ 1 hit
DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan tinker --execute='echo App\Models\Book::search("harry")->take(1)->get()->count()." hit";'
```

## 4. Reverb — secret (le front n'utilise que la clé publique)

Synchroniser backend `.env` (REVERB_APP_SECRET) **puis** recréer le conteneur
`reverb` avec le même secret (inspecter d'abord sa conf comme en 3). Quelques
secondes de décalage possible sur le chat pendant la bascule.

## 5. APP_KEY — déconnecte tout le monde, à heure creuse

Aucune donnée chiffrée en base (vérifié 06/09) → rotation sûre :

```bash
DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec -w /var/www/html/api-next.livrezone.com php-fpm-8.5 php artisan key:generate --force
```

## 6. Redis (optionnel — port non exposé)

`CONFIG SET requirepass` + `.env` — le changement saute au redémarrage du
conteneur sauf recréation.

## 7. Telegram

Uniquement via @BotFather (`/revoke`), pas côté serveur.
