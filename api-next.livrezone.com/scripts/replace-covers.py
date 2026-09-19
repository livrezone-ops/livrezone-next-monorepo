#!/usr/bin/env python3
"""
replace-covers.py
=================
Scanne replace_covers/, convertit en WebP si besoin,
puis copie dans originals/ et thumbnails/160/, 320/, 640/.

Usage :
    python3 replace-covers.py [--dry-run]
"""

import os
import sys
import shutil
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow manquant : pip install Pillow")

BASE        = Path("/media/ouahib/SSD4server/books/covers")
SRC_DIR     = BASE / "replace_covers"
ORIG_DIR    = BASE / "originals"
THUMB_DIR   = BASE / "thumbnails"
THUMB_SIZES = [160, 320, 640]

DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------

def isbn_subdir(isbn: str) -> str:
    """Retourne les 2 DERNIERS caracteres de l ISBN (sous-dossier).

    Convention du proxy Laravel (routes/web.php) : substr(filename, -2).
    Les 2 premiers chiffres ne sont JAMAIS consultes -> un fichier ecrit
    dans isbn[:2] reste invisible et l'ancienne couverture continue d'etre
    servie via le sous-dossier isbn[-2:].
    """
    return isbn[-2:] if len(isbn) >= 2 else "00"

def to_webp(src: Path, tmp: Path) -> Path:
    """Convertit src en WebP dans tmp/ si pas deja WebP. Retourne le Path WebP."""
    if src.suffix.lower() == ".webp":
        return src
    dest = tmp / (src.stem + ".webp")
    img = Image.open(src).convert("RGB")
    img.save(dest, "WEBP", quality=90)
    return dest

def make_thumbnail(src: Path, dest: Path, size: int):
    """Cree un thumbnail carre max size x size (conserve le ratio)."""
    img = Image.open(src).convert("RGB")
    img.thumbnail((size, size), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=85)

# ---------------------------------------------------------------------------

images = sorted([
    f for f in SRC_DIR.iterdir()
    if f.is_file() and f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}
])

if not images:
    print(f"Aucune image trouvee dans {SRC_DIR}")
    sys.exit(0)

print(f"{'[DRY-RUN] ' if DRY_RUN else ''}{len(images)} image(s) a traiter\n")

tmp_dir = SRC_DIR / ".tmp_webp"
if not DRY_RUN:
    tmp_dir.mkdir(exist_ok=True)

ok = 0
errors = []

for src in images:
    isbn = src.stem  # nom de fichier sans extension = ISBN
    sub  = isbn_subdir(isbn)

    print(f"  {src.name}  ->  isbn={isbn}  sous-dossier={sub}/")

    if DRY_RUN:
        print(f"    [dry] originals/{sub}/{isbn}.webp")
        for sz in THUMB_SIZES:
            print(f"    [dry] thumbnails/{sz}/{sub}/{isbn}.webp")
        ok += 1
        continue

    try:
        # 1. Convertit en WebP si besoin
        webp = to_webp(src, tmp_dir)

        # 2. Copie dans originals/
        orig_dest = ORIG_DIR / sub / f"{isbn}.webp"
        orig_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(webp, orig_dest)
        print(f"    OK  originals/{sub}/{isbn}.webp")

        # 3. Thumbnails
        for sz in THUMB_SIZES:
            thumb_dest = THUMB_DIR / str(sz) / sub / f"{isbn}.webp"
            make_thumbnail(webp, thumb_dest, sz)
            print(f"    OK  thumbnails/{sz}/{sub}/{isbn}.webp")

        ok += 1

    except Exception as e:
        print(f"    ERREUR : {e}")
        errors.append((src.name, str(e)))

# Nettoyage du dossier temporaire
if not DRY_RUN and tmp_dir.exists():
    shutil.rmtree(tmp_dir)

print(f"\n{'='*50}")
print(f"  Traites : {ok}/{len(images)}")
if errors:
    print(f"  Erreurs : {len(errors)}")
    for name, err in errors:
        print(f"    - {name} : {err}")
print("="*50)
