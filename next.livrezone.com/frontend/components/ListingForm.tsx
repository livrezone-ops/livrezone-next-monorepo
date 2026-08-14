"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Loader2 } from "lucide-react";

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

// Schéma de validation Zod
const formSchema = z.object({
  title: z.string().min(3, "Le titre doit faire au moins 3 caractères"),
  description: z.string().optional(),
  book_condition: z.enum(["neuf", "occas"], { message: "Sélectionnez un état" }),
  price: z.number({ message: "Le prix est requis" }).min(0, "Le prix doit être positif"),
  discount_price: z.number().min(0, "Le prix réduit doit être positif").optional().nullable(),
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

interface ListingFormProps {
  initialData?: FormValues & { id?: number, cover_path?: string, cover_source_url?: string, cover_url?: string, cover_thumbnail_url?: string };
  onSubmitSuccess: () => void;
  isEditMode?: boolean;
  onError?: (message: string) => void;
}

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

  // État local pour gérer la hiérarchie des catégories
  const [selectedL1, setSelectedL1] = useState<number | "">("");
  const [selectedL2, setSelectedL2] = useState<number | "">("");

  // Pourcentage de réduction
  const [discountPercent, setDiscountPercent] = useState<string>("");

  // Fetch reference data
  const { data: refData, isLoading: isLoadingRef } = useQuery<ReferenceData>({
    queryKey: ["reference-data"],
    queryFn: async () => {
      const res = await api.get("/reference-data");
      // Mappage de name à name_fr pour s'adapter au backend
      const formatCategories = (cats: any[]): CategoryNode[] => {
        return cats.map(c => ({
          ...c,
          name_fr: c.name || c.name_fr,
          children: c.children ? formatCategories(c.children) : []
        }));
      };
      return {
        ...res.data,
        categories: formatCategories(res.data.categories || [])
      };
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      book_condition: initialData?.book_condition || "occas",
      price: initialData?.price || undefined,
      discount_price: initialData?.discount_price || null,
      category_id: initialData?.category_id || undefined,
      level_id: initialData?.level_id || null,
      subject_id: initialData?.subject_id || null,
      language_id: initialData?.language_id || null,
      isbn_13: initialData?.isbn_13 || "",
    }
  });

  const priceValue = form.watch("price");

  // Initialisation de la hiérarchie de catégories (une seule fois, au chargement)
  const catInitDone = useRef(false);
  useEffect(() => {
    if (catInitDone.current || !refData) return;
    const initCat = initialData?.category_id || form.getValues("category_id");
    if (initCat && refData) {
      let found = false;
      for (const l1 of refData.categories) {
        if (l1.id === initCat) {
          setSelectedL1(l1.id);
          found = true;
          break;
        }
        if (l1.children) {
          for (const l2 of l1.children) {
            if (l2.id === initCat) {
              setSelectedL1(l1.id);
              setSelectedL2(l2.id);
              found = true;
              break;
            }
            if (l2.children) {
              for (const l3 of l2.children) {
                if (l3.id === initCat) {
                  setSelectedL1(l1.id);
                  setSelectedL2(l2.id);
                  found = true;
                  break;
                }
              }
            }
            if (found) break;
          }
        }
        if (found) break;
      }
      catInitDone.current = true;
    }
  }, [initialData, refData, form]);

  // Initialisation du % de réduction si un discount_price existe
  useEffect(() => {
    const p = initialData?.price;
    const dp = initialData?.discount_price;
    if (p && dp && p > 0 && dp > 0 && dp < p) {
      const pct = Math.round((1 - dp / p) * 100);
      setDiscountPercent(pct.toString());
    }
  }, [initialData]);

  // --- Niveau / Matière pilotés par la catégorie sélectionnée ---
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

  const selectedCategory = useMemo(
    () => findCategoryNode(refData?.categories, form.watch("category_id")),
    [refData, form.watch("category_id")]
  );

  const allowedLevels = selectedCategory?.levels || [];
  const allowedSubjects = selectedCategory?.subjects || [];
  const naLevel = allowedLevels.find((l) => l.code === "NON_APPLICABLE");
  const naSubject = allowedSubjects.find((s) => s.code === "NON_APPLICABLE");
  const levelIsNA = allowedLevels.length === 0 || (allowedLevels.length === 1 && !!naLevel);
  const subjectIsNA = allowedSubjects.length === 0 || (allowedSubjects.length === 1 && !!naSubject);

  // Synchronise level/subject quand la catégorie change
  useEffect(() => {
    if (!selectedCategory) return;

    if (levelIsNA) {
      const target = naLevel ? naLevel.id : null;
      if (form.getValues("level_id") !== target) form.setValue("level_id", target);
    } else {
      const cur = form.getValues("level_id");
      if (cur && !allowedLevels.some((l) => l.id === cur)) {
        form.setValue("level_id", null);
      }
    }

    if (subjectIsNA) {
      const target = naSubject ? naSubject.id : null;
      if (form.getValues("subject_id") !== target) form.setValue("subject_id", target);
    } else {
      const cur = form.getValues("subject_id");
      if (cur && !allowedSubjects.some((s) => s.id === cur)) {
        form.setValue("subject_id", null);
      }
    }
  }, [selectedCategory, levelIsNA, subjectIsNA, allowedLevels, allowedSubjects, form]);

  // Fonction de recherche ISBN
  const searchIsbn = async () => {
    if (!isbnInput.trim()) return;
    setIsSearchingIsbn(true);
    setIsbnSearchError(null);
    try {
      const res = await api.get(`/books/search?isbn=${isbnInput}`);
      const book = res.data.book;
      if (book) {
        form.setValue("title", book.title);
        form.setValue("isbn_13", book.isbn_13 || book.isbn_10);
        if (book.description) form.setValue("description", book.description);
        if (book.indicative_price) {
          form.setValue("price", parseFloat(book.indicative_price));
        }
        const catId = book.default_category_id || book.category_id;
        if (catId) {
          form.setValue("category_id", catId);
          // Forcer le re-calcul des select L1/L2
          const currentValues = form.getValues();
          setInitialCatState(catId);
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
    } catch (err: any) {
      setIsbnSearchError("Aucun livre trouvé pour cet ISBN. Vous pouvez remplir les champs manuellement ci-dessous.");
    } finally {
      setIsSearchingIsbn(false);
    }
  };

  const setInitialCatState = (catId: number) => {
    if (!refData) return;
    let found = false;
    for (const l1 of refData.categories) {
      if (l1.id === catId) { setSelectedL1(l1.id); found = true; break; }
      if (l1.children) {
        for (const l2 of l1.children) {
          if (l2.id === catId) { setSelectedL1(l1.id); setSelectedL2(l2.id); found = true; break; }
          if (l2.children) {
            for (const l3 of l2.children) {
              if (l3.id === catId) { setSelectedL1(l1.id); setSelectedL2(l2.id); found = true; break; }
            }
          }
          if (found) break;
        }
      }
      if (found) break;
    }
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

      // La quantité est toujours fixée à 1 (non modifiable par l'utilisateur)
      formData.append("quantity", "1");

      // La catégorie parente (L1) pour la validation de la sous-catégorie côté serveur
      if (typeof selectedL1 === "number") {
        formData.append("parent_category_id", selectedL1.toString());
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
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || "Une erreur est survenue lors de l'enregistrement.";
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

  // Listes dérivées de la hiérarchie pour les dropdowns
  const currentL1 = refData?.categories.find(c => c.id === selectedL1);
  const currentL2 = currentL1?.children?.find(c => c.id === selectedL2);
  const l1Categories = refData?.categories || [];
  const l2Categories = currentL1?.children || [];
  const l3Categories = currentL2?.children || [];

  // Niveaux et Matières (pilotés par la catégorie sélectionnée)
  const levelOptions = levelIsNA ? (naLevel ? [naLevel] : []) : allowedLevels;
  const subjectOptions = subjectIsNA ? (naSubject ? [naSubject] : []) : allowedSubjects;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Zone Drag & Drop IA */}
      <div className="mb-8 bg-white border-2 border-dashed border-[#6D28D9]/40 hover:border-[#6D28D9] bg-violet-50/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer group relative overflow-hidden shadow-sm">
        <input type="file" multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title="Glisser des photos" />
        <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-violet-100 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
            🤖
        </div>
        <h2 className="font-black text-black text-lg group-hover:text-[#6D28D9] transition-colors">Scanner des livres avec l'IA</h2>
        <p className="text-[14px] text-gray-500 mt-2 max-w-lg">Glissez-déposez les photos de vos livres ici (ou cliquez pour parcourir). L'Intelligence Artificielle reconnaîtra les informations automatiquement et remplira le formulaire.</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-px bg-gray-200 flex-1"></div>
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">OU SAISIE MANUELLE</span>
        <div className="h-px bg-gray-200 flex-1"></div>
      </div>

      {/* Bloc recherche ISBN */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
            {isEditMode ? 'Modifier l\'annonce' : 'Créer une annonce'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
            Saisissez l'ISBN du livre pour pré-remplir automatiquement les informations.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-md">
                <label className="mb-1 block text-sm font-semibold text-slate-700">ISBN</label>
                <input
                    type="text"
                    value={isbnInput}
                    onChange={(e) => setIsbnInput(e.target.value)}
                    placeholder="Ex: 9782294788222"
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
                />
            </div>

            <button
                type="button"
                onClick={searchIsbn}
                disabled={isSearchingIsbn}
                className="h-11 rounded-lg bg-[#F97316] px-5 text-sm font-bold text-white hover:bg-[#ea630a] disabled:opacity-70 flex items-center justify-center min-w-[120px]"
            >
                {isSearchingIsbn ? <Loader2 className="w-5 h-5 animate-spin" /> : "Rechercher"}
            </button>
        </div>

        {isbnSearchError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {isbnSearchError}
            </div>
        )}
      </div>

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

                {/* État du livre + Langue */}
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                {/* Prix · Réduction % · Prix réduit */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                            Prix (MAD) <span className="text-red-500">*</span>
                        </label>
                        <input type="number" step="0.01" min="0"
                               {...form.register("price", { valueAsNumber: true })}
                               onChange={(e) => handlePriceChange(parseFloat(e.target.value))}
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
                               {...form.register("discount_price", { setValueAs: v => v === "" ? null : parseFloat(v) })}
                               onFocus={() => setDiscountPercent("")}
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
                        <select value={selectedL1}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : "";
                                  setSelectedL1(val);
                                  setSelectedL2("");
                                  form.setValue("category_id", val as number);
                                }}
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20">
                            <option value="">-- Choisir une catégorie --</option>
                            {l1Categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                            ))}
                        </select>

                        {/* Niveau 2 */}
                        {l2Categories.length > 0 && (
                            <select value={selectedL2}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : "";
                                      setSelectedL2(val);
                                      form.setValue("category_id", val as number || selectedL1 as number);
                                    }}
                                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20">
                                <option value="">-- Sous-catégorie --</option>
                                {l2Categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                                ))}
                            </select>
                        )}

                        {/* Niveau 3 */}
                        {l3Categories.length > 0 && (
                            <select {...form.register("category_id", { valueAsNumber: true })}
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

                {/* Niveau */}
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

                {/* Matière */}
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
