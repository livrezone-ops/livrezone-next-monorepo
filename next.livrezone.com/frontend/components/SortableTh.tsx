"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

interface SortableThProps {
  label: string;
  field: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}

/**
 * En-tête de tableau triable : clic = tri asc, re-clic = desc.
 * L'état (sortBy/sortDir) appartient au parent, qui recharge ses données.
 */
export default function SortableTh({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  className = "",
}: SortableThProps) {
  const active = sortBy === field;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Trier par ${label}`}
        className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer select-none ${
          active ? "text-[#6D28D9]" : "text-gray-500 hover:text-gray-900"
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}
