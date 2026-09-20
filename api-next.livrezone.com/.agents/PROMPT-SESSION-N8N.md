================================================================================
LIVREZONE — PROMPT DE SESSION « ANALYSE & LANCEMENT DU PROJET N8N »
Fichier : .agents/PROMPT-SESSION-N8N.md
Date de création : 19/09/2026
Prérequis de lecture :
- .agents/AUDIT-2026-08-25.md → section « ROADMAP PRODUIT — Marketing & réseaux
  sociaux » (cadrage validé Postiz + n8n + worker Python/IA, décision 28/08)
- .agents/roadmap.md → ligne 6 (stack marketing après bascule)
- .agents/MIGRATION-livrezone-com-2026-09-06.md (ce que la « migration » est
  réellement devenue : un POINTEUR de domaine, pas un nouveau serveur)
- .agents/PROJECT_OPERATING_RULES.md et .agents/RULES.md (invariants)
================================================================================

## TON ROLE

Tu es l'agent LivreZone. Mission : **analyser la faisabilité du projet n8n sur
cette machine, produire un plan d'implémentation complet, puis — SEULEMENT SI
le propriétaire valide — installer et configurer n8n**. La phase analyse est
obligatoire et doit aboutir à un rapport écrit AVANT tout `docker run`.

**DÉCISION DÉJÀ PRISE par le propriétaire (19/09) : n8n en LOCAL, accès LAN
uniquement** — pas de sous-domaine public, pas de règle Caddy, pas de
Cloudflare pour ce service. L'éditeur s'ouvre depuis le réseau local
(`http://192.168.1.202:<port>`). Conséquences intégrées dans les phases A/B
ci-dessous (le piège WAF sur l'éditeur n8n disparaît, mais les déclencheurs
webhook Laravel → n8n doivent rester joignables depuis la stack rootless).

IMPORTANT : commence la session par poser les DÉCISIONS PROPRIÉTAIRE
restantes (section ci-dessous) via AskUserQuestion. Ne déploie rien avant
leurs réponses.

## CONTEXTE MATÉRIEL ET INFRA (état mesuré au 20/09/2026)

- Machine : 4 cœurs, 11 GiB RAM (~4,4 GiB disponibles à chaud, 7,2 utilisés),
  disque système 116 Go — **~48 Go libres depuis le nettoyage Docker du
  19/09** (29 Go récupérés ; procédure + bilan dans
  `.agents/MIGRATION-SSD4SERVER-STRATEGIE.md`).
- **MariaDB et Meilisearch tournent désormais sur SSD4server**
  (`/media/ouahib/SSD4server/livrezone/{mysql,meili}`, bascule faite la nuit
  du 19 au 20/09) — leurs données applicatives partiront avec le disque lors
  de la migration serveur.
- ⚠️ Antécédent incident 524 : pression RAM sur cette machine — tout service
  résident supplémentaire doit être dimensionné prudemment et limité
  (`mem_limit` docker obligatoire).
- Docker ROOTFUL : `sudo -n docker ...` (PAS `sudo -n bash`). Le frontend
  `livrezone-next` tourne ici (port 3000). La stack API (php-fpm-8.5, MariaDB,
  Redis, Meilisearch) tourne en ROOTLESS (DOCKER_HOST conservé via sudoers ;
  piège : `sudo -n env DOCKER_HOST=...` est REFUSÉ — passer l'env AVANT
  `sudo`).
- Reverse proxy : **Caddy OpenPanel** (`/etc/openpanel/caddy/domains/`,
  `import domains/*`). ⚠️ Piège documenté : ne JAMAIS déposer de `.bak` ni de
  copie dans `domains/` — le glob charge tout fichier. Sauvegardes →
  `/etc/openpanel/caddy/`. WAF Coraza en aval (bloque PUT/DELETE).
- DNS : Cloudflare (zone livrezone.com). Un tunnel `cloudflared-rescue` existe.
- Déjà déployé en rootful et à connaître : **Evolution API** (WhatsApp,
  réseau dédié `evolution-api_evolution_net` avec son Postgres + Redis),
  phpmyadmin, dbgate, openpanel, clamav, cloudflare-ddns.
- Sauvegardes : rclone → Google Drive LivreZone, quotidien (backup site + DB
  validé). Toute nouvelle donnée persistante (volumes n8n) doit entrer dans
  cette chaîne ou avoir sa propre procédure documentée.
- Le `.env` racine partagé code-server ↔ php-fpm est INTERDIT aux nouveaux
  services (règle permanente) : n8n aura son propre fichier d'env dédié.

## CADRAGE VALIDÉ PAR LE PROPRIÉTAIRE (audit 28/08 — toujours la référence)

Architecture marketing en 3 outils, à installer **après** la bascule
livrezone.com (qui a finalement été un pointeur de domaine, cf. plus bas) :

| Outil | Rôle | Ne fait PAS |
|---|---|---|
| **Postiz** (self-hosted) | Publication + planification multi-plateformes (FB, Insta, LinkedIn, YouTube, TikTok), OAuth, calendrier, rate limits | ne génère pas de contenu |
| **n8n** (self-hosted) | Orchestration amont UNIQUEMENT : déclencheurs (cron, événement API, webhook), appels au worker IA, poussée des posts vers l'API Postiz (`POST /public/v2/posts`) | PAS les notifications transactionnelles (elles restent dans Laravel : Evolution API, Brevo/SES, queue supervisée) |
| **Conteneur Python/IA** (à développer) | Worker webhook sans état : script (API LLM) → voix off (TTS) → visuels (couvertures locales + stock Pexels) → rendu MP4 ffmpeg → sortie pour Postiz | pas de modèle IA from scratch ; squelettes à forker : ShortGPT, MoneyPrinter |

Points de vigilance posés à l'époque : webhooks n8n protégés (auth),
conteneurs isolés réseau, rien dans le `.env` partagé, specs MP4 par
plateforme, **ressources ffmpeg (rendu = CPU → pas sur la machine prod)**.

## CE QUI A CHANGÉ DEPUIS LE CADRAGE (à intégrer dans ton analyse)

1. **Le site migre exclusivement sur un NOUVEAU SERVEUR** (décision
   propriétaire 20/09 — runbook `.agents/MIGRATION-NOUVEAU-SERVEUR-STRATEGIE.md`),
   et **les données (MariaDB + Meilisearch) tournent déjà sur SSD4server**
   (bascule faite la nuit du 19 au 20/09) : elles voyageront avec le disque.
   L'audit 28/08 prévoyait la stack marketing sur le nouveau matériel — le
   worker ffmpeg y sera enfin viable. La question « où installe-t-on n8n » est
   une question de CALENDRIER (cf. décisions propriétaire en bas).
2. **La carte de partage OG est prête** (v10, 19/09) : chaque annonce expose
   `${FRONTEND_URL}/api/og/listing/<id>` — image 1200×630 formatée pour les
   réseaux (titre, prix, état, couverture 3D), cachée et versionnée. Les
   workflows sociaux peuvent la consommer DIRECTEMENT comme visuel de post,
   sans régénérer quoi que ce soit.
3. **Evolution API tourne déjà** : si un workflow doit passer par WhatsApp, le
   transport existe (mais attention : WhatsApp via n8n reste dans le périmètre
   marketing, PAS transactionnel).
4. L'API publique Laravel expose les endpoints nécessaires (listings publics,
   recherche Meilisearch). Un token Sanctum dédié (lecture) peut être créé si
   besoin — ne JAMAIS réutiliser un token admin personnel.

## MISSION — PHASE A : ANALYSE (rapport obligatoire, AVANT installation)

Réponds précisément, avec mesures à l'appui quand c'est vérifiable :

1. **Dimensionnement** : RAM/CPU réalistes de n8n (Node) en usage 2-3
   workflows ; de Postiz (Node + workers + base) ; du worker ffmpeg (rendu
   vidéo). Confronte au budget réel : ~4 GiB dispo, 20 Go disque. Dis
   explicitement ce qui RENTRE et ce qui NE RENTRE PAS sur cette machine.
   Hypothèse de départ à confirmer ou infirmer : n8n seul (~300-500 Mo) est
   jouable ; Postiz est serré mais envisageable avec limites strictes ; le
   worker ffmpeg vidéo est à proscrire ici (CPU + disque) → resterait sur une
   machine dédiée ou en service externe.
2. **Stockage & données** : que persiste n8n (SQLite embarqué vs Postgres
   dédié — recommende ; volume de données, exécutions, binaires) ; impact du
   disque à 83 % ; politique de purge des exécutions (`EXECUTIONS_DATA_PRUNE`,
   rétention) à configurer d'office.
3. **Licence** : n8n est « sustainable use » (fair-code) — confirmer que l'usage
   interne LivreZone est conforme ; noter la version stable à figer (tag
   docker précis, pas `latest`).
4. **Sécurité (contexte LAN)** : compte owner n8n (mot de passe fort ; 2FA
   optionnelle hors exposition publique), auth des webhooks entrants (header
   secret), isolation réseau (réseau docker dédié ; **aucun port publié
   vers internet** — vérifier que le port n'écoute pas sur 0.0.0.0 routable
   depuis le WAN, et l'état de la politique docker `iptables`/firewall de la
   machine), variables d'env sensibles dans un `.env` dédié `chmod 600`,
   secrets documentés dans la procédure de rotation
   (`.agents/ROTATION-MOTS-DE-PASSE.md`).
5. **Exposition LAN + joignabilité des déclencheurs** (le point technique
   clé du contexte local) : l'éditeur est ouvert depuis le LAN
   (`http://192.168.1.202:<port>`). MAIS les workflows déclenchés par Laravel
   exigent que la **stack rootless (php-fpm) puisse joindre le conteneur
   rootful n8n** : vérifier empiriquement (curl depuis un `docker exec`
   rootless php-fpm vers l'IP:port du conteneur n8n) et documenter l'URL à
   utiliser (IP LAN du host + port publié, ou réseau partagé). Inversement,
   configurer `WEBHOOK_URL`/`N8N_EDITOR_BASE_URL` pour que les URL de
   webhook générées pointent vers l'adresse joignable par Laravel, pas une
   URL publique. Si un workflow doit appeler l'API publique, utiliser
   `https://api-next.livrezone.com` (résout en LAN, cf. `--add-host` du
   frontend) ou l'URL interne directe.
6. **Sauvegarde** : comment le volume n8n entre dans la chaîne rclone/Drive
   existante (dump régulier de la base n8n + export des workflows en JSON dans
   git — les workflows sont du code, ils doivent être versionnés).
7. **Mise à jour & rollback** : procédure de montée de version (tag figé,
   `docker pull` + recréation, test post-upgrade), et plan de rollback écrit
   AVANT exécution (leçon incident Apache 28/08).

## MISSION — PHASE B : PLAN D'IMPLÉMENTATION (à produire, puis exécuter si validé)

1. `docker-compose.yml` (ou `docker run` documenté — le reste du rootful est
   en `docker run`, cohérence à choisir) : réseau dédié, `mem_limit` +
   `restart unless-stopped`, volume dédié `livrezone-n8n-data`, tag de version
   figé, env dédiée. Port publié **uniquement pour le LAN** (flag
   `-p 192.168.1.202:5678:5678` plutôt que `-p 5678:5678` — jamais
   0.0.0.0), à confirmer par l'analyse de joignabilité rootless.
2. **Joignabilité Laravel → n8n testée AVANT tout workflow** : `curl` depuis
   php-fpm rootless vers l'URL webhook choisie ; c'est le seul prérequis
   bloquant des workflows de la phase C.
3. Configuration initiale : compte owner, désactivation de l'inscription
   ouverte, fuseau `GENERIC_TIMEZONE=Europe/Casablanca`, telemetry OFF,
   rétention d'exécutions, verrou d'auth webhooks, `WEBHOOK_URL` pointant sur
   l'adresse LAN joignable par la stack rootless.
4. Création du token API Sanctum « n8n-lecture » côté Laravel (policy lecture
   seule) + documentation de son stockage.
5. Sauvegardes branchées + test de restauration (restore dans un conteneur
   jetable — un backup non testé n'existe pas).
6. Plan de rollback : stop/rm du conteneur, suppression volume + publication
   de port, restauration de l'état antérieur — écrit avant le premier
   `docker run`.

## MISSION — PHASE C : WORKFLOWS PRIORITAIRES LIVREZONE (proposer 3, en implémenter 1 si le propriétaire valide)

À proposing avec, pour chacun : déclencheur, étapes n8n, endpoints, garde-fous
(rate limit, mode brouillon d'abord, journal des envois) :

1. **« Nouvelle annonce → post social »** : webhook Laravel (event listing
   published) → fetch des données publiques de l'annonce → visuel =
   `/api/og/listing/<id>` → post via API Postiz (FB page d'abord). MODE
   BROUILLON obligatoire les 2 premières semaines (relecture propriétaire
   avant publication réelle).
2. **« Digest hebdo nouveautés »** : cron n8n (dimanche 18 h) → top N annonces
   de la semaine via API publique/Meilisearch → carrousel ou post unique via
   Postiz.
3. **« Rupture de stock / annonce republiée »** (informatif interne) : webhook
   → message Telegram vers le canal admin (déjà existant côté Laravel — n8n ne
   fait qu'enrichir, ne remplace pas).

Règle d'or : n8n orchestre, il ne remplace AUCUN canal transactionnel existant
(Evolution API, SES, queue Laravel restent en place).

## DÉCISIONS PROPRIÉTAIRE (poser via AskUserQuestion AVANT tout travail)

*(Décisions déjà prises : **n8n en LOCAL, LAN uniquement** (19/09) — ne pas
re-poser, ne pas proposer de sous-domaine public. **Le site migre
exclusivement sur un NOUVEAU SERVEUR** (décision propriétaire 20/09, runbook
`.agents/MIGRATION-NOUVEAU-SERVEUR-STRATEGIE.md`) — l'audit 28/08 prévoyait
la stack marketing sur le nouveau stockage, où le worker ffmpeg sera enfin
viable. **Recommandation : n8n s'installe sur le NOUVEAU serveur, APRÈS la
bascule du site.** Si le propriétaire veut avancer avant l'achat, n8n seul
peut s'installer ici et migrer avec le site (le volume n8n suit). POSER LA
QUESTION DU CALENDRIER.)*

1. **Calendrier** : (a) n8n attend le nouveau serveur, installé après la
   bascule du site (recommandé) ; (b) n8n seul ici en attendant, migré avec
   le site ; (c) annulé.
2. **Périmètre de la session** : analyse seule (rapport puis STOP) vs analyse +
   installation de n8n immédiatement si l'analyse est verte.
3. **Premier workflow** : lequel des 3 de la phase C.

## RÈGLES PROJET (invariants non négociables)

- ⚠️ Ne JAMAIS supprimer ni casser une fonctionnalité existante ; tout changement
  documenté avant/après.
- ⚠️ Rien dans le `.env` partagé : n8n a son propre fichier d'env dédié.
- WAF Coraza bloque PUT/DELETE → ne pas compter dessus pour les intégrations.
- API live en bind mount : `php -l` après chaque edit PHP ; jamais de fichier
  cassé en fin de session.
- Déploiements : fenêtre + plan de rollback écrits AVANT exécution.
- Documentation : tout livré dans `.agents/` (rapport `N8N-ANALYSE-2026-09.md`,
  workflows exportés en JSON dans un dossier versionné), roadmap.md et audit
  mis à jour, PUSH GIT après chaque étape validée.
- Sessions ZCode sur le serveur ; docker rootful via `sudo -n docker` UNIQUEMENT.

## LIVRABLES ATTENDUS EN FIN DE SESSION

1. `N8N-ANALYSE-2026-09.md` : dimensionnement chiffré, go/no-go par composant
   (n8n / Postiz / worker ffmpeg), risques, décision propriétaire retenue.
2. Compose/`docker run` + env dédiée (si installation validée), version figée,
   limites mémoire, port publié sur l'IP LAN uniquement.
3. n8n configuré (owner, inscription fermée, rétentions, timezone,
   `WEBHOOK_URL` LAN), workflows de la
   phase C exportés en JSON versionnés, token Sanctum dédié créé et documenté.
4. Sauvegarde + test de restauration effectués, plan de rollback écrit.
5. roadmap.md + AUDIT mis à jour (statut du chantier marketing), push git.
