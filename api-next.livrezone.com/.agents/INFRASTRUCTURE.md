# INFRASTRUCTURE

## Objectif

Décrire l'infrastructure de référence du projet LivreZone.

Toujours tenir compte de cette architecture avant toute intervention, analyse ou proposition de modification.

---

## Stack infrastructure

Le projet est hébergé sur :

- Debian 12
- Docker
- OpenPanel
- CasaOS
- Caddy
- Cloudflare

---

## Architecture générale

Le projet est séparé en plusieurs applications :

### Projet historique Laravel + Livewire

Chemin :

```text
/workspace/dev.livrezone.com
```

Domaine :

```text
https://dev.livrezone.com
```

Utilisation :

- référence fonctionnelle ;
- référence métier ;
- référence technique.

Ne jamais modifier ce projet.

---

### Backend API

Chemin :

```text
/workspace/api-next.livrezone.com
```

Domaine officiel :

```text
https://api-next.livrezone.com
```

Ne jamais utiliser :

```text
https://api.next.livrezone.com
```

Cet ancien domaine est abandonné.

Le backend constitue la source de vérité métier.

---

### Frontend Next.js

Chemin :

```text
/workspace/next.livrezone.com/frontend
```

Domaine :

```text
https://next.livrezone.com
```

Le frontend consomme exclusivement les API exposées par Laravel.

---

## Réseau

Cloudflare est positionné devant l'infrastructure.

Caddy assure :

- le reverse proxy ;
- la gestion HTTPS ;
- le routage des domaines ;
- la communication vers les applications backend.

---

## Base de données

Moteur :

```text
MariaDB
```

Toute modification impactant la base doit être analysée avec précaution.

Privilégier :

- les migrations réversibles ;
- la compatibilité avec les données existantes ;
- les changements minimaux.

---

## Authentification

Le système d'authentification repose sur :

- Laravel Sanctum ;
- Laravel Socialite.

Ne jamais proposer de modification susceptible de casser :

- les sessions ;
- les tokens ;
- l'authentification sociale ;
- les profils utilisateurs.

---

## Diagnostic infrastructure

En cas de problème :

Vérifier dans l'ordre :

1. Logs Laravel
2. Logs Next.js
3. Requêtes API
4. Queue Workers
5. Scheduler
6. Logs Caddy

Consulter les logs Caddy principalement pour :

- erreurs 502 ;
- erreurs 504 ;
- problèmes SSL ;
- problèmes de reverse proxy ;
- problèmes Cloudflare.

---

## Règles importantes

Ne jamais :

- modifier le projet historique ;
- supposer qu'un service est actif ;
- supposer qu'une configuration existe ;
- modifier l'infrastructure sans vérification préalable.

Toujours :

- vérifier l'existant ;
- vérifier la configuration réelle ;
- privilégier les changements minimaux ;
- maintenir la compatibilité avec l'architecture actuelle.