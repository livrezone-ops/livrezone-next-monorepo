// Slug d'auteur aligné sur AuthorCatalogueService::slugify() côté API
// (NFD → suppression des diacritiques → non-alphanumériques en tirets),
// pour que les URLs /books/auteurs/{slug} générées côté front et API coïncident.
export function slugifyAuthor(name: string): string {
  const slug = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "auteur";
}
