#!/usr/bin/env python3
"""
integrate-pc-covers.py
======================
Intègre les couvertures récupérées du PC (staging_pc/) dans le stockage
catalogue : originals/<2derniers>/<isbn>.webp + thumbnails 160/320/640.
Ne touche jamais à un fichier existant. Génère la liste des ISBN prêts
pour l'UPDATE base (cover_path = CONCAT(isbn_13,'.webp')).
"""
import os
import io
import sys
from PIL import Image

BASE = "/media/ouahib/SSD4server/books/covers"
STAGE = f"{BASE}/staging_pc"
ORIG = f"{BASE}/originals"
THUMBS = f"{BASE}/thumbnails"
SIZES = []  # décision 18/09/2026 : originals seulement — le proxy sert
            # l'original en fallback quand une miniature manque
OUT = "/tmp/pc_integrated_isbns.txt"
FAILED = "/tmp/pc_integrated_failed.txt"


def main():
    files = [f for f in os.listdir(STAGE) if not f.endswith(".part")]
    print(f"{len(files)} fichier(s) en staging", flush=True)
    ok = failed = skipped = 0
    with open(OUT, "w") as out_ok, open(FAILED, "w") as out_fail:
        for i, fname in enumerate(files, 1):
            isbn = os.path.splitext(fname)[0]
            sub = isbn[-2:] if len(isbn) >= 2 else "00"
            orig_path = f"{ORIG}/{sub}/{isbn}.webp"
            if os.path.isfile(orig_path):
                skipped += 1
                out_ok.write(isbn + "\n")
                continue
            try:
                img = Image.open(os.path.join(STAGE, fname))
                w, h = img.size
                if w < 10 or h < 10:
                    raise ValueError(f"dimensions {w}x{h}")
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                buf = io.BytesIO()
                img.save(buf, "WEBP", quality=90)
                webp = buf.getvalue()
                tmp = orig_path + ".part"
                with open(tmp, "wb") as f:
                    f.write(webp)
                os.replace(tmp, orig_path)
                for sz in SIZES:
                    d = f"{THUMBS}/{sz}/{sub}"
                    os.makedirs(d, exist_ok=True)
                    tp = f"{d}/{isbn}.webp"
                    if not os.path.isfile(tp):
                        timg = Image.open(io.BytesIO(webp)).convert("RGB")
                        timg.thumbnail((sz, sz), Image.LANCZOS)
                        tb = io.BytesIO()
                        timg.save(tb, "WEBP", quality=85)
                        ttmp = tp + ".part"
                        with open(ttmp, "wb") as f:
                            f.write(tb.getvalue())
                        os.replace(ttmp, tp)
                ok += 1
                out_ok.write(isbn + "\n")
            except Exception as e:
                failed += 1
                out_fail.write(f"{isbn}\t{fname}\t{str(e)[:80]}\n")
            if i % 500 == 0:
                print(f"  {i}/{len(files)} ok={ok} skip={skipped} fail={failed}", flush=True)
    print(f"TERMINE integre={ok} deja_present={skipped} echec={failed}", flush=True)


if __name__ == "__main__":
    main()
