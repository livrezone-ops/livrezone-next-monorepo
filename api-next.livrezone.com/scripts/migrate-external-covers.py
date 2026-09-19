#!/usr/bin/env python3
"""
migrate-external-covers.py
==========================
Migre les couvertures externes (cover_source_url) vers le stockage local.

Entrée : /tmp/migration_covers.tsv  (id \t isbn_13 \t cover_source_url)
Sorties dans /tmp/covers_migration/ :
  - update_ids.txt  : ids à passer à cover_path = '<isbn>.webp'
  - null_ids.txt    : ids dont cover_source_url doit être mis à NULL
                      (logo leslibraires, images vides 1x1)
  - failed.tsv      : échecs de téléchargement (id, isbn, url, raison)
  - done.flag       : écrit en fin de run

Reprise : les fichiers déjà présents en originals/ sont réutilisés (idempotent).
"""
import os
import sys
import io
import time
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

BASE = "/media/ouahib/SSD4server/books/covers"
ORIG = f"{BASE}/originals"
THUMBS = f"{BASE}/thumbnails"
SIZES = []  # décision 18/09/2026 : originals seulement — le proxy sert
            # l'original en fallback quand une miniature manque
# Sorties sur le stockage persistant (pas /tmp : isolé par sandbox et perdu)
OUT = os.environ.get("TSV_OUT", f"{BASE}/migration_results")
TSV = os.environ.get("TSV_IN", "/tmp/migration_covers.tsv")
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 LivreZoneCoverSync/1.0"}
CONCURRENCY = 6
TIMEOUT = 25
RETRIES = 2

LOGO_HOSTS = ("static.leslibraires.fr",)  # logo de site, pas une couverture


def to_webp(data: bytes):
    """Retourne (webp_bytes, w, h) ou lève une exception."""
    img = Image.open(io.BytesIO(data))
    w, h = img.size
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=90)
    return buf.getvalue(), w, h


def thumbnail(webp_bytes: bytes, size: int) -> bytes:
    img = Image.open(io.BytesIO(webp_bytes)).convert("RGB")
    img.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=85)
    return buf.getvalue()


def fetch(url: str) -> bytes:
    # URLs à caractères non-ASCII (ex. noms de fichiers arabes darsoulami.ma)
    # : urllib exige du percent-encoding
    url = urllib.parse.quote(url, safe=":/%?#=&")
    last = None
    for attempt in range(RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            return urllib.request.urlopen(req, timeout=TIMEOUT).read()
        except Exception as e:
            last = e
            time.sleep(1 + attempt)
    raise last


def process(row):
    book_id, isbn, url = row
    sub = isbn[-2:] if len(isbn) >= 2 else "00"
    orig_path = f"{ORIG}/{sub}/{isbn}.webp"

    # Logo de site : pas une couverture -> NULL
    if any(h in url for h in LOGO_HOSTS):
        return ("null", book_id, isbn, url, "logo de site")

    if os.path.isfile(orig_path):
        return ("update", book_id, isbn, url, "deja present")

    try:
        data = fetch(url)
        if len(data) < 1200:
            return ("null", book_id, isbn, url, f"image trop petite ({len(data)} o)")
        webp, w, h = to_webp(data)
        if w < 10 or h < 10:
            return ("null", book_id, isbn, url, f"dimensions {w}x{h}")
        tmp = orig_path + ".part"
        with open(tmp, "wb") as f:
            f.write(webp)
        os.replace(tmp, orig_path)
        for sz in SIZES:
            d = f"{THUMBS}/{sz}/{sub}"
            os.makedirs(d, exist_ok=True)
            tp = f"{d}/{isbn}.webp"
            if not os.path.isfile(tp):
                t = thumbnail(webp, sz)
                with open(tp + ".part", "wb") as f:
                    f.write(t)
                os.replace(tp + ".part", tp)
        return ("update", book_id, isbn, url, f"{w}x{h}")
    except Exception as e:
        return ("failed", book_id, isbn, url, str(e)[:100])


def main():
    os.makedirs(OUT, exist_ok=True)
    only_failed = "--retry-failed" in sys.argv
    rows = []
    with open(TSV) as f:
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) == 3:
                rows.append(p)

    # Reprise : exclure les ids déjà traités (update + null + failed)
    done = set()
    for name in ("update_ids.txt", "null_ids.txt", "failed.tsv"):
        path = f"{OUT}/{name}"
        if os.path.isfile(path):
            with open(path) as f:
                for l in f:
                    done.add(l.split("\t")[0])
    if only_failed:
        rows = [r for r in rows if r[0] in done and r[0] not in set(
            x.split("\t")[0] for x in open(f"{OUT}/update_ids.txt").readlines()
            + open(f"{OUT}/null_ids.txt").readlines()
        ) if True]
    else:
        rows = [r for r in rows if r[0] not in done]

    print(f"{len(rows)} livre(s) a traiter", flush=True)
    counts = {"update": 0, "null": 0, "failed": 0}
    started = time.time()

    def handle(res):
        kind, book_id, isbn, url, info = res
        counts[kind] += 1
        n = sum(counts.values())
        if kind == "update":
            with open(f"{OUT}/update_ids.txt", "a") as f:
                f.write(f"{book_id}\t{isbn}\t{info}\n")
        elif kind == "null":
            with open(f"{OUT}/null_ids.txt", "a") as f:
                f.write(f"{book_id}\t{isbn}\t{info}\n")
        else:
            with open(f"{OUT}/failed.tsv", "a") as f:
                f.write(f"{book_id}\t{isbn}\t{url}\t{info}\n")
        if n % 250 == 0:
            rate = n / max(1, time.time() - started)
            eta = (len(rows) - n) / max(0.1, rate) / 60
            print(f"  {n}/{len(rows)} ok={counts['update']} null={counts['null']} "
                  f"echec={counts['failed']} ({rate:.1f}/s, ETA {eta:.0f} min)", flush=True)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = [ex.submit(process, r) for r in rows]
        for fut in as_completed(futures):
            handle(fut.result())

    print(f"TERMINE ok={counts['update']} null={counts['null']} echec={counts['failed']}", flush=True)
    with open(f"{OUT}/done.flag", "w") as f:
        f.write("done\n")


if __name__ == "__main__":
    main()
