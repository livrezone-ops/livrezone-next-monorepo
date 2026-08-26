"use client";

import { useEffect, useState } from "react";

/**
 * Renvoie la valeur différée de `value` après `delay` ms sans changement.
 * Évite de déclencher une requête API à chaque frappe dans un champ de recherche.
 */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
