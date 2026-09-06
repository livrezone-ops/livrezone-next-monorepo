// Slugs canoniques (SEO catalogue, 06/09) : une seule source de vérité pour
// les liens cartes, les sitemaps XML et le canonical/redirect des pages détail.
// Toute variante de slug est redirigée vers ce canonical par la page concernée.

export function slugifyTitle(title: string | null | undefined, slice = 60): string {
  const slug = (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slice > 0 ? slug.slice(0, slice) : slug;
}

/** Slug canonique d'une fiche livre : {id}-{isbn}-{titre-slugifié-60}. */
export function bookSlug(
  book: { id: number; isbn_13?: string | null; title?: string | null },
): string {
  const slug = slugifyTitle(book.title);
  return `${book.id}${book.isbn_13 ? "-" + book.isbn_13 : ""}${slug ? "-" + slug : ""}`;
}

export function bookHref(
  book: { id: number; isbn_13?: string | null; title?: string | null },
): string {
  return `/books/${bookSlug(book)}`;
}

/** Slug canonique d'une fiche annonce : {id}-{isbn|livre}-{titre-slugifié}. */
export function listingSlug(
  listing: { id: number; isbn_13?: string | null; title?: string | null },
): string {
  const slug = slugifyTitle(listing.title);
  return `${listing.id}-${listing.isbn_13 || "livre"}${slug ? "-" + slug : ""}`;
}
