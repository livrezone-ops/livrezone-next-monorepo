"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Loader2, Search } from "lucide-react";

// Types pour les données de référence
interface CategoryNode {
  id: number;
  name: string;
  name_fr: string;
  slug: string;
  children?: CategoryNode[];
  levels?: Level[];
  subjects?: Subject[];
}

interface Language {
  id: number;
  name_fr: string;
  code: string;
}

interface Level {
  id: number;
  name_fr: string;
  code: string;
  subjects?: Subject[];
}

interface Subject {
  id: number;
  name_fr: string;
  code: string;
}

interface ReferenceData {
  categories: CategoryNode[];
  languages: Language[];
  levels: Level[];
}

interface RawCategory {
  id: number;
  name?: string;
  name_fr?: string;
  slug?: string;
  children?: RawCategory[];
  levels?: Level[];
  subjects?: Subject[];
}

// Schéma de validation Zod
const formSchema = z.object({
  title: z.string().min(3, "Le titre doit faire au moins 3 caractères"),
  author: z.string().max(255).optional().nullable(),
  publisher: z.string().max(255).optional().nullable(),
  description: z.string().optional(),
  book_condition: z.enum(["neuf", "occas"], { message: "Sélectionnez un état" }),
  price: z.number({ message: "Le prix est requis" }).min(0, "Le prix doit être positif"),
  discount_price: z.number().min(0, "Le prix réduit doit être positif").optional().nullable(),
  quantity: z.number({ message: "La quantité est requise" }).int().min(1, "La quantité minimale est 1"),
  category_id: z.number({ message: "Sélectionnez une catégorie" }).min(1),
  level_id: z.number().optional().nullable(),
  subject_id: z.number().optional().nullable(),
  language_id: z.number().optional().nullable(),
  isbn_13: z.string().max(20).optional().nullable(),
}).refine((data) => {
  if (data.discount_price !== null && data.discount_price !== undefined) {
    return data.discount_price < data.price;
  }
  return true;
}, {
  message: "Le prix réduit doit être inférieur au prix normal",
  path: ["discount_price"],
});

type FormValues = z.infer<typeof formSchema>;

export interface ListingFormProps {
  initialData?: FormValues & { id?: number, cover_path?: string, cover_source_url?: string, cover_url?: string, cover_thumbnail_url?: string };
  onSubmitSuccess: () => void;
  isEditMode?: boolean;
  onError?: (message: string) => void;
}

// Construit les valeurs initiales du formulaire depuis initialData (fonction pure).
const buildListingDefaultValues = (data?: ListingFormProps["initialData"]): Partial<FormValues> => ({
  title: data?.title || "",
  author: data?.author || "",
  publisher: data?.publisher || "",
  description: data?.description || "",
  book_condition: data?.book_condition || "occas",
  price: data?.price ?? undefined,
  discount_price: data?.discount_price ?? null,
  quantity: data?.quantity ?? 1,
  category_id: data?.category_id || undefined,
  level_id: data?.level_id ?? null,
  subject_id: data?.subject_id ?? null,
  language_id: data?.language_id ?? null,
  isbn_13: data?.isbn_13 || "",
});

// Retrouve un nœud de catégorie (feuille incluse) dans l'arbre (fonction pure).
const findCategoryNode = (cats: CategoryNode[] | undefined, id: number | undefined): CategoryNode | null => {
  if (!id) return null;
  for (const c of cats || []) {
    if (c.id === id) return c;
    if (c.children) {
      const f = findCategoryNode(c.children, id);
      if (f) return f;
    }
  }
  return null;
};

// Retourne le chemin [L1, L2, L3] jusqu'à la catégorie (fonction pure).
const getCategoryPath = (cats: CategoryNode[] | undefined, id: number | undefined): CategoryNode[] => {
  if (!id) return [];
  for (const c of cats || []) {
    if (c.id === id) return [c];
    if (c.children) {
      const sub = getCategoryPath(c.children, id);
      if (sub.length) return [c, ...sub];
    }
  }
  return [];
};

// Résout les règles niveau/matière d'une catégorie (fonction pure, sans effet de bord).
const getCategoryRules = (cats: CategoryNode[] | undefined, categoryId: number | undefined) => {
  const category = findCategoryNode(cats, categoryId);
  const levels = category?.levels || [];
  const subjects = category?.subjects || [];
  const naLevel = levels.find((l) => l.code === "NON_APPLICABLE");
  const naSubject = subjects.find((s) => s.code === "NON_APPLICABLE");
  const levelApplicable = !(levels.length === 0 || (levels.length === 1 && !!naLevel));
  const subjectApplicable = !(subjects.length === 0 || (subjects.length === 1 && !!naSubject));
  return { category, levels, subjects, naLevel, naSubject, levelApplicable, subjectApplicable };
};

export default function ListingForm({ initialData, onSubmitSuccess, isEditMode = false, onError }: ListingFormProps) {
  const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'https://api-next.livrezone.com/api').replace(/\/api\/?$/, '');
  const resolveCoverUrl = (path?: string) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_ORIGIN}/${path.replace(/^\//, '')}`;
  };

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initialData?.cover_url || initialData?.cover_source_url || null
  );
  const [coverSourceUrl, setCoverSourceUrl] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recherche ISBN
  const [isbnInput, setIsbnInput] = useState(initialData?.isbn_13 || "");
  const [isSearchingIsbn, setIsSearchingIsbn] = useState(false);
  const [isbnSearchError, setIsbnSearchError] = useState<string | null>(null);

  // Pourcentage de réduction
  const [discountPercent, setDiscountPercent] = useState<string>(() => {
    const p = initialData?.price;
    const dp = initialData?.discount_price;
    if (p && dp && p > 0 && dp > 0 && dp < p) {
      return Math.round((1 - dp / p) * 100).toString();
    }
    return "";
  });

  // Fetch reference data
  const { data: refData, isLoading: isLoadingRef } = useQuery<ReferenceData>({
    queryKey: ["reference-data"],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await api.get("/reference-data");
      // Mappage de name à name_fr pour s'adapter au backend
      const formatCategories = (cats: RawCategory[]): CategoryNode[] => {
        return cats.map(c => {
          const nameFr = c.name || c.name_fr || "";
          return {
            id: c.id,
            name: nameFr,
            name_fr: nameFr,
            slug: c.slug || "",
            levels: c.levels || [],
            subjects: c.subjects || [],
            children: c.children ? formatCategories(c.children) : []
          };
        });
      };
      return {
        ...res.data,
        categories: formatCategories(res.data.categories || [])
      };
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildListingDefaultValues(initialData),
  });

  // Source de vérité : catégorie sélectionnée observée via React Hook Form.
  const selectedCategoryId = useWatch({ control: form.control, name: "category_id" });

  // Initialisation unique : normalise niveau/matière et applique les valeurs initiales.
  const initKey = isEditMode && initialData?.id ? String(initialData.id) : "create";
  useEffect(() => {
    if (!refData) return;
    const initial = buildListingDefaultValues(initialData);
    setIsbnInput(initial.isbn_13 || "");
    const r = getCategoryRules(refData.categories, initial.category_id);
    if (r.category) {
      if (!r.levelApplicable) {
        initial.level_id = r.naLevel?.id ?? null;
      } else if (initial.level_id && !r.levels.some((l) => l.id === initial.level_id)) {
        initial.level_id = null;
      }
      if (!r.subjectApplicable) {
        initial.subject_id = r.naSubject?.id ?? null;
      } else if (initial.subject_id && !r.subjects.some((s) => s.id === initial.subject_id)) {
        initial.subject_id = null;
      }
    }
    form.reset(initial);
    // Dépend de refData (stable) et de initKey (id du listing) uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refData, initKey]);

  // --- Règles dérivées de la catégorie sélectionnée (aucun effet de bord) ---
  const selectedCategoryPath = useMemo(
    () => getCategoryPath(refData?.categories, selectedCategoryId),
    [refData, selectedCategoryId]
  );
  const rules = useMemo(
    () => getCategoryRules(refData?.categories, selectedCategoryId),
    [refData, selectedCategoryId]
  );

  const allowedLevels = rules.levels;
  const allowedSubjects = rules.subjects;
  const naLevel = rules.naLevel;
  const naSubject = rules.naSubject;
  const levelIsNA = !rules.levelApplicable;
  const subjectIsNA = !rules.subjectApplicable;
  const levelOptions = levelIsNA ? (naLevel ? [naLevel] : []) : allowedLevels;
  const subjectOptions = subjectIsNA ? (naSubject ? [naSubject] : []) : allowedSubjects;

  // Parent immédiat de la catégorie feuille (pour la validation backend)
  const parentCategoryId = selectedCategoryPath[selectedCategoryPath.length - 2]?.id;

  // Handler explicite : met à jour la catégorie ET réconcilie niveau/matière.
  const handleCategoryChange = (newCategoryId: number | "") => {
    const val = typeof newCategoryId === "number" && newCategoryId > 0 ? newCategoryId : undefined;
    const current = form.getValues();
    let nextLevel = current.level_id ?? null;
    let nextSubject = current.subject_id ?? null;

    if (val !== undefined) {
      const r = getCategoryRules(refData?.categories, val);
      if (!r.levelApplicable) {
        nextLevel = r.naLevel?.id ?? null;
      } else if (nextLevel && !r.levels.some((l) => l.id === nextLevel)) {
        nextLevel = null;
      }
      if (!r.subjectApplicable) {
        nextSubject = r.naSubject?.id ?? null;
      } else if (nextSubject && !r.subjects.some((s) => s.id === nextSubject)) {
        nextSubject = null;
      }
    } else {
      nextLevel = null;
      nextSubject = null;
    }

    form.setValue("category_id", val as number, { shouldDirty: true, shouldValidate: true });
    form.setValue("level_id", nextLevel, { shouldDirty: true });
    form.setValue("subject_id", nextSubject, { shouldDirty: true });
  };

  // Fonction de recherche ISBN
  const searchIsbn = async () => {
    const term = isbnInput.trim() || form.getValues("isbn_13")?.trim();
    if (!term) return;
    setIsSearchingIsbn(true);
    setIsbnSearchError(null);
    try {
      const res = await api.get(`/books/search?isbn=${term}`);
      const book = res.data.book;
      if (book) {
        form.setValue("title", book.title);
        const foundIsbn = book.isbn_13 || book.isbn_10 || term;
        form.setValue("isbn_13", foundIsbn);
        setIsbnInput(foundIsbn);
        if (Array.isArray(book.authors) && book.authors.length) {
          form.setValue("author", book.authors.join(", "));
        }
        if (book.publisher) form.setValue("publisher", book.publisher);
        if (book.description) form.setValue("description", book.description);
        if (book.indicative_price) {
          form.setValue("price", parseFloat(book.indicative_price));
        }
        const catId = book.default_category_id || book.category_id;
        if (catId) {
          handleCategoryChange(catId);
        }
        if (book.language_id) form.setValue("language_id", book.language_id);
        if (book.default_level_id || book.level_id) form.setValue("level_id", book.default_level_id || book.level_id);
        if (book.default_subject_id || book.subject_id) form.setValue("subject_id", book.default_subject_id || book.subject_id);

        if (book.cover_url) {
          setCoverPreview(book.cover_url);
          setCoverSourceUrl(book.cover_url);
        } else if (book.cover_path) {
          const url = resolveCoverUrl(book.cover_path);
          setCoverPreview(url);
          setCoverSourceUrl(url);
        }
      }
    } catch {
      setIsbnSearchError("Aucun livre trouvé pour cet ISBN. Vous pouvez remplir les champs manuellement ci-dessous.");
    } finally {
      setIsSearchingIsbn(false);
    }
  };

  const handleIsbnInputChange = (val: string) => {
    setIsbnInput(val);
    form.setValue("isbn_13", val);
    if (isbnSearchError) setIsbnSearchError(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Calcul automatique du prix réduit via pourcentage
  const handleDiscountPercentChange = (val: string) => {
    setDiscountPercent(val);
    const pct = parseFloat(val);
    const p = form.getValues("price");
    if (!isNaN(pct) && pct > 0 && p && p > 0) {
      const discount = Math.round(p * (1 - pct / 100) * 100) / 100;
      form.setValue("discount_price", discount);
    } else {
      form.setValue("discount_price", null);
    }
  };

  // Calcul automatique du pourcentage quand le prix réduit est saisi manuellement
  const handleDiscountPriceChange = (val: number | null) => {
    if (val === null || isNaN(val) || val < 0) {
      form.setValue("discount_price", null);
      setDiscountPercent("");
      return;
    }
    const p = form.getValues("price");
    form.setValue("discount_price", val);
    if (p && p > 0) {
      if (val === 0) {
        setDiscountPercent("");
      } else {
        const pct = Math.round((1 - val / p) * 100);
        setDiscountPercent(Math.min(99, Math.max(0, pct)).toString());
      }
    }
  };

  const handlePriceChange = (val: number) => {
    form.setValue("price", val);
    const pct = parseFloat(discountPercent);
    if (!isNaN(pct) && pct > 0 && val > 0) {
      const discount = Math.round(val * (1 - pct / 100) * 100) / 100;
      form.setValue("discount_price", discount);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);

      const formData = new FormData();
      Object.keys(values).forEach(key => {
        const val = values[key as keyof FormValues];
        if (val !== null && val !== undefined && val !== "") {
          formData.append(key, val.toString());
        }
      });

      // La catégorie parente pour la validation de la sous-catégorie côté serveur
      if (typeof parentCategoryId === "number") {
        formData.append("parent_category_id", parentCategoryId.toString());
      }

      if (coverFile) {
        formData.append("cover_image", coverFile);
      } else if (coverSourceUrl) {
        formData.append("cover_source_url", coverSourceUrl);
      }
      
      if (isEditMode && initialData?.id) {
        formData.append("_method", "PUT"); // Fake PUT for file upload
        await api.post(`/dashboard/listings/${initialData.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        await api.post(`/dashboard/listings`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      onSubmitSuccess();
    } catch (err: unknown) {
      console.error(err);
      const axiosErr = err as { response?: { data?: { message?: string } } } | undefined;
      const message = axiosErr?.response?.data?.message || "Une erreur est survenue lors de l'enregistrement.";
      if (onError) onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingRef) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
        <span className="ml-2 text-slate-600 font-medium">Chargement des données...</span>
      </div>
    );
  }

  // Listes dérivées de la hiérarchie pour les dropdowns (chemin de la catégorie sélectionnée)
  const l1Categories = refData?.categories || [];
  const l2Categories = selectedCategoryPath[0]?.children || [];
  const l3Categories = selectedCategoryPath[1]?.children || [];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Formulaire d'annonce */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Colonne gauche : couverture */}
        <div className="lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sticky top-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Couverture</h2>

                {/* Aperçu */}
                <div className="relative w-full pb-[135%] rounded-lg overflow-hidden bg-slate-50 mb-4 border border-slate-200">
                    {coverPreview ? (
                        <img src={coverPreview}
                             alt="Aperçu"
                             className="absolute inset-0 h-full w-full object-contain p-4" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                            <svg className="w-12 h-12 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span className="text-xs">Pas de couverture</span>
                        </div>
                    )}
                </div>

                {/* Champ upload */}
                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Importer une couverture</span>
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleImageChange}
                        className="block w-full text-xs text-slate-500
                               file:mr-3 file:py-2 file:px-3
                               file:rounded-lg file:border-0
                               file:text-xs file:font-semibold
                               file:bg-violet-50 file:text-violet-700
                               hover:file:bg-violet-100 cursor-pointer"
                    />
                    <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP — max 4 Mo. Converti automatiquement en WebP.</p>
                </label>
            </div>
        </div>

        {/* Colonne droite : champs */}
        <div className="lg:col-span-8 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">

                {/* Recherche ISBN */}
                <div className="rounded-lg bg-slate-50/80 border border-slate-200/80 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Recherche par ISBN
                        </label>
                        <span className="text-[11px] text-slate-500">Pré-remplir les informations</span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={isbnInput}
                            onChange={(e) => handleIsbnInputChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    searchIsbn();
                                }
                            }}
                            placeholder="Ex: 9782294788222"
                            className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
                        />
                        <button
                            type="button"
                            onClick={searchIsbn}
                            disabled={isSearchingIsbn || !isbnInput.trim()}
                            className="h-9 px-3 rounded-lg bg-[#F97316] hover:bg-[#ea630a] text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                        >
                            {isSearchingIsbn ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <>
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Rechercher</span>
                                </>
                            )}
                        </button>
                    </div>
                    {isbnSearchError && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                            {isbnSearchError}
                        </div>
                    )}
                </div>

                {/* Titre */}
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Titre <span className="text-red-500">*</span>
                    </label>
                    <input type="text" {...form.register("title")}
                           className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                    {form.formState.errors.title && <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>}
                </div>

                {/* Description */}
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Description</label>
                    <textarea {...form.register("description")} rows={4}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"></textarea>
                    {form.formState.errors.description && <p className="mt-1 text-xs text-red-600">{form.formState.errors.description.message}</p>}
                </div>

                {/* Auteur + Éditeur */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Auteur</label>
                        <input type="text" {...form.register("author")}
                               placeholder="Ex: Victor Hugo"
                               className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                        {form.formState.errors.author && <p className="mt-1 text-xs text-red-600">{form.formState.errors.author.message}</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Éditeur</label>
                        <input type="text" {...form.register("publisher")}
                               placeholder="Ex: Gallimard"
                               className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                        {form.formState.errors.publisher && <p className="mt-1 text-xs text-red-600">{form.formState.errors.publisher.message}</p>}
                    </div>
                </div>

                {/* État du livre + Langue + Quantité */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                            État du livre <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4 h-11 items-center">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" {...form.register("book_condition")} value="neuf"
                                       className="accent-[#6D28D9] w-4 h-4" />
                                Neuf
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" {...form.register("book_condition")} value="occas"
                                       className="accent-[#6D28D9] w-4 h-4" />
                                Occasion
                            </label>
                        </div>
                        {form.formState.errors.book_condition && <p className="mt-1 text-xs text-red-600">{form.formState.errors.book_condition.message}</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Langue</label>
                        <select {...form.register("language_id", { setValueAs: v => v === "" ? null : parseInt(v) })}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20">
                            <option value="">-- Choisir --</option>
                            {refData?.languages.map(lang => (
                                <option key={lang.id} value={lang.id}>{lang.name_fr}</option>
                            ))}
                        </select>
                        {form.formState.errors.language_id && <p className="mt-1 text-xs text-red-600">{form.formState.errors.language_id.message}</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                            Quantité <span className="text-red-500">*</span>
                        </label>
                        <input type="number" min="1" step="1"
                               {...form.register("quantity", { valueAsNumber: true })}
                               className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                        {form.formState.errors.quantity && <p className="mt-1 text-xs text-red-600">{form.formState.errors.quantity.message}</p>}
                    </div>
                </div>

                {/* Prix · Réduction % · Prix réduit */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Prix (MAD) <span className="text-red-500">*</span></label>
                        <input type="number" step="0.01" min="0"
                               {...form.register("price", { valueAsNumber: true })}
                               onChange={(e) => {
                                   form.register("price", { valueAsNumber: true }).onChange(e);
                                   handlePriceChange(parseFloat(e.target.value));
                               }}
                               className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                        {form.formState.errors.price && <p className="mt-1 text-xs text-red-600">{form.formState.errors.price.message}</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Réduction (%)</label>
                        <input type="number" step="1" min="0" max="99"
                               value={discountPercent}
                               onChange={(e) => {
                                 const v = Math.min(99, Math.max(0, parseInt(e.target.value) || 0)).toString();
                                 handleDiscountPercentChange(v === "0" && e.target.value === "" ? "" : v);
                               }}
                               placeholder="0"
                               className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                        <p className="mt-1 text-xs text-slate-400">Calcule le prix réduit</p>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Prix réduit (MAD)</label>
                        <input type="number" step="0.01" min="0"
                               {...form.register("discount_price", { setValueAs: v => (v === "" || v === null || isNaN(v)) ? null : parseFloat(v) })}
                               onChange={(e) => {
                                   form.register("discount_price").onChange(e);
                                   handleDiscountPriceChange(e.target.value === "" || isNaN(parseFloat(e.target.value)) ? null : parseFloat(e.target.value));
                               }}
                               placeholder="Optionnel"
                               className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20" />
                        {form.formState.errors.discount_price && <p className="mt-1 text-xs text-red-600">{form.formState.errors.discount_price.message}</p>}
                    </div>
                </div>

                {/* Catégories hiérarchiques */}
                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Catégorie <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">

                        {/* Niveau 1 */}
                        <select value={selectedCategoryPath[0]?.id ?? ""}
                                onChange={(e) => handleCategoryChange(e.target.value ? parseInt(e.target.value) : "")}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20">
                            <option value="">-- Choisir une catégorie --</option>
                            {l1Categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                            ))}
                        </select>

                        {/* Niveau 2 */}
                        {l2Categories.length > 0 && (
                            <select value={selectedCategoryPath[1]?.id ?? ""}
                                    onChange={(e) => handleCategoryChange(e.target.value ? parseInt(e.target.value) : "")}
                                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20">
                                <option value="">-- Sous-catégorie --</option>
                                {l2Categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                                ))}
                            </select>
                        )}

                        {/* Niveau 3 */}
                        {l3Categories.length > 0 && (
                            <select value={selectedCategoryPath[2]?.id ?? ""}
                                    onChange={(e) => handleCategoryChange(e.target.value ? parseInt(e.target.value) : "")}
                                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20">
                                <option value="">-- Spécialité --</option>
                                {l3Categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {form.formState.errors.category_id && <p className="mt-1 text-xs text-red-600">{form.formState.errors.category_id.message}</p>}
                </div>

                {/* Niveau + Matière */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                            Niveau {levelIsNA ? "" : "(Optionnel)"}
                        </label>
                        <select {...form.register("level_id", { setValueAs: v => v === "" ? null : parseInt(v) })}
                                disabled={levelIsNA}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                            {levelIsNA ? (
                                <option value={naLevel?.id ?? ""}>{naLevel?.name_fr || "Non applicable"}</option>
                            ) : (
                                <>
                                    <option value="">-- Choisir --</option>
                                    {levelOptions.map(level => (
                                        <option key={level.id} value={level.id}>{level.name_fr}</option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                            Matière {subjectIsNA ? "" : "(Optionnel)"}
                        </label>
                        <select {...form.register("subject_id", { setValueAs: v => v === "" ? null : parseInt(v) })}
                                disabled={subjectIsNA}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                            {subjectIsNA ? (
                                <option value={naSubject?.id ?? ""}>{naSubject?.name_fr || "Non applicable"}</option>
                            ) : (
                                <>
                                    <option value="">-- Choisir --</option>
                                    {subjectOptions.map(subject => (
                                        <option key={subject.id} value={subject.id}>{subject.name_fr}</option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>
                </div>

            </div>{/* fin card */}

            <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-lg bg-[#6D28D9] text-sm font-bold text-white hover:bg-violet-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  isEditMode ? 'Enregistrer les modifications' : 'Publier l\'annonce'
                )}
            </button>
        </div>{/* fin colonne droite */}
      </form>
    </div>
  );
}
