#!/usr/bin/env python3
"""
correct-authors.py — Correction des auteurs de la table `books`
================================================================
Execute DANS le conteneur php-fpm-8.5 (Python 3 disponible) ou en local
avec acces MariaDB (port forwarding ou reseau Docker).

Usage :
    python3 correct-authors.py --dry-run          # simulation, aucun UPDATE
    python3 correct-authors.py --apply            # applique les corrections + backup JSONL
    python3 correct-authors.py --apply --chunk 5000  # taille de lot personnalisee

Corrections effectuees (phase 1 — normalisation BnF uniquement) :
    Reconstitution « Prenom Nom » depuis les paires
    ["Nom", "Prenom (dates). Qualite"] + retrait des suffixes qualite + dates.

Note : le nettoyage des titres (suppression du suffixe auteur en fin de titre)
    est prevu en phase 2 et n'est PAS inclus ici.

Garde-fous :
    - Collectivites longues conservees telles quelles.
    - Backup JSONL (id, old_authors, new_authors) avant UPDATE.
    - Aucune migration de schema, aucun DROP, aucun TRUNCATE.
    - Le champ `title` n'est jamais modifie par ce script.

Dependances Python :
    pip install mysql-connector-python python-dotenv
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except ImportError:
    sys.exit("ERREUR : module 'mysql-connector-python' manquant. Installer avec : pip install mysql-connector-python")

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # optionnel

# ---------------------------------------------------------------------------
# Configuration (variables d'environnement ou .env Laravel)
# ---------------------------------------------------------------------------
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

if load_dotenv and _ENV_FILE.exists():
    load_dotenv(_ENV_FILE)

DB_HOST     = os.environ.get("DB_HOST",     "mariadb")
DB_PORT     = int(os.environ.get("DB_PORT", "3306"))
DB_NAME     = os.environ.get("DB_DATABASE", "nextlivrezonebd")
DB_USER     = os.environ.get("DB_USERNAME", "livrezone")
DB_PASS     = os.environ.get("DB_PASSWORD", "")

# Fichier de backup JSONL (dans /tmp accessible depuis le conteneur)
BACKUP_FILE = Path(os.environ.get("BACKUP_FILE", "/tmp/correction_authors_backup.jsonl"))

# ---------------------------------------------------------------------------
# Suffixes qualite BnF a eliminer (liste blanche etendue)
# ---------------------------------------------------------------------------
_QUALITY_SUFFIXES = [
    r"Auteur(?:e)? du texte",
    r"Autrice du texte",
    r"Contributeur(?:s)?",
    r"Directeur(?:s)? de publication",
    r"Directeur(?:s)? de la publication",
    r"Editeur scientifique",
    r"Traducteur(?:e)?(?:s)?",
    r"Illustrateur(?:s)?",
    r"Cartographe(?:s)?",
    r"Prefacier(?:e)?(?:s)?",
    r"Postfacier(?:e)?(?:s)?",
    r"Annotateur(?:s)?",
    r"Collaborateur(?:s)?",
    r"Responsable(?:s)?",
    r"Directeur(?:s)?",
    r"Coordinateur(?:s)?",
    r"Photographe(?:s)?",
    r"Scenariste(?:s)?",
    r"Dessinateur(?:s)?",
    r"Coloriste(?:s)?",
    r"Auteur(?:s)?",
    r"Autrice(?:s)?",
]
_QUALITY_PAT = re.compile(
    r"[./]\s*(?:" + "|".join(_QUALITY_SUFFIXES) + r")(?:\s*/\s*(?:" + "|".join(_QUALITY_SUFFIXES) + r"))*\s*$",
    re.IGNORECASE | re.UNICODE,
)

# Detecte une annee dans la chaine — marqueur BnF fiable
_HAS_YEAR_PAT = re.compile(r"\(\d{4}", re.UNICODE)

# Detecte un element BnF avec qualite explicite (sans necessairement des dates)
_HAS_QUALITY_PAT = re.compile(
    r"\.[ \t]*(?:" + "|".join(_QUALITY_SUFFIXES) + r")",
    re.IGNORECASE | re.UNICODE,
)


# ---------------------------------------------------------------------------
# Normalisation BnF
# ---------------------------------------------------------------------------

def _strip_quality(text: str) -> str:
    """Retire le suffixe qualite et les dates entre parentheses en fin de chaine."""
    # Ex : "Ronan (1974-....). Auteur du texte" -> "Ronan"
    text = _QUALITY_PAT.sub("", text)
    # Retire les parentheses de dates (y compris dates approx 0330?-0390?) en fin
    text = re.sub(r"\s*\([^)]*\d{2,}[^)]*\)\s*$", "", text, flags=re.UNICODE)
    # Retire le point final residuel
    text = re.sub(r"\.\s*$", "", text, flags=re.UNICODE)
    return text.strip()


def _is_bnf_quality_element(elem: str) -> bool:
    """Vrai si l'element contient un marqueur BnF (date ou qualite)."""
    return bool(_HAS_YEAR_PAT.search(elem) or _HAS_QUALITY_PAT.search(elem))


def normalize_bnf_authors(authors: list) -> list:
    """
    Reconstitue les paires BnF ["Nom", "Prenom (dates). Qualite"] -> "Prenom Nom".

    Regles :
    - Si l'element i ne contient pas de marqueur BnF ET l'element i+1 en contient un,
      alors i est le nom de famille et i+1 est le prenom+qualite -> fusion "Prenom Nom".
    - Sinon, on nettoie l'element seul (retrait qualite/dates).
    - Les collectivites longues (> 3 mots) sont conservees telles quelles.
    """
    if not authors:
        return authors

    out = []
    i = 0
    n = len(authors)
    while i < n:
        elem = str(authors[i]).strip()
        if not elem:
            i += 1
            continue

        next_elem = str(authors[i + 1]).strip() if i + 1 < n else ""

        # Cas paire BnF : elem = "Nom" (court, sans marqueur), next = "Prenom (dates). Qualite"
        elem_is_plain = not _is_bnf_quality_element(elem)
        next_is_bnf   = next_elem and _is_bnf_quality_element(next_elem)

        # Heuristique : le "Nom" seul est court et n'est pas une collectivite
        elem_is_short = len(elem.split()) <= 3 and "," not in elem

        if elem_is_plain and elem_is_short and next_is_bnf:
            # Extraire le prenom (texte avant la premiere parenthese ou point qualite)
            prenom_raw = re.split(r"\s*[\(]", next_elem)[0]
            prenom_raw = _strip_quality(prenom_raw)
            prenom     = prenom_raw.strip(" .")
            if prenom:
                out.append(f"{prenom} {elem}")
            else:
                # Pas de prenom extractible -> on garde juste le nom
                out.append(elem)
            i += 2  # consomme les deux elements
        elif _is_bnf_quality_element(elem):
            # Element BnF autonome (ex : "Moliere (1622-1673). Auteur du texte")
            # Retirer les qualites et dates
            cleaned = _strip_quality(elem)
            if cleaned:
                out.append(cleaned)
            i += 1
        else:
            # Element simple, on le conserve
            out.append(elem)
            i += 1

    return out


# ---------------------------------------------------------------------------
# Boucle principale
# ---------------------------------------------------------------------------

def process(conn, *, dry_run: bool, chunk_size: int, backup_file: Path):
    cursor = conn.cursor(dictionary=True)

    # Compte total pour affichage de progression
    cursor.execute("SELECT COUNT(*) AS cnt FROM books WHERE authors IS NOT NULL AND authors != '[]' AND authors != ''")
    total_books = cursor.fetchone()["cnt"]
    print(f"Livres avec auteurs a traiter : {total_books:,}")

    changed_count = 0
    processed     = 0
    last_id       = 0
    backup_fh     = None

    if not dry_run:
        backup_fh = open(backup_file, "w", encoding="utf-8")
        print(f"Backup vers : {backup_file}")

    start = time.time()

    while True:
        cursor.execute(
            """
            SELECT id, authors
            FROM books
            WHERE id > %s
              AND authors IS NOT NULL
              AND authors != '[]'
              AND authors != ''
            ORDER BY id
            LIMIT %s
            """,
            (last_id, chunk_size),
        )
        rows = cursor.fetchall()
        if not rows:
            break

        updates = []

        for row in rows:
            book_id     = row["id"]
            authors_raw = row["authors"]

            # Decode le JSON authors
            try:
                authors = json.loads(authors_raw)
            except (json.JSONDecodeError, TypeError):
                authors = []

            if not isinstance(authors, list):
                authors = []

            # Filtre les elements non-string / vides
            authors = [str(a).strip() for a in authors if isinstance(a, str) and str(a).strip()]

            if not authors:
                continue

            # Normalisation BnF
            new_authors = normalize_bnf_authors(authors)

            if new_authors == authors:
                continue  # rien n'a change

            changed_count += 1
            updates.append({
                "id":          book_id,
                "old_authors": authors,
                "new_authors": new_authors,
            })

        # Ecriture backup + UPDATE en base
        if updates and not dry_run:
            update_cursor = conn.cursor()
            for u in updates:
                # Backup JSONL
                backup_fh.write(json.dumps(u, ensure_ascii=False) + "\n")

                # UPDATE MariaDB — title inchange
                update_cursor.execute(
                    "UPDATE books SET authors = %s WHERE id = %s",
                    (
                        json.dumps(u["new_authors"], ensure_ascii=False),
                        u["id"],
                    ),
                )
            conn.commit()
            update_cursor.close()
        elif updates and dry_run:
            # En dry-run, affiche les 5 premiers exemples de chaque lot
            for u in updates[:5]:
                print(f"\n  [#{u['id']}] AVANT : {u['old_authors']}")
                print(f"         APRES : {u['new_authors']}")

        last_id   = rows[-1]["id"]
        processed += len(rows)
        elapsed   = time.time() - start
        pct       = processed / total_books * 100 if total_books else 0
        print(
            f"\r  {processed:>8,} / {total_books:,} ({pct:5.1f}%) "
            f"| modifies: {changed_count:,} "
            f"[{elapsed:.0f}s]",
            end="",
            flush=True,
        )

    print()  # retour a la ligne apres le \r

    if backup_fh:
        backup_fh.close()

    cursor.close()
    return changed_count


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Normalisation BnF des auteurs (table books) — phase 1."
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Simulation sans modification")
    mode.add_argument("--apply",   action="store_true", help="Application reelle + backup JSONL")
    parser.add_argument("--chunk",  type=int, default=5000, help="Taille des lots SQL (defaut: 5000)")
    parser.add_argument(
        "--backup",
        type=str,
        default=str(BACKUP_FILE),
        help=f"Chemin du fichier backup JSONL (defaut: {BACKUP_FILE})",
    )
    args = parser.parse_args()

    mode_label = "DRY-RUN (aucune modification)" if args.dry_run else "APPLY (modifications en base)"
    print(f"\n{'='*60}")
    print(f"  correct-authors.py -- {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Mode     : {mode_label}")
    print(f"  Hote DB  : {DB_HOST}:{DB_PORT}  base={DB_NAME}")
    print(f"  Chunk    : {args.chunk}")
    if not args.dry_run:
        print(f"  Backup   : {args.backup}")
    print(f"{'='*60}\n")

    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            charset="utf8mb4",
            use_unicode=True,
            autocommit=False,
        )
        print(f"Connecte a MariaDB ({DB_HOST}:{DB_PORT}/{DB_NAME})\n")
    except MySQLError as e:
        sys.exit(f"Connexion MariaDB impossible : {e}")

    try:
        changed = process(
            conn,
            dry_run=args.dry_run,
            chunk_size=args.chunk,
            backup_file=Path(args.backup),
        )
    finally:
        conn.close()

    print(f"\n{'='*60}")
    print(f"  Termine")
    print(f"     Auteurs normalises : {changed:,}")
    if not args.dry_run:
        print(f"     Backup JSONL      : {args.backup}")
        print(f"\n  Prochaine etape : reindexation Meilisearch")
        print(f"     -> relancer populate-authors-list-ephemere.php")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
