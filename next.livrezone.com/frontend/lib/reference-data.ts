// Référentiels publics alignés sur la base Laravel (tables categories, levels, listings).
// Source : mapping.json du backend API (codes réels).

export interface CategoryRef {
  code: string;
  name: string;
  children?: CategoryRef[];
}

export interface LevelRef {
  code: string;
  name: string;
  cycle: string;
}

export interface CycleGroupRef {
  cycle: string;
  name: string;
  levels: LevelRef[];
}

export interface ConditionRef {
  code: string;
  name: string;
}

export interface LanguageRef {
  id: number;
  code: string;
  name: string;
}

export const CATEGORIES: CategoryRef[] = [
  {
    code: "LITTERATURE",
    name: "Littérature",
    children: [
      { code: "ROMANS", name: "Romans" },
      { code: "POESIE_THEATRE", name: "Poésie et théâtre" },
      { code: "ESSAIS_BIOGRAPHIES", name: "Essais et biographies" },
      { code: "BD", name: "BD" },
      { code: "MANGAS", name: "Mangas" },
    ],
  },
  {
    code: "JEUNESSE",
    name: "Jeunesse",
    children: [
      { code: "PETITE_ENFANCE", name: "Petite enfance" },
      { code: "HISTOIRES_CONTES", name: "Histoires et contes" },
      { code: "PREMIERES_LECTURES", name: "Premières lectures" },
      { code: "ROMANS_JEUNESSE", name: "Romans jeunesse" },
      { code: "ACTIVITES_COLORIAGE", name: "Activités et coloriage" },
    ],
  },
  {
    code: "SCOLAIRE",
    name: "Scolaire",
    children: [
      { code: "MANUELS_SCOLAIRES", name: "Manuels scolaires" },
      { code: "CAHIERS_EXERCICES", name: "Cahiers et exercices" },
      { code: "EXAMENS_CONCOURS", name: "Examens et concours" },
      { code: "MATERIEL_EDUCATIF", name: "Matériel éducatif" },
      { code: "HISTOIRES_EDUCATIVES", name: "Histoires éducatives" },
    ],
  },
  {
    code: "UNIVERSITAIRE",
    name: "Universitaire et professionnel",
    children: [
      { code: "SCIENCES_TECHNO", name: "Sciences et technologie" },
      { code: "U_INFO", name: "Informatique" },
      { code: "MEDECINE_SANTE", name: "Médecine et santé" },
      { code: "ECONOMIE_GESTION", name: "Économie et gestion" },
      { code: "DROIT", name: "Droit" },
      { code: "SCIENCES_HUMAINES", name: "Sciences humaines" },
      { code: "FORMATION_PRO", name: "Formation professionnelle" },
    ],
  },
  {
    code: "RELIGION",
    name: "Religion",
    children: [
      { code: "QURAN", name: "Quran" },
      { code: "HADITH", name: "Hadith" },
      { code: "FIQH", name: "Fiqh" },
      { code: "SIRA", name: "Sira" },
      { code: "SPIRITUALITE", name: "Spiritualité" },
      { code: "R_AUTRES", name: "Autres" },
    ],
  },
  {
    code: "VIE_PRATIQUE",
    name: "Vie pratique et loisirs",
    children: [
      { code: "DEV_PERSO", name: "Développement personnel" },
      { code: "CUISINE_MAISON", name: "Cuisine et maison" },
      { code: "ARTS_CULTURE", name: "Arts et culture" },
      { code: "SPORT_LOISIRS", name: "Sport et loisirs" },
      { code: "VOYAGE", name: "Voyage" },
      { code: "VP_DIVERS", name: "Divers" },
    ],
  },
];

export const LEVELS: LevelRef[] = [
  { code: "PRESCOLAIRE", name: "Préscolaire", cycle: "primaire" },
  { code: "C1", name: "C1", cycle: "primaire" },
  { code: "C2", name: "C2", cycle: "primaire" },
  { code: "C3", name: "C3", cycle: "primaire" },
  { code: "C4", name: "C4", cycle: "primaire" },
  { code: "C5", name: "C5", cycle: "primaire" },
  { code: "C6", name: "C6", cycle: "primaire" },
  { code: "1AC", name: "1AC", cycle: "college" },
  { code: "2AC", name: "2AC", cycle: "college" },
  { code: "3AC", name: "3AC", cycle: "college" },
  { code: "TRONC_COMMUN", name: "Tronc Commun", cycle: "lycee" },
  { code: "1BAC", name: "1re année BAC", cycle: "lycee" },
  { code: "2BAC", name: "2e année BAC", cycle: "lycee" },
  { code: "LICENCE", name: "Supérieur - Licence", cycle: "universitaire" },
  { code: "MASTER", name: "Supérieur - Master", cycle: "universitaire" },
  { code: "DOCTORAT", name: "Supérieur - Doctorat", cycle: "universitaire" },
  { code: "FORMATION_PRO", name: "Formation professionnelle", cycle: "professionnel" },
  { code: "NON_APPLICABLE", name: "Non applicable", cycle: "autre" },
];

export const CONDITIONS: ConditionRef[] = [
  { code: "neuf", name: "Livres neufs" },
  { code: "occas", name: "Livres d'occasion" },
];

export const LANGUAGES: LanguageRef[] = [
  { id: 3, code: "en", name: "Anglais" },
  { id: 1, code: "ar", name: "Arabe" },
  { id: 6, code: "autre", name: "Autre" },
  { id: 5, code: "ber", name: "Berbère / Amazigh" },
  { id: 4, code: "es", name: "Espagnol" },
  { id: 2, code: "fr", name: "Français" },
];

// Codes de la catégorie SCOLAIRE et de ses sous-catégories.
// Le bloc « Niveau » est actif quand une de ces catégories est sélectionnée.
export const SCOLAIRE_SUBTREE: ReadonlySet<string> = new Set([
  "SCOLAIRE",
  "MANUELS_SCOLAIRES",
  "CAHIERS_EXERCICES",
  "EXAMENS_CONCOURS",
  "MATERIEL_EDUCATIF",
  "HISTOIRES_EDUCATIVES",
]);

// Codes de la catégorie UNIVERSITAIRE et de ses sous-catégories.
export const UNIVERSITAIRE_SUBTREE: ReadonlySet<string> = new Set([
  "UNIVERSITAIRE",
  "SCIENCES_TECHNO",
  "U_INFO",
  "MEDECINE_SANTE",
  "ECONOMIE_GESTION",
  "DROIT",
  "SCIENCES_HUMAINES",
  "FORMATION_PRO",
]);

// Libellés des cycles de niveau.
export const CYCLE_LABELS: Record<string, string> = {
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
  universitaire: "Universitaire",
  professionnel: "Professionnel",
};

// Cycles affichés selon la catégorie sélectionnée.
export const SCOLAIRE_CYCLES = ["primaire", "college", "lycee"];
export const UNIVERSITAIRE_CYCLES = ["universitaire", "professionnel"];

export function levelsByCycle(cycles: string[]): CycleGroupRef[] {
  return cycles
    .map((cycle) => ({
      cycle,
      name: CYCLE_LABELS[cycle] ?? cycle,
      levels: LEVELS.filter((l) => l.cycle === cycle),
    }))
    .filter((group) => group.levels.length > 0);
}

export function getCategory(code: string): CategoryRef | undefined {
  if (!code) return undefined;
  for (const cat of CATEGORIES) {
    if (cat.code === code) return cat;
    const child = cat.children?.find((c) => c.code === code);
    if (child) return child;
  }
  return undefined;
}

export function categoryLabel(code: string): string | undefined {
  return getCategory(code)?.name;
}

export function levelLabel(code: string): string | undefined {
  return LEVELS.find((l) => l.code === code)?.name;
}

export function conditionLabel(code: string): string | undefined {
  return CONDITIONS.find((c) => c.code === code)?.name;
}

export function languageLabel(code: string): string | undefined {
  return LANGUAGES.find((l) => l.code === code)?.name;
}