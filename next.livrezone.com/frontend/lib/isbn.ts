// Détection/normalisation d'un ISBN saisi dans la recherche du catalogue (09/09).
// `isbnQuery` retourne l'ISBN-13 normalisé (13 chiffres, checksum valide) si la
// saisie ressemble à un ISBN (13 chiffres préfixés 978/979, ou ISBN-10 valide
// converti en 13), sinon null → la soumission reste une recherche plein-texte.

function isbn13Checksum(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isbnQuery(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]/g, "").toUpperCase();

  // ISBN-13 : 13 chiffres, préfixe GS1 livre (978/979), chiffre de contrôle valide.
  if (/^\d{13}$/.test(cleaned)) {
    if (!cleaned.startsWith("978") && !cleaned.startsWith("979")) return null;
    return Number(cleaned[12]) === isbn13Checksum(cleaned) ? cleaned : null;
  }

  // ISBN-10 : 9 chiffres + chiffre ou X (checksum base 11) → conversion ISBN-13.
  if (/^\d{9}[\dX]$/.test(cleaned)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(cleaned[i]) * (10 - i);
    const check = cleaned[9] === "X" ? 10 : Number(cleaned[9]);
    if ((sum + check) % 11 !== 0) return null;
    const core = "978" + cleaned.slice(0, 9);
    return core + String(isbn13Checksum(core));
  }

  return null;
}
