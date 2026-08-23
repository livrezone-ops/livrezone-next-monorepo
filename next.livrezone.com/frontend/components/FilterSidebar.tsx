"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, X, SlidersHorizontal, Search } from "lucide-react";
import {
  CATEGORIES,
  LANGUAGES,
  CONDITIONS,
  SCOLAIRE_SUBTREE,
  UNIVERSITAIRE_SUBTREE,
  SCOLAIRE_CYCLES,
  UNIVERSITAIRE_CYCLES,
  levelsByCycle,
  type CategoryRef,
} from "@/lib/reference-data";
import {
  parseFilters,
  buildFilterQuery,
} from "@/lib/listings-filters";
import type { CityRef } from "@/lib/listings-api";

const scolaires = [...SCOLAIRE_SUBTREE];
const universitaires = [...UNIVERSITAIRE_SUBTREE];

// CSS nécessaires au double slider (thumb cliquable malgré pointer-events:none du parent).
const dualSliderCss = `
  .dual-slider-input::-webkit-slider-thumb {
    pointer-events: auto;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #F97316;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: pointer;
  }
  .dual-slider-input::-moz-range-thumb {
    pointer-events: auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #F97316;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: pointer;
  }
`;

export type FilterSection =
  | "categories"
  | "levels"
  | "languages"
  | "conditions"
  | "cities"
  | "price";

const DEFAULT_SECTIONS: FilterSection[] = [
  "categories",
  "levels",
  "languages",
  "conditions",
  "cities",
  "price",
];

interface FilterSidebarProps {
  priceMinLimit?: number;
  priceMaxLimit?: number;
  cities?: CityRef[];
  showCity?: boolean;
  sections?: FilterSection[];
  basePath?: string;
  facets?: {
    categories?: Record<string, number>;
    languages?: Record<string, number>;
    conditions?: Record<string, number>;
    levels?: Record<string, number>;
    cities?: Record<string, number>;
  };
}

interface Draft {
  categories: string[];
  levels: string[];
  languages: string[];
  conditions: string[];
  cities: number[];
  minPrice: number;
  maxPrice: number;
}

export default function FilterSidebar({
  priceMinLimit = 0,
  priceMaxLimit = 500,
  cities = [],
  showCity = true,
  sections = DEFAULT_SECTIONS,
  basePath,
  facets,
}: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const targetPath = basePath || pathname;
  const isSectionVisible = (section: FilterSection) => sections.includes(section);

  const filters = useMemo(
    () => parseFilters((key) => searchParams.get(key)),
    [searchParams]
  );

  const initialDraft: () => Draft = () => ({
    categories: [...filters.categories],
    levels: [...filters.levels],
    languages: [...filters.languages],
    conditions: [...filters.conditions],
    cities: [...filters.cities],
    minPrice: filters.minPrice ?? priceMinLimit,
    maxPrice: filters.maxPrice ?? priceMaxLimit,
  });

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(draft.categories)
  );
  const [openCycles, setOpenCycles] = useState<Set<string>>(new Set());
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  const sortedLanguages = useMemo(() => {
    return [...LANGUAGES].map(lang => ({
      ...lang,
      count: facets?.languages?.[lang.code] || 0
    })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.code.localeCompare(b.code);
    });
  }, [facets?.languages]);

  const conditionsWithCount = useMemo(() => {
    return CONDITIONS.map(cond => ({
      ...cond,
      count: facets?.conditions?.[cond.code] || 0
    }));
  }, [facets?.conditions]);

  const sortedCities = useMemo(() => {
    return [...cities].map(city => ({
      ...city,
      count: facets?.cities?.[city.id.toString()] || 0
    }))
    .filter((city) => city.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id - b.id;
    });
  }, [cities, facets?.cities]);

  const filteredCities = citySearch.trim()
    ? sortedCities.filter((c) =>
        c.name.toLowerCase().includes(citySearch.toLowerCase())
      )
    : sortedCities;

  // Ferme le menu déroulant Ville au clic extérieur.
  useEffect(() => {
    if (!cityDropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(e.target as Node)
      ) {
        setCityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [cityDropdownOpen]);

  // Synchronise les brouillons si l'URL change hors soumission locale (ex: liens header).
  const filterKey = JSON.stringify([
    filters.categories,
    filters.levels,
    filters.languages,
    filters.conditions,
    filters.cities,
    filters.minPrice,
    filters.maxPrice,
  ]);
  const lastFilterKey = useRef(filterKey);
  const submitting = useRef(false);

  useEffect(() => {
    if (submitting.current) {
      submitting.current = false;
      lastFilterKey.current = filterKey;
      return;
    }
    if (filterKey !== lastFilterKey.current) {
      lastFilterKey.current = filterKey;
      setDraft(initialDraft());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const toggleSection = (name: string) => {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const applyFilters = () => {
    submitting.current = true;
    const params = buildFilterQuery({
      categories: isSectionVisible("categories") ? draft.categories : [],
      levels: isSectionVisible("levels") ? draft.levels : [],
      languages: isSectionVisible("languages") ? draft.languages : [],
      conditions: isSectionVisible("conditions") ? draft.conditions : [],
      cities: isSectionVisible("cities") ? draft.cities : [],
      minPrice: isSectionVisible("price") ? draft.minPrice : undefined,
      maxPrice: isSectionVisible("price") ? draft.maxPrice : undefined,
      minLimit: priceMinLimit,
      maxLimit: priceMaxLimit,
      search: filters.search,
      sort: filters.sort,
    });
    const qs = params.toString();
    router.push(qs ? `${targetPath}?${qs}` : targetPath, { scroll: false });
    setOpen(false);
  };

  const clearFilters = () => {
    submitting.current = true;
    // Réinitialise aussi les brouillons (dont la barre de prix).
    setDraft({
      categories: [],
      levels: [],
      languages: [],
      conditions: [],
      cities: [],
      minPrice: priceMinLimit,
      maxPrice: priceMaxLimit,
    });
    setOpenCycles(new Set());
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    const qs = params.toString();
    router.push(qs ? `${targetPath}?${qs}` : targetPath, { scroll: false });
    setOpen(false);
  };

  const toggleValue = (
    key: "categories" | "levels" | "languages" | "conditions",
    value: string,
    expandCategory?: string
  ) => {
    setDraft((prev) => {
      if (key === "conditions" && !CONDITIONS.some((c) => c.code === value)) {
        return prev;
      }
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
    if (key === "categories" && expandCategory && !draft.categories.includes(expandCategory)) {
      setExpandedCategories((prev) => new Set(prev).add(expandCategory));
    }
  };

  const toggleCity = (id: number) => {
    setDraft((prev) => ({
      ...prev,
      cities: prev.cities.includes(id)
        ? prev.cities.filter((v) => v !== id)
        : [...prev.cities, id],
    }));
  };

  // Le bloc Niveau s'affiche au démarrage (aucune catégorie sélectionnée) et dès
  // qu'une catégorie scolaire OU universitaire/professionnelle est cochée.
  // Les cycles affichés dépendent de la catégorie sélectionnée.
  const niveauRelevant =
    draft.categories.length === 0 ||
    draft.categories.some(
      (c) => scolaires.includes(c) || universitaires.includes(c)
    );
  const universitaireMode = draft.categories.some((c) =>
    universitaires.includes(c)
  );
  // Au démarrage (aucune catégorie) on affiche tous les cycles.
  // Sinon, on restreint au mode scolaire ou universitaire/professionnel.
  const niveauCycles =
    draft.categories.length === 0
      ? [...SCOLAIRE_CYCLES, ...UNIVERSITAIRE_CYCLES]
      : universitaireMode
        ? UNIVERSITAIRE_CYCLES
        : SCOLAIRE_CYCLES;
  const cycleGroups = levelsByCycle(niveauCycles);

  const minPercent =
    priceMaxLimit === priceMinLimit
      ? 0
      : ((draft.minPrice - priceMinLimit) / (priceMaxLimit - priceMinLimit)) * 100;
  const maxPercent =
    priceMaxLimit === priceMinLimit
      ? 100
      : ((draft.maxPrice - priceMinLimit) / (priceMaxLimit - priceMinLimit)) * 100;

  const updateMin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDraft((prev) => ({ ...prev, minPrice: Math.min(val, prev.maxPrice) }));
  };
  const updateMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setDraft((prev) => ({ ...prev, maxPrice: Math.max(val, prev.minPrice) }));
  };


  const getFacetCount = (n: CategoryRef): number => {
    let count = facets?.categories?.[n.code] || 0;
    if (n.children) {
      for (const child of n.children) {
        count += getFacetCount(child);
      }
    }
    return count;
  };

  const renderCategoryNode = (nodes: CategoryRef[], level: number) => (
    <div
      className={level === 0 ? "space-y-2.5" : "ml-4 mt-2 border-l border-gray-100 pl-3 space-y-2"}
    >
      {nodes.map((node) => {
        const hasChildren = !!node.children && node.children.length > 0;
        const isExpanded = expandedCategories.has(node.code);
        const isChecked = draft.categories.includes(node.code);
        const count = getFacetCount(node);

        const handleCategoryCheck = () => {
          if (!hasChildren) return;
          setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(node.code)) next.delete(node.code);
            else next.add(node.code);
            return next;
          });
        };

        return (
          <div key={node.code} className="group">
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleValue("categories", node.code, node.code)}
                  className="w-4 h-4 rounded-sm border-gray-300 text-[#F97316] focus:ring-[#F97316] mr-3"
                />
                <span
                  className={`text-[15px] ${
                    level === 0
                      ? "font-semibold text-gray-800"
                      : "text-gray-600"
                  } group-hover:text-black transition-colors`}
                >
                  {node.name}
                  {count > 0 && (
                    <span className="ml-1.5 text-[11px] text-gray-400 font-semibold">
                      ({count})
                    </span>
                  )}
                </span>
              </label>
              {hasChildren && (
                <button
                  type="button"
                  onClick={handleCategoryCheck}
                  className="p-1 text-gray-400 hover:text-black"
                  aria-label={`Déplier ${node.name}`}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>
            {hasChildren && isChecked && (
              <div className="mt-2">
                {renderCategoryNode(node.children!, level + 1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const activeCount = useMemo(() => {
    let count = 0;
    if (isSectionVisible("categories")) count += filters.categories.length;
    if (isSectionVisible("levels")) count += filters.levels.length;
    if (isSectionVisible("languages")) count += filters.languages.length;
    if (isSectionVisible("conditions")) count += filters.conditions.length;
    if (isSectionVisible("cities")) count += filters.cities.length;
    if (isSectionVisible("price")) {
      if (filters.minPrice !== null && filters.minPrice > priceMinLimit) count += 1;
      if (filters.maxPrice !== null && filters.maxPrice < priceMaxLimit) count += 1;
    }
    return count;
  }, [filters, priceMinLimit, priceMaxLimit, sections]);

  return (
    <>
      {/* Bouton toggle mobile explicite avec icône et libellé */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-1/3 left-0 z-40 bg-[#1a0a40] text-white py-2.5 px-3 rounded-r-xl shadow-2xl border-y border-r border-[#6D28D9]/40 flex items-center gap-2 hover:bg-[#6D28D9] active:scale-95 transition-all cursor-pointer group"
        aria-label="Ouvrir les filtres"
      >
        <SlidersHorizontal className="h-4 w-4 text-violet-300 group-hover:text-white transition-colors" />
        <span className="text-xs font-bold tracking-wide">Filtres</span>
        {activeCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 bg-[#F97316] text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-white overflow-y-auto transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:z-0 lg:w-[240px] lg:flex-shrink-0 lg:translate-x-0 lg:shadow-none shadow-2xl`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 lg:hidden bg-gray-50">
          <span className="font-bold text-[18px] text-black">Filtres</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-black"
            aria-label="Fermer les filtres"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
          className="p-5 lg:p-0"
        >
          <h2 className="text-[20px] font-bold text-[#1a0a40] mb-4">
            Filtres
          </h2>

          <div className="mb-6 pb-4 border-b border-gray-100 flex gap-3">
            <button
              type="submit"
              className="w-full bg-[#1a0a40] text-white py-2 rounded-md font-bold hover:bg-[#2d1b5e] transition-colors text-sm"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-md font-bold hover:bg-gray-200 transition-colors text-sm"
            >
              Effacer
            </button>
          </div>

          {/* Catégories */}
          {isSectionVisible("categories") && (
            <div className="border-b border-gray-100 py-5">
              <SectionToggle
                open={!!openSections.categories}
                onToggle={() => toggleSection("categories")}
                title="Catégories"
              />
              {openSections.categories && (
                <div className="mt-4">{renderCategoryNode(CATEGORIES, 0)}</div>
              )}
            </div>
          )}

          {/* Langues */}
          {isSectionVisible("languages") && (
            <div className="border-b border-gray-100 py-5">
              <SectionToggle
                open={!!openSections.languages}
                onToggle={() => toggleSection("languages")}
                title="Langues"
              />
              {openSections.languages && (
                <div className="mt-4 space-y-3">
                  {sortedLanguages.map((lang) => (
                    <label
                      key={lang.code}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={draft.languages.includes(lang.code)}
                          onChange={() => toggleValue("languages", lang.code)}
                          className="w-4 h-4 rounded-sm border-gray-300 text-[#F97316] focus:ring-[#F97316] mr-3"
                        />
                        <span className="text-[15px] text-gray-700 group-hover:text-black transition-colors">
                          {lang.name}
                          {lang.count > 0 && (
                            <span className="ml-1.5 text-[11px] text-gray-400 font-semibold">
                              ({lang.count})
                            </span>
                          )}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Niveau, classé par cycle (visible si scolaire/universitaire sélectionné ou au démarrage) */}
          {isSectionVisible("levels") && niveauRelevant && (
            <div className="border-b border-gray-100 py-5">
              <SectionToggle
                open={!!openSections.levels}
                onToggle={() => toggleSection("levels")}
                title="Niveau"
              />
              {openSections.levels && (
                <div className="mt-4 space-y-2">
                  {cycleGroups.map((group) => {
                    const groupChecked =
                      group.levels.length > 0 &&
                      group.levels.every((l) => draft.levels.includes(l.code));
                    const isExpanded = openCycles.has(group.cycle);

                    // Cocher le cycle sélectionne/désélectionne tous ses niveaux.
                    const toggleGroup = () => {
                      const next = new Set(draft.levels);
                      if (groupChecked) {
                        group.levels.forEach((l) => next.delete(l.code));
                      } else {
                        group.levels.forEach((l) => next.add(l.code));
                      }
                      setDraft((prev) => ({ ...prev, levels: [...next] }));
                      setOpenCycles((prev) => new Set(prev).add(group.cycle));
                    };

                    return (
                      <div key={group.cycle} className="group">
                        <div className="flex items-center">
                          <label className="flex items-center cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={groupChecked}
                              onChange={toggleGroup}
                              className="w-4 h-4 rounded-sm border-gray-300 text-[#F97316] focus:ring-[#F97316] mr-3"
                            />
                            <span className="font-semibold text-gray-800 text-[15px]">
                              {group.name}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenCycles((prev) => {
                                const next = new Set(prev);
                                if (next.has(group.cycle)) next.delete(group.cycle);
                                else next.add(group.cycle);
                                return next;
                              })
                            }
                            className="p-1 text-gray-400 hover:text-black"
                            aria-label={`Déplier ${group.name}`}
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="ml-4 mt-2 border-l border-gray-100 pl-3 space-y-3">
                            {group.levels.map((level) => {
                              const lvlCount = facets?.levels?.[level.code] || 0;
                              return (
                              <label
                                key={level.code}
                                className="flex items-center justify-between cursor-pointer group"
                              >
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={draft.levels.includes(level.code)}
                                    onChange={() => toggleValue("levels", level.code)}
                                    className="w-4 h-4 rounded-sm border-gray-300 text-[#F97316] focus:ring-[#F97316] mr-3"
                                  />
                                  <span className="text-[15px] text-gray-600 group-hover:text-black transition-colors">
                                    {level.name}
                                    {lvlCount > 0 && (
                                      <span className="ml-1.5 text-[11px] text-gray-400 font-semibold">
                                        ({lvlCount})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* État du livre */}
          {isSectionVisible("conditions") && (
            <div className="border-b border-gray-100 py-5">
              <SectionToggle
                open={!!openSections.conditions}
                onToggle={() => toggleSection("conditions")}
                title={basePath === "/librairies" ? "Type d'activité" : "État du livre"}
              />
              {openSections.conditions && (
                <div className="mt-4 space-y-3">
                  {conditionsWithCount.map((cond) => (
                    <label
                      key={cond.code}
                      className="flex items-center cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={draft.conditions.includes(cond.code)}
                        onChange={() => toggleValue("conditions", cond.code)}
                        className="w-4 h-4 rounded-sm border-gray-300 text-[#F97316] focus:ring-[#F97316] mr-3"
                      />
                      <span className="text-[15px] text-gray-700 group-hover:text-black transition-colors">
                        {cond.name}
                        {cond.count > 0 && (
                          <span className="ml-1.5 text-[11px] text-gray-400 font-semibold">
                            ({cond.count})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ville (menu déroulant multi-sélection avec recherche) */}
          {isSectionVisible("cities") && showCity && cities.length > 0 && (
            <div
              ref={cityDropdownRef}
              className="relative border-b border-gray-100 py-5"
            >
              <button
                type="button"
                onClick={() => setCityDropdownOpen((v) => !v)}
                className="flex items-center justify-between w-full text-[18px] font-bold text-black focus:outline-none cursor-pointer"
              >
                <span>Ville</span>
                <span className="flex items-center gap-2">
                  {draft.cities.length > 0 && (
                    <span className="text-[11px] font-bold text-white bg-[#F97316] rounded-full px-2 py-0.5">
                      {draft.cities.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform ${
                      cityDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>

              {draft.cities.length > 0 && (
                <p className="mt-2 text-[12px] text-gray-500 leading-snug">
                  {draft.cities
                    .map((id) => cities.find((c) => c.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              {cityDropdownOpen && (
                <div className="mt-3 border border-gray-100 rounded-lg shadow-lg bg-white overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Chercher une ville..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-[#F97316]"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-3 space-y-2">
                    {filteredCities.map((city) => (
                      <label
                        key={city.id}
                        className="flex items-center cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={draft.cities.includes(city.id)}
                          onChange={() => toggleCity(city.id)}
                          className="w-4 h-4 rounded-sm border-gray-300 text-[#F97316] focus:ring-[#F97316] mr-3 cursor-pointer"
                        />
                        <span className="text-[15px] text-gray-700 group-hover:text-black transition-colors">
                          {city.name}
                          {city.count > 0 && (
                            <span className="ml-1.5 text-[11px] text-gray-400 font-semibold">
                              ({city.count})
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                    {filteredCities.length === 0 && (
                      <div className="text-center text-gray-400 text-xs py-3">
                        Aucune ville trouvée.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prix */}
          {isSectionVisible("price") && (
            <div className="py-5">
              <SectionToggle
                open={!!openSections.price}
                onToggle={() => toggleSection("price")}
                title="Prix"
              />
              {openSections.price && (
                <div className="mt-8 mb-2">
                  <style>{dualSliderCss}</style>
                  <div className="relative w-full h-1.5 bg-gray-200 rounded-full mb-6">
                    <div
                      className="absolute h-1.5 bg-[#F97316] rounded-full"
                      style={{
                        left: `${minPercent}%`,
                        right: `${100 - maxPercent}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={priceMinLimit}
                      max={priceMaxLimit}
                      step={1}
                      value={draft.minPrice}
                      onChange={updateMin}
                      className="dual-slider-input absolute w-full -top-[5px] h-0 appearance-none pointer-events-none bg-transparent outline-none"
                    />
                    <input
                      type="range"
                      min={priceMinLimit}
                      max={priceMaxLimit}
                      step={1}
                      value={draft.maxPrice}
                      onChange={updateMax}
                      className="dual-slider-input absolute w-full -top-[5px] h-0 appearance-none pointer-events-none bg-transparent outline-none"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[15px] font-medium text-black">
                    <span>{draft.minPrice} MAD</span>
                    <span>{draft.maxPrice} MAD</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
            <button
              type="submit"
              className="w-full bg-[#1a0a40] text-white py-3 rounded-md font-bold hover:bg-[#2d1b5e] transition-colors"
            >
              Appliquer les filtres
            </button>
          </div>
        </form>
      </aside>

      {/* Backdrop mobile */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        />
      )}
    </>
  );
}

function SectionToggle({
  open,
  onToggle,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-[18px] font-bold text-black focus:outline-none"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && children}
    </>
  );
}