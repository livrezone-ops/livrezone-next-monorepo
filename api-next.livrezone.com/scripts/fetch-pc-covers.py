#!/usr/bin/env python3
"""Télécharge les couvertures servies par le PC (http.server) vers staging_pc/."""
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

STAGE = "/media/ouahib/SSD4server/books/covers/staging_pc"
URLS = "/tmp/pc_urls.txt"
HEADERS = {"User-Agent": "LivreZoneCoverSync/1.0"}
CONCURRENCY = 10
TIMEOUT = 60


def fetch(url, dest):
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return ("skip", url, dest, "")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        data = urllib.request.urlopen(req, timeout=TIMEOUT).read()
        tmp = dest + ".part"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, dest)
        return ("ok", url, dest, str(len(data)))
    except Exception as e:
        return ("fail", url, dest, str(e)[:90])


def main():
    os.makedirs(STAGE, exist_ok=True)
    rows = []
    for line in open(URLS):
        p = line.rstrip("\n").split("\t")
        if len(p) == 2:
            rows.append((p[0], p[1]))
    print(f"{len(rows)} fichier(s) a recuperer du PC", flush=True)
    counts = {"ok": 0, "skip": 0, "fail": 0}
    started = __import__("time").time()
    with open(os.path.join(os.path.dirname(URLS), "pc_fetch_failed.txt"), "w") as ffail:
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
            futs = [ex.submit(fetch, u, d) for u, d in rows]
            for i, fut in enumerate(as_completed(futs), 1):
                kind, url, dest, info = fut.result()
                counts[kind] += 1
                if kind == "fail":
                    ffail.write(f"{url}\t{info}\n")
                if i % 500 == 0:
                    rate = i / max(1, __import__("time").time() - started)
                    print(f"  {i}/{len(rows)} ok={counts['ok']} skip={counts['skip']} "
                          f"fail={counts['fail']} ({rate:.1f}/s)", flush=True)
    print(f"TERMINE ok={counts['ok']} skip={counts['skip']} fail={counts['fail']}", flush=True)


if __name__ == "__main__":
    main()
