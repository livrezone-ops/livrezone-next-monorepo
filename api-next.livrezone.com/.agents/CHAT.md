# CHAT — MÉTHODOLOGIE COMPLÈTE

Document de référence pour le module **Chat (messagerie acheteur/vendeur)**.
Il décrit l'architecture de bout en bout : schéma, backend Laravel, temps réel (Reverb), et pièges à connaître.

---

## 1. RÈGLES FONCTIONNELLES

- Fil de discussion **direct entre 2 utilisateurs** (un fil = 2 participants, unique).
- Créé à la demande via le bouton « Contacter le vendeur » / l'interlocuteur.
- Idempotent : ouvrir un fil déjà existant le réutilise (pas de doublon).
- Interdiction de créer un fil avec soi-même (422).
- Un utilisateur ne peut accéder qu'à ses propres fils (403 sinon).
- Messages : requis, non vides, max 2000 caractères.
- Champ `last_message_at` sur le fil pour trier la liste.
- Compteur de **non lus** par fil + total (`unread_count` / `total_unread`).
- Marquage « lu » : tous les messages reçus de l'interlocuteur passent à `is_read = true` avec `read_at`.

---

## 2. SCHÉMA EXISTANT (déjà migré)

### `chat_threads`
- `user_one_id`, `user_two_id` (FK users, cascade on delete)
- `last_message_at` nullable
- unique(`user_one_id`, `user_two_id`) — les IDs sont stockés **triés** (min/max)
- index sur `user_one_id`, `user_two_id`, `last_message_at`

### `chat_messages`
- `chat_thread_id` (FK chat_threads, cascade on delete)
- `sender_id` (FK users)
- `message` (text)
- `is_read` bool (default false)
- `read_at` nullable
- index sur `chat_thread_id`, `sender_id`, `is_read`

### Modèles
- `App\Models\ChatThread` : relations `userOne`, `userTwo`, `messages`, `latestMessage`, helpers `getOrCreateThread()` et `unreadMessagesCountFor()`.
- `App\Models\ChatMessage` : relations `thread`, `sender`.

---

## 3. ENDPOINTS API

Tous sous `auth:sanctum`, préfixe `/api/chat` :

| Méthode | URL | Rôle |
|---|---|---|
| GET | `/api/chat/threads` | Liste des fils de l'utilisateur (interlocuteur + dernier message + non lus) |
| POST | `/api/chat/threads` | Créer / récupérer un fil (`user_id`) |
| GET | `/api/chat/threads/{thread}` | Détail du fil + messages paginés |
| POST | `/api/chat/threads/{thread}/messages` | Envoyer un message + broadcast |
| POST | `/api/chat/threads/{thread}/read` | Marquer comme lus les messages reçus |

### Fichiers backend
- Contrôleur : `app/Http/Controllers/Api/ChatController.php`
- FormRequests : `app/Http/Requests/Api/ChatThreadStoreRequest.php`, `ChatMessageStoreRequest.php`
- Événement : `app/Events/MessageSent.php` (broadcast temps réel)
- Canaux : `routes/channels.php` (privé `chat.thread.{threadId}`)
- Config : `config/reverb.php`

---

## 4. TEMPS RÉEL — REVERB

- Dépendance : `laravel/reverb` (à installer côté serveur, voir §6).
- Driver : `BROADCAST_CONNECTION=reverb`.
- Événement `MessageSent` implémente `ShouldBroadcastNow` (diffusion synchrone, sans file d'attente).
- Canal **privé** `chat.thread.{threadId}`, autorisation = l'utilisateur est participant du fil.
- Diffusion faite avec `->toOthers()` : l'émetteur ne reçoit pas son propre message en direct (il l'a déjà via la réponse HTTP).
- Si Reverb est indisponible, l'envoi HTTP ne casse pas : l'erreur est loggée (le message reste persisté).

### Côté client (Next.js)
```ts
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher
const echo = new Echo({
  broadcaster: 'reverb',
  key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
  wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
  wsPort: 443,
  wssPort: 443,
  forceTLS: true,
  enabledTransports: ['ws', 'wss'],
})

echo.private(`chat.thread.${threadId}`)
  .listen('.message.sent', (e) => { /* ajouter e au fil */ })
```

- L'abonnement à un canal privé passe par `/broadcasting/auth` (Sanctum + cookies SPA) : le frontend doit être dans `SANCTUM_STATEFUL_DOMAINS`.
- **État (2026-08-18) :** `/broadcasting/auth` est désormais enregistré via `Broadcast::routes(['middleware' => ['auth:sanctum']])` en tête de `routes/web.php`, et `config/broadcasting.php` (connexion `reverb`, driver `reverb` de `laravel/reverb` ^1.11) a été créé. `SANCTUM_STATEFUL_DOMAINS` contient déjà `next.livrezone.com`. Après déploiement : `php artisan config:clear`.

---

## 5. TESTS

`tests/Feature/ChatTest.php` (RefreshDatabase, sqlite en mémoire) :
- création d'un fil entre 2 utilisateurs ;
- réutilisation d'un fil existant ;
- interdiction de fil avec soi-même (422) ;
- envoi d'un message + mise à jour `last_message_at` ;
- message vide -> 422 ;
- liste des fils avec non lus ;
- marquage lu ;
- accès interdit à un non participant (403).

---

## 6. MISE EN PLACE SERVEUR (Docker rootless livrezone — RÉSOLU)

### Architecture du serveur

Deux moteurs Docker **isolés** :
- **Docker système** (`ouahib`) : code-server, caddy, openpanel… → ne peut **pas** joindre mariadb par DNS.
- **Docker rootless** (`livrezone`) : mariadb, apache, php-fpm-8.5, livrezone-redis → réseau `livrezone_db`.

Reverb doit tourner dans le **Docker rootless** de `livrezone`, sur le réseau `livrezone_db`
(même réseau que MariaDB et Redis), sinon `DB_HOST=mariadb` n'est pas résolu.

### Fichier de compose Reverb : `/home/livrezone/reverb-compose.yml`

```yaml
services:
  reverb:
    image: mon-code-server:custom
    container_name: reverb
    restart: unless-stopped
    entrypoint: ["/usr/bin/php8.3"]
    command: ["/workspace/api-next.livrezone.com/artisan", "reverb:start", "--host=0.0.0.0", "--port=6060"]
    working_dir: /workspace/api-next.livrezone.com
    environment:
      - CACHE_STORE=redis
      - REDIS_CLIENT=predis
      - REDIS_HOST=livrezone-redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=
      - QUEUE_CONNECTION=sync
    ports:
      - "127.0.0.1:6060:6060"
    volumes:
      - /home/livrezone/docker-data/volumes/livrezone_html_data/_data:/workspace
    networks:
      - livrezone_db

networks:
  livrezone_db:
    external: true
    name: livrezone_db
```

### Les 3 causes du redémarrage en boucle (résolu)

1. **Mauvais moteur Docker** : Reverb était dans le Docker système, or mariaDB est dans le
   Docker rootless → `getaddrinfo for mariadb failed`. Fix : conteneur dans le Docker `livrezone`,
   réseau `livrezone_db`.
2. **Drivers cache/queue inaccessibles** : `CACHE_STORE=database` ne pouvait pas joindre mariaDB,
   `REDIS_CLIENT=phpredis` sans extension. Fix : variables d'env écrasant le `.env` :
   `CACHE_STORE=redis`, `REDIS_CLIENT=predis`, `REDIS_HOST=livrezone-redis`, `QUEUE_CONNECTION=sync`.
3. **Config Reverb désynchronisée** (cause du restart ~60s / exit 0) : `ping_interval` manquant.
   Fix : `php artisan vendor:publish --tag=reverb-config --force`.
   TODO après montée de version : `composer require laravel/reverb` puis re-publier la config.

### Commandes de pilotage

```bash
sudo -u livrezone -H docker compose -f /home/livrezone/reverb-compose.yml up -d
sudo -u livrezone -H docker inspect reverb --format 'Status: {{.State.Status}} | Restarts: {{.RestartCount}}'
sudo -u livrezone -H docker logs -f reverb
```

### Caddy (mode host) — reverse proxy WebSocket

Le client se connecte sur `wss://api-next.livrezone.com:443`, Caddy route `/app/*` vers `127.0.0.1:6060`.

Dans `/etc/openpanel/caddy/domains/api-next.livrezone.com.conf`, bloc HTTPS :

```
    handle /app/* {
        reverse_proxy 127.0.0.1:6060
    }

    handle {
        reverse_proxy https://127.0.0.1:32774 { … }
    }
```

⚠️ Le port Reverb publié est `127.0.0.1:6060` (pas `0.0.0.0`), accessible uniquement en local. 
⚠️ Le port 80 du site est 32773, HTTPS 32774 (apache) — ne pas confondre avec 6060.

---

## 7. PIÈGES

- `config/reverb.php` est créé manuellement ici ; `composer require laravel/reverb` fournit la config officielle — garder la nôtre si la version du paquet l'exige.
- Le canal est **privé** : l'autorisation est vérifiée dans `routes/channels.php`, ne jamais la mettre en public.
- `ShouldBroadcastNow` évite d'ajouter une file d'attente au chat (le message doit arriver immédiatement).
- Ne pas exposer les clés Reverb côté client en dur : passer par `NEXT_PUBLIC_*` (publiques par nature pour WebSocket).
- Le bouton « Message » de `components/SellerContact.tsx` doit pointer vers la route `/chat?user={id}` (créée dans `app/chat/page.tsx`) et non vers une page inexistante.

---

## 8. FRONTEND (Next.js)

### Fichiers
- `lib/chat-api.ts` : types + appels API (`listThreads`, `getOrCreateThread`, `getThreadMessages`, `sendMessage`, `markThreadAsRead`).
- `lib/chat-realtime.ts` : client Echo (broadcaster `reverb`, typé `Echo<'reverb'>`), `subscribeToThread(threadId, handler: (data: ChatMessage) => void)` ; `getEcho()` renvoie `undefined` si `NEXT_PUBLIC_REVERB_APP_KEY` absent.
- `components/ChatClient.tsx` : UI messagerie (liste des fils, détail, envoi, realtime, badge non-lus). Pré-sélectionne le fil depuis `?thread` (état initial, sans effet).
- `components/Header.tsx` : pastille de non-lus (même cache React Query `['chat','threads']` que la messagerie).
- `app/dashboard/messages/page.tsx` : page messagerie (`Suspense` + `export const dynamic = 'force-dynamic'`).
- `app/chat/page.tsx` : **route de redirection** « Contacter le vendeur » (voir flux ci-dessous).
- `lib/api-error.ts` : helpers de typage d'erreur Axios (`getApiErrorMessage`, `getApiErrorStatus`, `getApiFieldErrors`) — supprime les `any`.

### Flux « Contacter le vendeur »
1. `components/SellerContact.tsx` (bouton « Message ») pointe vers `/chat?user={userId}`.
2. `app/chat/page.tsx` lit `?user=`, vérifie l'auth (sinon `/login`), appelle `getOrCreateThread(userId)`, puis redirige vers `/dashboard/messages?thread={id}`.
3. `ChatClient` lit `?thread` et pré-sélectionne le fil (état initial, sans effet).
4. Fallback : liste rafraîchie toutes les 30 s (`refetchInterval`) si Reverb indisponible.

### Config client (.env.production / .env.local)
- `NEXT_PUBLIC_REVERB_APP_KEY`, `NEXT_PUBLIC_REVERB_HOST=api-next.livrezone.com`, `NEXT_PUBLIC_REVERB_PORT=443`, `NEXT_PUBLIC_REVERB_SCHEME=https`.

### Qualité (lint / build)
- `next build` + ESLint passent (0 erreur, 0 warning) : 17 `any` supprimés, erreurs TS corrigées (`ListingDetail` aligné sur `Listing`, `Echo<'reverb'>`, retour `undefined`, type `"error"` Toast, `onDismiss`→`dismiss`), warnings `no-unused-vars` et `no-img-element` (cette dernière désactivée dans `eslint.config.mjs` pour les avatars externes).

---

## 9. GIT

Le dépôt Git principal se trouve dans `_data` (SMB `\\192.168.1.202\_data`).

**Déploiement (2026-08-18) :** après `git pull`, exécuter `php artisan config:clear` (nouveau `config/broadcasting.php`) et vérifier que le serveur Reverb tourne (Docker rootless). Le chat (frontend + backend + `config/broadcasting.php` + `routes/web.php`) est commité et poussé sur `origin/main`.
```
git -C "\\192.168.1.202\_data" add api-next.livrezone.com/...
git -C "\\192.168.1.202\_data" commit -m "feat(api): service de chat avec Reverb"
git -C "\\192.168.1.202\_data" push origin main
```