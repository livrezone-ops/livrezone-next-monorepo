/**
 * Sérialise des données structurées (JSON-LD) de façon sûre pour
 * l'injection dans un <script type="application/ld+json"> :
 * échappe <, >, &, U+2028/U+2029 pour neutraliser toute tentative
 * de fermeture du tag ou d'injection.
 */
export function toJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
