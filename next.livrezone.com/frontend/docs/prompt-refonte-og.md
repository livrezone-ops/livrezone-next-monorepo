# Prompt — Refonte qualité du template d'image de partage OpenGraph LivreZone

*(palette imposée : ~60 % blanc · ~35 % violet de marque · ~5 % orange en accent)*

---

Le site LivreZone (marketplace de livres, frontend Next.js 16.3 dans `/home/livrezone/docker-data/volumes/livrezone_html_data/_data/next.livrezone.com/frontend`) génère une carte de partage Facebook/X 1200×630 pour chaque fiche annonce via le moteur satori de `next/og`. Le template actuel fonctionne mais est **visuellement médiocre** : couverture floue, palette à revoir, typographie générique moche. Ta mission : refondre la qualité visuelle, sans casser l'architecture de cache.

**Lis d'abord la doc** : `frontend/docs/og-share-images.md` (architecture complète, pièges, procédures de test et déploiement).

## Fichiers à manipuler (et seulement ceux-là)

1. `frontend/lib/og-template.tsx` — **cœur du travail**. Le composant JSX de la carte : couverture à gauche (doit rester ENTIÈREMENT visible, `objectFit: "contain"`, c'est la raison d'être du template), à droite badge marque, titre, ISBN, badge Neuf/Occasion, prix en MAD avec ancien prix barré si promo, et `livrezone.com`.
2. `frontend/lib/og-cover.ts` — pipeline couverture. Le flou vient probablement d'ici : la conversion sharp fait `resize({ width: 1000, height: 1000, fit: "inside" })` puis PNG. La couverture est affichée à ~316×498 px dans le template. Améliore la netteté : vise un rendu 2× de la zone couverture (la carte fait 1200 px de large), ajoute `.png({ compressionLevel: 9 })`, étudie un léger `.sharpen()` de sharp, et vérifie que le PNG final de satori n'est pas downsamplé.
3. `frontend/tmp-og-test/render.tsx` — tests de rendu standalone (4 cas : couverture webp, promo sans couverture, titre long, fallback marque). C'est ta boucle de retouche : **ne touche pas au build Next pour itérer**.

## Palette imposée — ~60 % blanc, ~35 % violet, ~5 % orange

Répartition visuelle de la carte à respecter :

- **~60 % de blanc (dominante)** : fond général de la carte en blanc (ou blanc cassé très proche, ex. `#FFFFFF`/`#FDFDFB`) — les textes passent en foncé par-dessus. La carte blanche qui porte la couverture reste blanche. Objectif : une carte claire, propre, éditoriale, lisible en petit dans le feed Facebook.
- **~35 % de violet de marque** : le violet officiel du site (références actuelles du dégradé home : `#581c87` et sa base sombre `#1a0a40`). À utiliser pour les surfaces secondaires : bandeau latéral ou vertical, bande de titre, fond du bloc prix, motifs géométriques discrets… mais PAS comme fond complet — le blanc reste majoritaire.
- **~5 % d'orange en accent** (orange du site `#F97316` / `#ea630a`) : uniquement pour les éléments d'appel — le prix ou le badge promo, un filet/soulignement, le point d'accent du logo. Le jaune `#fde047` de l'ancien template est abandonné.

Exemple de répartition conforme : fond blanc, colonne gauche ou bande fine violette portant la couverture, bandeau violet en pied ou en tête avec le badge LivreZone en blanc, prix en orange sur son bloc violet. Reste dans les ~60/35/5 (tolérance ±5 points) : pas de carte majoritairement violette.

Contraste : texte foncé (`#1a0a40` ou gris très foncé) sur blanc ; texte blanc sur violet ; orange réservé aux gros corps (prix) pour rester lisible. Facebook compresse les images → évite les dégradés ultra-subtils qui bandent.

## Typographie

La police par défaut (générique système) est ce qui rend le texte moche. **Embarque une vraie police** : télécharge un ou plusieurs TTF libres de droits cohérents avec la marque (ex. Inter/Outfit pour le texte + une graisse Black/ExtraBold pour le titre et le prix), range-les dans `frontend/assets/fonts/` (ou `public/`), charge-les en `ArrayBuffer` et passe-les à `new ImageResponse(..., { fonts: [{ name, data, weight, style }] })`. Le rendu est appelé dans `lib/og-cache.ts` (fonction `renderListingOG`) : mets le chargement des fonts en cache module-level pour ne pas relire les fichiers à chaque rendu. Même mécanisme dans `tmp-og-test/render.tsx`.

## Contraintes satori (non négociables, ça casse le rendu sinon)

- Chaque `<div>` doit avoir `display: "flex"` explicite.
- Pas de `filter: blur()`, pas de stops de dégradé > 100 %.
- Emoji (📖) : satori les rend via Noto Color Emoji embarquée par next/og — si tu remplaces le badge, teste que ça rend toujours.

## Ne casse pas

- La signature `listingOgTemplate(data: OgListingData)` (type dans `lib/og-template.tsx`, utilisé par `lib/og-cache.ts`).
- La couverture **entièrement visible sans recadrage** (c'est la raison d'être du template).
- Gestion titre > 92 caractères (ellipsis), cas sans couverture (placeholder), cas fallback sans prix (`price === 0` → pas de bloc prix).
- Badge état : valeurs possibles `neuf` → « Neuf », `occas` → « Occasion ».

## Boucle de test (sans build Next)

```bash
cd /home/livrezone/docker-data/volumes/livrezone_html_data/_data/next.livrezone.com/frontend
sudo -n docker run --rm -v "$PWD:/app" -w /app node:22-slim \
  sh -c "npm install --include=optional --no-save sharp >/dev/null 2>&1; npx -y tsx tmp-og-test/render.tsx"
```

→ inspecte `tmp-og-test/1-catalogue-webp.png` (cas principal : couverture webp réelle 800×800 déjà présente, `tmp-og-test/cover.webp`), `2-promo-placeholder.png`, `3-titre-long-sans-isbn.png`, `4-fallback-marque.png`. Itère jusqu'à un rendu net, hiérarchisé, professionnel — zoom sur la netteté de la couverture et du prix, et vérifie la répartition 60/35/5.

## Invalidation du cache

Les PNG sont cachées sur disque par version d'annonce ; la clé ne contient PAS la version du template. Ajoute une constante `TEMPLATE_VERSION = "v2"` dans `lib/og-cache.ts`, incluse dans le hash `versionOf()`, pour que ton nouveau design remplace l'ancien sans purger le volume.

## Déploiement (seulement après validation visuelle des 4 PNG de test)

```bash
sudo -n docker build -t livrezone-next .   # échoue si sharp cassé (garde-fou Dockerfile)
sudo -n docker stop livrezone-next; sudo -n docker rm livrezone-next
sudo -n docker run -d --name livrezone-next -p 3000:3000 --restart unless-stopped \
  --add-host api-next.livrezone.com:192.168.1.202 \
  -e INTERNAL_API_URL=https://api-next.livrezone.com -e NODE_NO_WARNINGS=1 \
  -v livrezone-og-cache:/var/cache/livrezone-og livrezone-next
```

## Vérification obligatoire

`curl -s -o /tmp/og.png -w "%{size_download}" https://livrezone.com/api/og/listing/133` — si la taille est **43 424 octets**, c'est le fallback marque (échec de rendu, voir `docker logs livrezone-next | grep "\[og\]"`). Sinon, récupère le PNG et vérifie-le visuellement (couverture entière, netteté, palette 60/35/5, prix lisible) avant de conclure. Les PNG de l'ancien template dans le volume sont automatiquement ignorées grâce à `TEMPLATE_VERSION`. Enfin, mets à jour `docs/og-share-images.md` (section design + palette + `TEMPLATE_VERSION`).
