# MIGRATION WORKFLOW

## Objectif

Migrer progressivement les fonctionnalités du projet historique Laravel + Livewire vers l'architecture cible :

- Backend : Laravel API REST
- Frontend : Next.js

Le projet historique constitue la référence fonctionnelle et métier.

Il ne doit jamais être modifié.

---

## Principe général

La migration doit être réalisée fonctionnalité par fonctionnalité.

Ne jamais tenter de migrer plusieurs domaines métier simultanément.

Chaque fonctionnalité migrée doit rester compatible avec l'architecture existante.

---

## Étape 1 - Identifier la fonctionnalité source

Localiser la fonctionnalité dans le projet historique.

Identifier :

- les écrans concernés ;
- les parcours utilisateurs ;
- les règles métier ;
- les dépendances éventuelles.

---

## Étape 2 - Analyser l'existant

Étudier les éléments réellement utilisés :

- modèles Eloquent ;
- relations ;
- migrations ;
- contrôleurs ;
- composants Livewire ;
- vues Blade ;
- validations ;
- policies ;
- seeders si nécessaire.

Ne jamais supposer le fonctionnement métier.

Toujours vérifier dans le code.

---

## Étape 3 - Vérifier l'existant côté API

Avant toute création :

- rechercher les routes existantes ;
- rechercher les contrôleurs existants ;
- rechercher les services existants ;
- rechercher les ressources API existantes ;
- rechercher les validations déjà présentes.

Réutiliser avant de créer.

---

## Étape 4 - Vérifier la base de données

Contrôler :

- la structure réelle des tables ;
- les colonnes utilisées ;
- les contraintes ;
- les relations ;
- les données existantes.

Ne jamais supposer que la base correspond aux migrations.

---

## Étape 5 - Définir le périmètre minimal

Identifier uniquement les éléments nécessaires à la migration.

Éviter :

- les refactorings ;
- les optimisations non demandées ;
- les changements hors périmètre ;
- les restructurations d'architecture.

---

## Étape 6 - Implémenter l'API Laravel

Créer ou compléter uniquement ce qui est nécessaire :

- routes ;
- contrôleurs ;
- services ;
- ressources API ;
- validations ;
- policies.

Respecter les conventions existantes du projet.

Toute validation métier doit rester côté serveur.

---

## Étape 7 - Tester l'API

Vérifier :

- les réponses ;
- les codes HTTP ;
- les validations ;
- les permissions ;
- les cas d'erreur ;
- la compatibilité avec les données existantes.

Consulter les logs Laravel en cas d'anomalie.

---

## Étape 8 - Implémenter le frontend Next.js

Créer ou adapter les composants nécessaires.

Respecter :

- les conventions existantes ;
- le design actuel ;
- les composants déjà présents ;
- les règles Axios du projet.

Réutiliser avant de créer.

---

## Étape 9 - Vérifier le frontend

Contrôler :

- build ;
- lint ;
- typage TypeScript ;
- appels API ;
- gestion des erreurs ;
- responsive.

Consulter les logs Next.js en cas d'anomalie.

---

## Étape 10 - Vérifier le comportement fonctionnel

Comparer le résultat avec le projet historique.

Vérifier :

- les règles métier ;
- les validations ;
- les permissions ;
- les données affichées ;
- le parcours utilisateur.

L'objectif est la compatibilité fonctionnelle.

---

## Étape 11 - Vérifier les régressions

S'assurer que :

- les fonctionnalités existantes continuent de fonctionner ;
- les appels API existants ne sont pas cassés ;
- l'authentification reste fonctionnelle ;
- les permissions restent cohérentes.

---

## Étape 12 - Finaliser

Effectuer :

- les vérifications finales ;
- un commit ciblé ;
- une documentation minimale si nécessaire.

Une migration doit rester :

- petite ;
- isolée ;
- identifiable ;
- réversible autant que possible.

---

## Règle d'or

Comprendre la fonctionnalité existante avant de la migrer.

Migrer uniquement ce qui est nécessaire.

Préserver le comportement métier avant toute amélioration technique.