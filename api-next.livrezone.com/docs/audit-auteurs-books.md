# Audit des auteurs de la table `books` — stats & plan de normalisation (07/09/2026)

> Demande : statistiques des auteurs de la table `books`, puis correction des cas
> « titre mélangé au nom de l'auteur ». Rapport d'analyse **avant correction** :
> rien n'a été modifié en base à ce stade.

## 1. Méthode

Script éphémère `analysis-authors-ephemere.php` (racine du dépôt, **à supprimer après
usage**) exécuté via `docker exec php-fpm-8.5 php …`, balayage complet des 697 172
livres par chunks de 10 000, classification de chaque tableau `authors` (JSON) et
croisement avec `title`. Sortie brute archivée : `/tmp/analyse_auteurs.txt`.

## 2. Chiffres clés

| Indicateur | Valeur |
|---|---|
| Livres totaux | **697 172** |
| Sans auteur (NULL, `[]`, vides) | 164 304 (23,6 %) |
| Avec au moins 1 auteur | 532 868 |
| Tableaux à 1 élément | 143 871 |
| Tableaux à 2 éléments | 323 961 |
| Tableaux à 3+ éléments | 65 036 |
| Auteurs distincts (nettoyage minimal) | 260 276 |
| `metadata_source` | **vide sur 100 % des lignes** → aucune traçabilité de la source |

Top 5 auteurs (après dédoublonnage minimal) : `Collectif` (11 127), `مجموعة مؤلفين`
(1 286), puis une cohorte de prénoms orphelins type « Philippe. Auteur du texte »
(1 038) — voir § 3.2.

## 3. Typologie des défauts constatés

### 3.1 Format BnF brut (dominant) — 376 093 livres (70,6 % des livres avec auteur)

442 876 éléments portent le suffixe qualité BnF. Le tableau `authors` contient des
notices BnF non transformées, scindées sur la virgule :

```json
["Chéneau","Ronan (1974-....). Auteur du texte"]        → attendu : "Ronan Chéneau"
["Boulet","François (1965-....). Auteur du texte",
 "Gaulle","Charles de (1890-1970). Auteur du texte"]    → attendu : ["François Boulet", "Charles de Gaulle"]
["Molière (1622-1673). Auteur du texte"]                → attendu : "Molière"
["Fabrice (1972-.... ; romancier). Auteur du texte"]    → attendu : "Fabrice"
["Louis XIV (1638-1715 ; roi de France). Auteur du texte"] → attendu : "Louis XIV"
["Godin","Seth. Auteur du texte / Autrice du texte"]    → attendu : "Seth Godin"
```

Conséquence visible dans le top auteurs : des « auteurs » fantômes qui ne sont que des
prénoms (« Philippe. Auteur du texte » ×1 038, « Michel. Auteur du texte » ×907…) :
la paire `["Nom","Prénom. Qualité"]` **sans dates** n'est pas fusionnable naïvement,
il faut reconstruire la notice `Nom, Prénom. Qualité`.

Variantes rencontrées : suffixes multiples (`Auteur du texte / Autrice du texte`),
qualité **dans** les parenthèses (`(Juin 1957 ; Auteur du texte)`), qualités diverses
(romancier, scénariste, illustrateur, cartographe, dalaï lama, saint…), dates
approximatives (`0330?-0390?`), collectivités longues légitimes (ministères, colloques).

### 3.2 Titres pollués par le nom de l'auteur — 38 432 livres

Le titre se termine par le nom de l'auteur concaténé (défaut d'import source) :

```
#122   "Hépatologie ; Maladies des voies biliaires (2e éd.) William Berrebi"   [Berrebi, William]
#146   "Une mémoire pour apprendre ([Nouvelle éd. revue et augmentée]) Cécile…" [Delannoy, Cécile]
#555   "Droit des biens (4e éd.) Cyril Grimaldi,…"                              [Grimaldi, Cyril]
#5659  "Dieu et l'art de la pêche à la ligne (Nouvelle éd.) Marc-Alain Ouaknin" [Ouaknin, Marc-Alain]
```

C'est le cas « titre mélangé au nom de l'auteur » signalé. Cas limites détectés :
nom d'auteur **au milieu** du titre suivi d'autres mentions
(`"Les seins de café (Éd. intégrale) Servais ; couleurs, Raives"`), titre **entièrement
égal** au nom d'auteur (98 cas, ex. monographies d'art `#30 "Thierry Fontaine"` — à ne
pas toucher).

### 3.3 Éléments d'auteur suspects (mineurs)

| Défaut | Volume | Exemple |
|---|---|---|
| Élément contenant « : » (sous-titre dans l'auteur) | 8 831 | `#5163` `Collectif École : changer de cap (France). Auteur du texte` |
| Élément > 80 caractères (souvent collectivités légitimes) | 2 789 | `France. Ministère de l'emploi et de la solidarité. Direction…` |
| Élément = ISBN | 1 | `#47445` `9782752400741` |
| Élément contenant « by » | 2 | `Fit by Clem (1990-…)` (faux positif, pseudo) |
| Élément auteur = titre entier | 98 | `#84379` Marivaux (légitime en général) |

## 4. Plan de correction proposé (non appliqué)

1. **Normalisation BnF** sur les 376 093 livres : reconstitution des paires
   `["Nom","Prénom (dates). Qualité"]` → `Prénom Nom`, retrait des suffixes qualité
   (liste blanche : Auteur/Autrice du texte, Directeur de publication, Éditeur
   scientifique, Traducteur, Illustrateur, Cartographe…) et des dates biographiques ;
   conservation des collectivités ; éléments sans marqueur BnF laissés intacts.
   Ambiguïté `["Nom","Prénom"]` sans aucun marqueur : ne fusionner que si le 1er
   élément est un nom de famille attesté ailleurs en paire BnF (2ᵉ passe).
2. **Nettoyage des titres** : retrait du suffixe « Prénom Nom » (ou « Nom, Prénom »)
   uniquement quand il correspond à un auteur **du livre lui-même**, en fin de chaîne,
   avec garde-fous : titre nettoyé ≥ 12 caractères (protège les monographies éponymes),
   pas de nom au milieu/au début.
3. **Backup** : export JSONL des lignes modifiées (id, title, authors) avant UPDATE,
   pour rollback exact.
4. **Réindexation Meilisearch** : mise à jour partielle (`addDocuments` = merge)
   par lots de 5 000 des champs `title`, `authors`, `authors_list` — même pattern
   que `populate-authors-list-ephemere.php`. Le filtre `authors_list = "…"` (facette
   exacte, `ConfigureBookSearch.php:36`) change de valeurs → les fronts doivent
   refléter les noms normalisés après réindex.
5. **Point à vérifier avant apply** : régénération cohérente de `normalized_title`
   (calculé à l'import SQLite, utilisé par `SyncTitlesAndMeilisearch`/`UpdateDbTitles`)
   si `title` est modifié ; impact déduplication à mesurer.

## 5. Statut

- [x] Analyse complète des 697 172 livres (07/09/2026)
- [x] Script de correction — phase 1 BnF : 380 849 auteurs normalisés, backup `/tmp/correction_authors_backup.jsonl` (07/09/2026)
- [x] Réindexation Meilisearch : 697 172 documents mis à jour en partiel (07/09/2026)
- [ ] Vérifications post-correction (recherche frontend, facettes auteurs)
- [ ] Nettoyage des titres — phase 2 (38 432 livres concernés, script à créer)
- [ ] Suppression scripts éphémères (`analysis-authors-ephemere.php`, `populate-authors-list-ephemere.php`)
