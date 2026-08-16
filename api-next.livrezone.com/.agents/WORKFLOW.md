# WORKFLOW

Toujours suivre cet ordre :

1. Lire le besoin.
2. Analyser l'existant.
3. Consulter les logs pertinents si le sujet concerne un bug ou un incident.
4. Identifier les fichiers impactés.
5. Proposer un plan.
6. Implémenter par petites étapes.
7. Lancer build + tests.
8. Corriger les erreurs.
9. Vérifier les régressions.
10. Vérifier que les règles de AGENTS.md et RULES.md sont respectées.
11. Résumer les changements effectués.

## Diagnostic

Pour tout bug :

1. Vérifier les logs Caddy.
2. Vérifier les logs Laravel.
3. Vérifier les logs Next.js.
4. Corréler les timestamps.
5. Identifier la couche responsable.

## Règle d'or

Ne jamais modifier plus que nécessaire.
Privilégier la solution la plus simple compatible avec l'architecture existante.
Ne jamais refactoriser du code non lié à la demande.