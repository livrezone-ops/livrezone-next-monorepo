# REGLE - AUTHENTIFICATION ET REQUETES API NEXT.JS + LARAVEL

# PRIORITE

Ce document est prioritaire pour toute décision technique liée à :

- Sanctum
- Socialite
- Axios
- Next.js
- Server Components
- React Query
- Authentification
- Gestion des sessions
- Cookies
- Dashboard utilisateur

En cas de conflit avec une documentation plus ancienne,
ce document fait foi.




## OBJECTIF

Garantir une authentification fiable entre Next.js et Laravel, éviter les problèmes de transfert manuel des cookies en SSR et maintenir une source de données cohérente dans le dashboard.

## 1. ARCHITECTURE GENERALE

- Laravel est la source de vérité pour l'authentification, les autorisations et les données.
- Utiliser Laravel Sanctum en mode SPA avec des cookies de session HttpOnly.
- Utiliser Axios côté client pour les données privées et les actions du dashboard.
- Utiliser TanStack Query, ou un outil équivalent, pour le cache, les mutations et la synchronisation des données.
- Conserver le SSR principalement pour le squelette, le layout, les états de chargement et les pages publiques nécessitant du SEO.

## 2. CONFIGURATION AXIOS

- Créer une seule instance Axios centralisée et la réutiliser dans toute l'application.
- Configurer obligatoirement :
  - withCredentials: true
  - withXSRFToken: true
  - Accept: application/json
- Ne pas recréer une configuration Axios différente dans chaque composant.
- Centraliser le traitement des erreurs HTTP courantes : 401, 403, 419, 422 et 500.
- Ne pas déclencher de redirection globale automatique sur chaque erreur 401 sans vérifier le contexte de la page.

## 3. AUTHENTIFICATION

- Avant la connexion, appeler /sanctum/csrf-cookie.
- Envoyer ensuite la requête de connexion à Laravel avec Axios.
- Laisser le navigateur gérer les cookies de session.
- Ne jamais stocker un token d'authentification dans localStorage ou sessionStorage.
- Ne jamais exposer les cookies HttpOnly au code JavaScript.
- Configurer correctement les domaines, CORS, Sanctum et les cookies sécurisés en production.

## 4. DONNEES PRIVEES DU DASHBOARD

- Récupérer les données authentifiées du dashboard côté client avec Axios.
- Afficher côté serveur uniquement la structure initiale et un squelette de chargement si nécessaire.
- Ne pas transférer manuellement les cookies entre Next.js et Laravel pour chaque page.
- Ne pas utiliser le SSR authentifié si la page ne nécessite ni SEO ni rendu privé immédiat.

## 5. SSR ET SERVER COMPONENTS

- Pour les pages publiques nécessitant du SEO, utiliser les Server Components ou une récupération serveur dédiée.
- Si une donnée privée doit impérativement être récupérée côté serveur, utiliser un client serveur distinct et centralisé.
- Ne jamais utiliser l'instance Axios du navigateur dans un Server Component.
- Ne pas considérer withCredentials: true comme suffisant côté serveur : Axios serveur n'a pas automatiquement accès aux cookies du navigateur.
- Toute transmission serveur des cookies doit être explicite, centralisée et limitée aux cas réellement nécessaires.
- Les flux de connexion, déconnexion ou renouvellement de session ne doivent pas dépendre d'un forwarding fragile des headers Set-Cookie via plusieurs couches.

## 6. CACHE ET SYNCHRONISATION

- Utiliser TanStack Query ou un mécanisme équivalent comme source de synchronisation côté client.
- Après chaque mutation, invalider ou actualiser les requêtes concernées.
- Après un archivage, une suppression, une vente ou une republication :
  1. attendre la réussite de la requête Laravel ;
  2. recharger la liste complète depuis l'API ;
  3. recalculer les compteurs depuis les nouvelles données ;
  4. conserver ou appliquer le filtre attendu uniquement après la synchronisation ;
  5. afficher le message de succès.
- Ne jamais calculer les compteurs à partir d'une liste partielle correspondant uniquement au filtre actif.
- Eviter le rechargement complet de la page lorsque l'invalidation ciblée des données suffit.

## 7. AUTORISATIONS ET SECURITE

- Toutes les permissions doivent être vérifiées dans Laravel, même si l'interface masque les boutons ou bloque une page.
- Next.js ne doit jamais être la seule couche de protection.
- Vérifier systématiquement côté Laravel :
  - l'utilisateur authentifié ;
  - le propriétaire de la ressource ;
  - le rôle administrateur ;
  - le statut du listing ;
  - l'autorisation d'exécuter l'action demandée.
- Utiliser les Policies, Gates ou Form Requests Laravel lorsque cela est adapté.
- Valider toutes les entrées côté serveur.
- Ne jamais exposer de secret, token ou information sensible dans le frontend.

## 8. GESTION DES ERREURS

- 401 : utilisateur non authentifié ou session expirée.
- 403 : action interdite.
- 419 : session ou jeton CSRF expiré ; renouveler le cookie CSRF puis réessayer uniquement si l'opération peut être répétée sans risque.
- 422 : erreur de validation ; afficher les messages retournés par Laravel.
- 500 : erreur serveur ; afficher un message générique et conserver les détails techniques dans les logs.
- Ne jamais masquer silencieusement une erreur.
- Ne jamais répéter automatiquement une mutation non idempotente sans protection contre les doublons.

## 9. SEPARATION RECOMMANDEE

- Pages publiques et SEO : Server Components ou récupération serveur.
- Dashboard authentifié : Axios côté client avec credentials.
- Cache et synchronisation : TanStack Query.
- Authentification : Laravel Sanctum avec cookies HttpOnly.
- Autorisations : Laravel exclusivement comme source de vérité.
- SSR authentifié : uniquement lorsque cela apporte un bénéfice réel et avec un client serveur dédié.

## 10. REGLE FINALE

Pour toute nouvelle fonctionnalité :

1. Déterminer si la donnée est publique ou privée.
2. Utiliser le SSR pour les données publiques nécessitant du SEO.
3. Utiliser Axios côté client pour les données privées du dashboard.
4. Ne jamais dépendre du forwarding manuel des cookies SSR si une récupération client-side est suffisante.
5. Invalider et recharger les données concernées après chaque mutation.
6. Vérifier toutes les autorisations dans Laravel.
7. Tester séparément l'authentification, le CSRF, les permissions, les mutations, les filtres et les compteurs.

Priorités : fiabilité, sécurité, simplicité, cohérence des données et limitation des appels inutiles.
