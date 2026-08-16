# DATABASE

## Base de données

Le moteur utilisé est MariaDB.

La nouvelle architecture Laravel API REST + Next.js utilise une base dédiée :

```text
nextlivrezonedb
```

Cette base est distincte de celle du projet historique et elle est actuellement presque complète.

Le frontend Next.js ne doit jamais accéder directement à la base. Tout accès aux données doit passer par l’API Laravel.

---

## Projet historique

La base du projet historique sert uniquement de référence pour comprendre :

- les tables ;
- les colonnes ;
- les relations ;
- les données attendues ;
- les règles métier.

Ne jamais modifier la base historique.

Ne jamais exécuter une migration de la nouvelle API sur la base historique.

---

## Vérifications obligatoires

Avant toute modification :

1. Confirmer que la connexion active cible `nextlivrezonedb`.
2. Vérifier la structure réelle de la table concernée.
3. Vérifier les migrations existantes et leur état.
4. Vérifier les modèles et relations Eloquent.
5. Vérifier les données existantes.
6. Identifier le changement minimal nécessaire.

La structure réelle de `nextlivrezonedb` est prioritaire sur les migrations ou la documentation.

Ne jamais inventer une table, une colonne, une relation, une contrainte ou un index.

---

## Migrations

Toute évolution du schéma doit passer par une migration Laravel adaptée à l’existant.

Les migrations doivent être :

- minimales ;
- ciblées ;
- compatibles avec les données existantes ;
- réversibles lorsque cela est possible.

Ne jamais utiliser :

```text
migrate:fresh
```

Ne jamais supprimer une table, une colonne ou des données sans instruction explicite, analyse d’impact et sauvegarde vérifiée.

---

## Mise à jour de ce document

Après tout ajout ou modification d’une migration :

1. Vérifier la structure obtenue dans `nextlivrezonedb`.
2. Vérifier que les données existantes sont préservées.
3. Vérifier si `DATABASE.md` doit être mis à jour.
4. Documenter uniquement les changements structurels importants et durables.

Si aucune mise à jour n’est nécessaire, l’indiquer dans le résumé de l’intervention.

---

## Sécurité

Ne jamais :

- afficher le contenu complet d’un fichier `.env` ;
- exposer des identifiants de connexion ;
- exposer des mots de passe ou des secrets ;
- modifier directement la base historique ;
- exécuter une opération destructive sans sauvegarde.

---

## Règle d’or

Toujours confirmer que la base ciblée est `nextlivrezonedb`.

Inspecter la structure réelle avant de modifier.

Préserver les données existantes.