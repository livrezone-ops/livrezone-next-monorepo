# AUTH

## Authentification

L’authentification du projet LivreZone repose sur :

- Laravel Sanctum ;
- Laravel Socialite.

Laravel est responsable de l’authentification et des autorisations.

Next.js consomme les mécanismes exposés par l’API Laravel.

---

## Règles absolues

Ne jamais casser :

- l’authentification Sanctum ;
- l’authentification sociale Socialite ;
- les sessions existantes ;
- les profils utilisateurs ;
- les rôles et permissions existants.

Ne jamais inventer :

- un endpoint d’authentification ;
- un guard ;
- un middleware ;
- un rôle ;
- une permission ;
- un fournisseur OAuth ;
- un mécanisme de stockage des tokens.

Toujours vérifier le code et la configuration réelle.

---

## Avant toute modification

Vérifier :

1. Les routes d’authentification existantes.
2. Les contrôleurs et middlewares concernés.
3. La configuration Sanctum.
4. La configuration Socialite.
5. Les modèles et tables concernés.
6. Les règles CORS et les domaines autorisés.
7. Le comportement actuel du frontend Next.js.
8. Les profils, rôles et permissions existants.

Ne jamais afficher le contenu complet d’un fichier `.env`.

Ne jamais exposer de secret OAuth, token, cookie ou identifiant sensible.

---

## Sécurité

Toute route protégée doit vérifier :

- l’utilisateur authentifié ;
- les autorisations nécessaires ;
- les données reçues ;
- l’accès aux ressources concernées.

La validation frontend ne remplace jamais :

- la validation Laravel ;
- l’authentification Laravel ;
- les autorisations côté serveur.

---

## Vérification

Après toute modification liée à l’authentification, tester au minimum :

- la connexion ;
- la déconnexion ;
- la récupération de l’utilisateur connecté ;
- l’accès aux routes protégées ;
- le refus des accès non autorisés ;
- l’authentification sociale concernée ;
- la conservation du profil utilisateur ;
- les appels API depuis Next.js.

Consulter les logs Laravel et Next.js en cas d’erreur.

---

## Mise à jour de ce document

Mettre à jour `AUTH.md` lorsqu’un changement important concerne :

- Sanctum ;
- Socialite ;
- un fournisseur OAuth ;
- les sessions ou cookies ;
- les rôles ou permissions ;
- les routes d’authentification ;
- la structure des profils utilisateurs.

---

## Règle d’or

Inspecter le fonctionnement réel avant toute modification.

Préserver l’authentification existante et appliquer les contrôles de sécurité côté Laravel.