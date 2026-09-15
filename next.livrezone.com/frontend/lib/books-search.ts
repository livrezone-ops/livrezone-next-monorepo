// Logique de recherche partagée du catalogue (09/09). Un seul point d'entrée
// pour les trois zones de recherche : BooksHome (vitrine), BooksClient (vue
// /books) et BookThemeSearch (hero des pages /books/themes/{code}).
import api from "@/lib/axios";
import { isbnQuery } from "@/lib/isbn";

/**
 * Match exact d'un ISBN saisi : si `term` est un ISBN valide (13 chiffres
 * préfixés 978/979, ou ISBN-10 converti — voir lib/isbn.ts) présent
 * exactement une fois au catalogue, retourne le livre. Sinon null → la
 * soumission reste une recherche plein-texte (titre + auteur + ISBN).
 */
export async function findExactIsbnBook(term: string): Promise<{ id?: number } | null> {
  const isbn = isbnQuery(term.trim());
  if (!isbn) return null;
  try {
    const { data } = await api.get("/books", {
      params: { field: "isbn", search: isbn, limit: 2 },
    });
    const rows: Array<{ id?: number }> = Array.isArray(data?.data) ? data.data : [];
    return rows.length === 1 && rows[0]?.id ? rows[0] : null;
  } catch {
    // API indisponible → fallback recherche classique
    return null;
  }
}
