# LOGS

## Principe

Avant toute correction :

1. Vérifier les logs.
2. Vérifier le code concerné.
3. Vérifier les routes.
4. Vérifier la base de données.
5. Vérifier les dépendances.

Ne jamais corriger un problème uniquement sur une hypothèse.

---

## Ordre d'analyse recommandé

Pour un incident ou un bug :

1. Logs Laravel
2. Logs Next.js
3. Requêtes réseau API
4. Logs Queue Workers
5. Logs Scheduler
6. Console navigateur
7. Logs Caddy

---

## Objectif

Les logs doivent permettre d'identifier :

- l'erreur exacte ;
- le composant concerné ;
- la route concernée ;
- l'utilisateur concerné si applicable ;
- le timestamp de l'incident ;
- la cause probable.

---

## Analyse

Toujours corréler :

- les timestamps ;
- les routes ;
- les requêtes ;
- les erreurs applicatives.

Une erreur visible dans les logs a priorité sur toute hypothèse théorique.

---

## Bonnes pratiques

- Commencer par les erreurs les plus récentes.
- Se concentrer sur le périmètre concerné.
- Éviter d'analyser des volumes inutiles de logs.
- Rechercher d'abord les erreurs 4xx et 5xx.
- Vérifier qu'une erreur est reproductible avant de conclure.

---

## Cas particuliers

Consulter les logs Caddy principalement en cas de :

- erreurs 502 ;
- erreurs 504 ;
- problèmes SSL/TLS ;
- redirections inattendues ;
- problèmes de reverse proxy ;
- problèmes Cloudflare ↔ Caddy.

---

## Règle importante

Les logs sont une source de vérité.

Ne jamais modifier du code avant d'avoir recherché des preuves dans les logs lorsqu'un incident ou un comportement anormal est signalé.