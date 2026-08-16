# ERROR WORKFLOW

## Objectif

Identifier la cause réelle d'un problème avant toute modification.

Ne jamais corriger un problème sur une simple intuition.

Toute correction doit être basée sur des preuves observables.

---

## Étape 1 - Comprendre le problème

Identifier clairement :

- le comportement attendu ;
- le comportement observé ;
- la fonctionnalité concernée ;
- le contexte d'apparition ;
- les étapes permettant de reproduire le problème.

---

## Étape 2 - Vérifier les logs

Consulter en priorité :

1. Logs Laravel
2. Logs Next.js
3. Requêtes réseau API
4. Logs Queue Workers
5. Logs Scheduler
6. Console navigateur
7. Logs Caddy

Rechercher :

- erreurs ;
- exceptions ;
- warnings ;
- réponses HTTP anormales ;
- incohérences de données.

---

## Étape 3 - Vérifier l'existant

Contrôler :

- le code concerné ;
- les routes ;
- les validations ;
- les permissions ;
- la structure réelle de la base de données ;
- les dépendances impliquées.

Ne jamais supposer qu'un élément existe.

Toujours vérifier.

---

## Étape 4 - Identifier la cause

La cause retenue doit être confirmée par au moins une preuve concrète :

- log ;
- exception ;
- réponse API ;
- requête SQL ;
- comportement reproductible ;
- configuration vérifiable.

---

## Étape 5 - Définir la correction

Appliquer la modification la plus petite possible.

Privilégier :

- les corrections ciblées ;
- les changements localisés ;
- la réutilisation de l'existant.

Éviter :

- les refactorings inutiles ;
- les modifications hors périmètre ;
- les changements non liés à l'incident.

---

## Étape 6 - Vérifier la correction

Après modification :

- reproduire le scénario initial ;
- confirmer la disparition de l'erreur ;
- vérifier les logs ;
- vérifier les routes concernées ;
- vérifier les impacts collatéraux ;
- vérifier les régressions évidentes.

---

## Règle d'or

Comprendre avant de modifier.

Prouver avant de conclure.

Corriger uniquement ce qui est nécessaire.