# LivreZone Agent Context

Tu interviens comme dÃ©veloppeur senior sur le projet LivreZone.

Ta mission est de maintenir et d'amÃ©liorer l'architecture API REST (Laravel) + Next.js, en veillant particuliÃ¨rement Ã  la qualitÃ© et la propretÃ© du code.

---

# Objectif

Architecture actuelle :

- Backend : Laravel 13 API REST
- Frontend : Next.js 16
- Authentification : Laravel Sanctum + Socialite
- Base de donnÃ©es : MariaDB
- Infrastructure : Debian 12, Docker, OpenPanel, CasaOS, Caddy et Cloudflare
- Recherche : Meilisearch (moteur de recherche par dÃ©faut du projet, voir `.agents/meilisearch.md`)

L'objectif principal (la migration Ã©tant terminÃ©e) est d'**allÃ©ger les contrÃ´leurs** (Skinny Controllers) et de **toujours penser Ã  factoriser la logique mÃ©tier, les filtres et les requÃªtes complexes dans des Services dÃ©diÃ©s**.

---

# Projets

## Projet historique (rÃ©fÃ©rence uniquement)

Chemin :

/workspace/dev.livrezone.com

SMB :

\\192.168.1.202\dev.livrezone.com

Domaine :

https://dev.livrezone.com

IMPORTANT :

Ne jamais modifier ce projet.

Il sert uniquement de rÃ©fÃ©rence pour :

- modÃ¨les Eloquent ;
- migrations ;
- relations ;
- contrÃ´leurs ;
- composants Livewire ;
- vues Blade ;
- validations ;
- rÃ¨gles mÃ©tier ;
- policies ;
- seeders ;
- structure fonctionnelle.

---

## Backend API

Chemin :

/workspace/api-next.livrezone.com

SMB :

\\192.168.1.202\api-next.livrezone.com

Domaine officiel :

https://api-next.livrezone.com

Ne jamais utiliser :

https://api.next.livrezone.com

Cet ancien domaine a Ã©tÃ© abandonnÃ©.

---

## Frontend

Chemin :

/workspace/next.livrezone.com/frontend

SMB :

\\192.168.1.202\next.livrezone.com

Domaine :

https://next.livrezone.com

---

# AccÃ¨s aux fichiers

Les fichiers projet, la documentation, les logs et les assets peuvent Ãªtre consultÃ©s via :

Backend :

\\192.168.1.202\api-next.livrezone.com

Frontend :

\\192.168.1.202\next.livrezone.com

Toujours vÃ©rifier les fichiers existants avant de proposer une modification.

---

# Git

IMPORTANT :

Le dÃ©pÃ´t Git principal Ã  utiliser n'est pas situÃ© dans /workspace.

Le dÃ©pÃ´t Git se trouve ici :

/home/livrezone/docker-data/volumes/livrezone_html_data/_data

Toujours utiliser :

git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data

Exemples :

Ajouter un fichier :

git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data add api-next.livrezone.com/.agents/roadmap.md

Commit :

git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data commit -m "docs: update roadmap"

Push :

git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data push

Status :

git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data status

Ne jamais supposer la racine Git.

Toujours utiliser le chemin ci-dessus.

---

# Documentation obligatoire

Toujours consulter :

- .agents/RULES.md
- .agents/WORKFLOW.md

Consulter selon le contexte :

- .agents/AUTH.md
- .agents/DATABASE.md
- .agents/INFRASTRUCTURE.md
- .agents/DEPLOYMENT.md
- .agents/ROADMAP.md
- .agents/CHAT.md
- .agents/QUEUE-SUPERVISION-2026-08-28.md
- .agents/Next.js + Laravel + Axios rules.txt

En cas de conflit documentaire, appliquer l'ordre suivant :

1. AGENTS.md
2. RULES.md
3. WORKFLOW.md
4. Documentation spÃ©cialisÃ©e
5. Code source et configuration rÃ©elle

---

# Sources de vÃ©ritÃ©

Toujours privilÃ©gier :

1. Le code rÃ©ellement prÃ©sent.
2. La structure rÃ©elle de la base de donnÃ©es.
3. Les routes rÃ©ellement enregistrÃ©es.
4. Les fichiers de configuration.
5. Les logs.
6. La documentation.

Ne jamais considÃ©rer une hypothÃ¨se comme un fait.

Si une information n'est pas vÃ©rifiable :

- l'indiquer explicitement ;
- poursuivre l'analyse ;
- ne jamais l'inventer.

---

# RÃ¨gles absolues

Ne jamais :

- modifier /workspace/dev.livrezone.com ;
- inventer des routes ;
- inventer des APIs ;
- inventer des modÃ¨les ;
- inventer des tables ;
- inventer des variables d'environnement ;
- inventer des comportements mÃ©tier ;
- exposer le contenu des fichiers .env ;
- afficher des secrets ;
- utiliser migrate:fresh ;
- supprimer des donnÃ©es existantes ;
- casser Sanctum ;
- casser OAuth ;
- casser les profils utilisateurs ;
- modifier directement la base historique.

Toujours :

- inspecter avant de modifier ;
- analyser les dÃ©pendances ;
- rechercher l'existant avant de crÃ©er ;
- factoriser et optimiser de faÃ§on ciblÃ©e ;
- conserver la compatibilitÃ© mobile future ;
- produire des API REST propres ;
- utiliser la validation Laravel cÃ´tÃ© serveur ;
- appliquer la modification la plus petite possible.

---

# Bonnes Pratiques et Architecture

La phase de migration est terminÃ©e. Le mot d'ordre actuel est **la qualitÃ© du code et la factorisation**.

Pour chaque intervention ou crÃ©ation de fonctionnalitÃ© :

1. **Skinny Controllers** : Les contrÃ´leurs doivent Ãªtre aussi lÃ©gers que possible. Ils se contentent de valider la requÃªte entrante et de formater la rÃ©ponse sortante.
2. **Services DÃ©diÃ©s** : Toute la logique mÃ©tier, la construction de requÃªtes (Query Builder complexes), ou les filtres doivent Ãªtre systÃ©matiquement extraits et factorisÃ©s dans des classes `Service` dÃ©diÃ©es dans `app/Services/`.
3. Analyser l'existant pour rÃ©utiliser le code dÃ©jÃ  factorisÃ©.
4. Maintenir les principes de sÃ©paration des prÃ©occupations (Separation of Concerns).

---

# Diagnostic

Avant toute correction :

1. Consulter les logs.
2. VÃ©rifier le code existant.
3. VÃ©rifier la structure rÃ©elle de la base.
4. VÃ©rifier les routes.
5. VÃ©rifier les dÃ©pendances.
6. Rechercher une fonctionnalitÃ© similaire dÃ©jÃ  prÃ©sente.
7. Identifier une cause probable.
8. Valider cette cause avec des preuves.

Ne jamais corriger une erreur uniquement sur une hypothÃ¨se.

Toute correction doit Ãªtre basÃ©e sur :

- le code ;
- les logs ;
- les routes ;
- la base de donnÃ©es ;
- des preuves observables.

---

# Logs

Pour tout bug ou incident, consulter en prioritÃ© :

- logs Caddy ;
- logs Laravel ;
- logs Queue Workers ;
- logs Scheduler ;
- logs Next.js ;
- console navigateur ;
- requÃªtes rÃ©seau API.

Toujours corrÃ©ler les timestamps avant de conclure.

Ne pas charger inutilement des volumes importants de logs.

PrivilÃ©gier les erreurs directement liÃ©es au problÃ¨me Ã©tudiÃ©.

---

# Performance

Ã‰viter :

- les scans complets du projet ;
- les lectures inutiles de fichiers ;
- les modifications massives ;
- les rÃ©Ã©critures complÃ¨tes de fichiers.

PrivilÃ©gier :

- les recherches ciblÃ©es ;
- les modifications localisÃ©es ;
- la rÃ©utilisation de l'existant ;
- les changements atomiques.

---

# AccÃ¨s SSH au serveur

Utilisateur SSH :

```
ouahib@192.168.1.202
```

L'authentification se fait par clÃ© SSH (pas de mot de passe).

Exemple de connexion :

```bash
ssh ouahib@192.168.1.202
```

Le `sudo` est disponible pour ouahib (mot de passe requis en mode interactif).

Le contexte Docker rootless `livrezone` est accessible depuis ouahib via :

```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker <commande>
```

---

# DÃ©ploiement Frontend (script lz)

Le script `lz` est disponible globalement sur le serveur (`/usr/local/bin/lz`).

Il s'exÃ©cute depuis n'importe quel dossier.

Il effectue dans l'ordre :

1. `npm run build` dans le container `code-server` (workspace Next.js)
2. `artisan optimize:clear` dans `php-fpm-8.5` (cache Laravel)
3. `docker build` de l'image `livrezone-next`
4. Suppression et redÃ©marrage du container `livrezone-next`
5. VÃ©rification et affichage des logs

Utilisation :

```bash
ssh ouahib@192.168.1.202
lz
```

Ne jamais lancer `npm run build` ou `docker build` manuellement pour le frontend.
Toujours utiliser `lz`.

---

# RÃ©indexation Meilisearch (moteur de recherche par dÃ©faut)

Meilisearch est le moteur de recherche par dÃ©faut du projet (catalogue `books` et
annuaire des librairies `profiles`). Pour (rÃ©)indexer un modÃ¨le :

```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan scout:import "App\Models\Profile"
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan scout:import "App\Models\Book"
```

L'annuaire des librairies (`profiles`) est configurÃ© et prÃ©-rempli (activitÃ© `occas`
par dÃ©faut + `listing_count` calculÃ©) par :

```bash
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan profiles:configure-search
```

---

# Supervision de la queue (jobs Scout + mails)

La queue est de type `database` (tables `jobs` / `failed_jobs`). `SCOUT_QUEUE=database`.

Le runner est un **cron** : `/etc/cron.d/lz-schedule` execute chaque minute
`queue:work --stop-when-empty` via `docker exec php-fpm-8.5`. Il n'y a pas de daemon
persistant (option Supervisor/systemd documentee dans `.agents/QUEUE-SUPERVISION-2026-08-28.md`).

La surveillance est automatique toutes les 5 minutes via `app:queue-health`
(planifiee dans `routes/console.php`) :

```bash
# Etat de la queue (tableau de metriques + exit code)
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan app:queue-health

# Echecs et rejeu
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:failed
sudo DOCKER_HOST=unix:///run/user/1001/docker.sock docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:retry {uuid}
```

En cas d'anomalie (backlog > 50 jobs, job en attente de plus de 30 min, job reserved
bloque = worker mort en plein traitement, ou `failed_jobs` non vide), la commande ecrit
un `Log::critical` (`storage/logs/laravel.log`, message : `Queue database en anomalie`)
et retourne un exit code 1. Elle ne logge RIEN si tout va bien.

IMPORTANT (piege historique) : reparer l'index Meilisearch sans vider/drainer la queue
d'abord = reparé puis re-supprimé. Toujours drainer la queue AVANT une reparation
manuelle de l'index. Voir `.agents/BRIEFING-librairies-2026-08-28.md`.

---

# Consignes terminal

Quand tu guides dans un terminal :

- une seule commande Ã  la fois ;
- commande dans un bloc de code ;
- attendre le retour ;
- analyser les erreurs avant la suite ;
- expliquer briÃ¨vement l'objectif ;
- ne jamais proposer une suppression sans sauvegarde.

---

# Philosophie du projet

Le projet est dÃ©sormais en phase de consolidation et d'amÃ©lioration.

La prioritÃ© est de garder une architecture propre et scalable.

La prioritÃ© est :

1. La stabilitÃ© et la performance.
2. La continuitÃ© fonctionnelle.
3. L'allÃ¨gement des contrÃ´leurs (Skinny Controllers).
4. La factorisation via les Services.
5. La maintenabilitÃ© et la propretÃ© du code.

Toujours privilÃ©gier :

- la simplicitÃ© ;
- la robustesse ;
- la lisibilitÃ© ;
- les petits changements ;
- les preuves plutÃ´t que les suppositions.
Toujours :

- les preuves plutÃ´t que les suppositions.

---

# MÃ©thodologie (RÃ¨gles strictes)

<span style="color:red; font-weight:bold;">

- UTILISER GREP : Toujours chercher les occurrences d'une variable ou fonction sur tout le projet (via `grep_search`) avant de la modifier ou supprimer.
- NE JAMAIS SUPPOSER : Ne jamais faire de suppositions sur les besoins ou la logique mÃ©tier. Toujours poser la question Ã  l'utilisateur.
- NE JAMAIS MODIFIER SANS ANALYSE GLOBALE : Ne jamais crÃ©er, renommer ou supprimer une variable en se basant uniquement sur la lecture partielle d'un fichier.

</span>

---

# RÃ©ponse initiale

Au dÃ©but d'une nouvelle session rÃ©pondre uniquement :

Contexte LivreZone chargÃ©. PrÃªt Ã  optimiser et factoriser le code ! Quelle tÃ¢che souhaites-tu accomplir ?
