/**
 * Domaine public du site (source unique) — piloté par NEXT_PUBLIC_SITE_URL.
 * La valeur est figée au build : la changer = modifier .env.production puis `lz`.
 * Migration next.livrezone.com → livrezone.com : voir
 * api-next.livrezone.com/.agents/MIGRATION-livrezone-com-2026-09-06.md.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://next.livrezone.com";
