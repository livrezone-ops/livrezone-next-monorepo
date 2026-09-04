"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, X, CheckCircle2, Search, BookOpen, Library } from "lucide-react";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import SmartCoverImage from "@/components/SmartCoverImage";
import { useToast } from "@/components/Toast";
import { useQuery } from "@tanstack/react-query";

interface CategoryNode {
  id: number;
  name: string;
  name_fr: string;
  slug?: string;
  children?: CategoryNode[];
}

// Retourne le chemin [L1, L2, L3] jusqu'à la catégorie (fonction pure, comme ListingForm).
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

interface BookSuggestion {
  id: number;
  title: string;
  authors?: string | string[] | null;
  isbn_13?: string | null;
  isbn_10?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  category_id?: number | null;
  default_category_id?: number | null;
  // Chemin de catégorie aplati (autocomplete) ou imbriqué (/books/{id})
  category_parent?: string | null;
  category_child?: string | null;
  default_category?: { name_fr?: string | null; parent?: { name_fr?: string | null } } | null;
}

export interface OrderFormData {
  id?: number;
  book_id?: number | null;
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
  category_id?: number | null;
  cover_path?: string | null;
  cover_url?: string | null;
  comment?: string | null;
}

interface OrderFormProps {
  initialData?: OrderFormData | null;
  isEditing?: boolean;
}

export default function OrderForm({ initialData, isEditing = false }: OrderFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState(initialData?.title || "");
  const [author, setAuthor] = useState(initialData?.author || "");
  const [isbn, setIsbn] = useState(initialData?.isbn || "");
  const [categoryId, setCategoryId] = useState(initialData?.category_id ? String(initialData.category_id) : "");
  const [comment, setComment] = useState(initialData?.comment || "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.cover_url || null);
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{ count: number; isbn: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Recherche du livre à demander (catalogue Meilisearch, création uniquement) ---
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSuggestions, setBookSuggestions] = useState<BookSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [bookSearchError, setBookSearchError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookSuggestion | null>(null);
  // Aperçu couverture : photo importée > couverture du catalogue (comme ListingForm)
  const catalogCover = selectedBook?.cover_thumbnail_url || selectedBook?.cover_url || null;
  const coverShown = coverPreview || catalogCover;

  const { data: refData } = useQuery({
    queryKey: ["referenceData"],
    queryFn: async () => {
      const { data } = await api.get("/reference-data");
      // Le backend renvoie "name" pour les catégories (pas "name_fr") : normalisation,
      // comme dans ListingForm. Sans ça, les <option> sont vides.
      const formatCategories = (cats: {
        id: number;
        name?: string;
        name_fr?: string;
        slug?: string;
        children?: unknown[];
      }[]): CategoryNode[] =>
        cats.map((c) => ({
          id: c.id,
          name: c.name || c.name_fr || "",
          name_fr: c.name || c.name_fr || "",
          slug: c.slug || "",
          children: c.children ? formatCategories(c.children as typeof cats) : [],
        }));
      return { ...data, categories: formatCategories(data.categories || []) };
    },
  });

  // Catégories en cascade : listes dérivées du chemin de la catégorie sélectionnée
  const categoryPath = getCategoryPath(
    refData?.categories as CategoryNode[] | undefined,
    categoryId ? Number(categoryId) : undefined
  );
  const l1Categories = Array.isArray(refData?.categories) ? (refData.categories as CategoryNode[]) : [];
  const l2Categories = categoryPath[0]?.children || [];
  const l3Categories = categoryPath[1]?.children || [];

  // Pré-remplissage depuis initialData : ajustement de state pendant le rendu
  // (pattern officiel React "adjusting state when props change") — remplace
  // l'ancien effet de copie props → state.
  const [syncedInitialData, setSyncedInitialData] = useState(initialData);
  if (syncedInitialData !== initialData) {
    setSyncedInitialData(initialData);
    if (initialData) {
      setTitle(initialData.title || "");
      setAuthor(initialData.author || "");
      setIsbn(initialData.isbn || "");
      setCategoryId(initialData.category_id ? String(initialData.category_id) : "");
      setComment(initialData.comment || "");
      setCoverPreview(initialData.cover_url || null);
    }
  }

  // --- Recherche catalogue (pattern ListingForm) : autocomplete debouncé, tout
  // dans le callback du timer (règle react-hooks/set-state-in-effect en "error").
  useEffect(() => {
    if (isEditing) return;
    const term = bookSearchQuery.trim();
    const delay = setTimeout(async () => {
      if (term.length < 2) {
        setBookSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await api.get(`/books/autocomplete?q=${encodeURIComponent(term)}`);
        setBookSuggestions(Array.isArray(res.data) ? res.data : []);
        setShowSuggestions(true);
      } catch {
        setBookSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [bookSearchQuery, isEditing]);

  // Préremplit la demande depuis un livre du catalogue (book_id joint à la
  // soumission → diffusion immédiate, sans modération).
  const applyBook = (book: BookSuggestion) => {
    setSelectedBook(book);
    setTitle(book.title || "");
    const authors = Array.isArray(book.authors) ? book.authors.join(", ") : book.authors || "";
    setAuthor(authors);
    setIsbn(book.isbn_13 || book.isbn_10 || "");
    const catId = book.default_category_id || book.category_id;
    if (catId) setCategoryId(String(catId));
    setBookSearchError(null);
    setShowSuggestions(false);
    setBookSearchQuery("");
  };

  // Chemin « Parent › Enfant » — format aplati (autocomplete) ou imbriqué (/books/{id})
  const bookCategoryPath = (b: BookSuggestion): string => {
    const parent = b.category_parent ?? b.default_category?.parent?.name_fr ?? null;
    const child = b.category_child ?? b.default_category?.name_fr ?? null;
    return [parent, child].filter(Boolean).join(" › ");
  };

  // Recherche exacte (ISBN ou titre saisi) : Entrée sans suggestion, ou bouton loupe.
  const fetchBookDetails = async (identifier: string) => {
    if (!identifier) return;
    setIsSearchingBooks(true);
    setBookSearchError(null);
    setShowSuggestions(false);
    try {
      const res = await api.get(`/books/${encodeURIComponent(identifier)}`);
      const book = res.data?.book;
      if (book) {
        applyBook(book);
      } else {
        setBookSearchError("Ce livre n'est pas dans notre catalogue. Merci de remplir les champs manuellement.");
      }
    } catch {
      setBookSearchError("Ce livre n'est pas dans notre catalogue. Merci de remplir les champs manuellement.");
    } finally {
      setIsSearchingBooks(false);
    }
  };

  const handleManualSearch = () => {
    if (bookSearchQuery.trim()) fetchBookDetails(bookSearchQuery.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 4 * 1024 * 1024) {
        toastError("L'image ne doit pas dépasser 4 Mo.");
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastError("Le titre du livre est obligatoire.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      if (author.trim()) formData.append("author", author.trim());
      if (isbn.trim()) formData.append("isbn", isbn.trim());
      if (categoryId) formData.append("category_id", categoryId);
      if (selectedBook) formData.append("book_id", String(selectedBook.id));
      if (comment.trim() || isEditing) formData.append("comment", comment.trim());
      if (coverFile) formData.append("cover_image", coverFile);

      if (isEditing && initialData?.id) {
        await api.post(`/orders/${initialData.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        success("Demande modifiée avec succès !");
      } else {
        const { data } = await api.post("/orders", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // Signal : le livre demandé est déjà en vente sur le site
        // (order.available_listings_count > 0 renvoyé par POST /orders).
        const count = Number(data?.order?.available_listings_count ?? 0);
        if (count > 0) {
          setCreatedOrder({
            count,
            isbn: String(data?.order?.isbn ?? isbn).trim(),
            title: String(data?.order?.title ?? title).trim(),
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        success(data.message || "Votre demande a été enregistrée !");
        router.push("/dashboard/demandes");
        return;
      }

      router.push("/dashboard/demandes");
    } catch (err) {
      console.error("Erreur soumission demande:", err);
      toastError(getApiErrorMessage(err, "Erreur lors de l'enregistrement de la demande."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {createdOrder && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs overflow-hidden mb-5">
          <div className="bg-emerald-50 px-5 py-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-emerald-800 text-sm">Demande publiée !</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Bonne nouvelle&nbsp;: ce livre est en vente actuellement sur le site
                ({createdOrder.count} annonce{createdOrder.count > 1 ? "s" : ""} correspondante{createdOrder.count > 1 ? "s" : ""}).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatedOrder(null)}
              className="text-emerald-400 hover:text-emerald-600 cursor-pointer shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link
              href={createdOrder.isbn ? `/annonces?isbn=${encodeURIComponent(createdOrder.isbn)}` : `/annonces?search=${encodeURIComponent(createdOrder.title)}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Search className="w-4 h-4" />
              Voir les vendeurs de ce livre
            </Link>
            <span className="text-[11px] text-gray-400 hidden sm:inline">ou</span>
            <Link href="/dashboard/demandes" className="text-xs font-bold text-[#6D28D9] hover:text-violet-900 hover:underline">
              accéder à mes demandes
            </Link>
          </div>
        </div>
      )}

      {/* --- Box de recherche du livre dans le catalogue (création uniquement) --- */}
      {!isEditing && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 sm:p-8 shadow-xs mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#6D28D9]" />
              Rechercher le livre dans notre catalogue
            </label>
            <Link
              href="/books"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6D28D9] hover:text-violet-900 hover:underline shrink-0"
            >
              <Library className="w-3.5 h-3.5" />
              Consulter le catalogue des livres
            </Link>
          </div>

          <div className="relative">
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#6D28D9] transition-colors">
              <input
                type="text"
                value={bookSearchQuery}
                onChange={(e) => {
                  setBookSearchQuery(e.target.value);
                  setBookSearchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // Entrée : sélectionne la 1ʳᵉ suggestion si disponible,
                    // sinon recherche exacte (ISBN ou titre) → message rouge
                    // si le livre n'est pas dans le catalogue.
                    if (bookSuggestions.length > 0) {
                      applyBook(bookSuggestions[0]);
                    } else if (bookSearchQuery.trim()) {
                      handleManualSearch();
                    }
                  }
                }}
                placeholder="Titre ou ISBN — ex : 9782070413119"
                className="flex-1 px-4 py-3 text-sm bg-transparent focus:outline-none text-gray-900"
              />
              <button
                type="button"
                onClick={handleManualSearch}
                disabled={isSearchingBooks || !bookSearchQuery.trim()}
                className="px-4 bg-[#6D28D9] hover:bg-violet-800 text-white transition-colors flex items-center cursor-pointer disabled:opacity-60 disabled:cursor-default"
                title="Rechercher dans le catalogue"
              >
                {isSearchingBooks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* Dropdown suggestions (autocomplete Meilisearch) */}
            {showSuggestions && bookSuggestions.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                  {bookSuggestions.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => applyBook(b)}
                        className="w-full text-left px-4 py-2.5 hover:bg-violet-50 transition-colors flex items-center gap-3 cursor-pointer"
                      >
                        {b.cover_thumbnail_url || b.cover_url ? (
                          <span className="relative w-8 h-11 rounded-md border border-gray-100 shrink-0 overflow-hidden">
                            <SmartCoverImage
                              src={b.cover_thumbnail_url || b.cover_url}
                              alt=""
                              className="object-cover"
                              sizes="32px"
                              fallbackSrc={b.cover_url}
                            />
                          </span>
                        ) : (
                          <span className="w-8 h-11 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-gray-900 truncate">{b.title}</span>
                          <span className="block text-[11px] text-gray-500 truncate">
                            {(Array.isArray(b.authors) ? b.authors.join(", ") : b.authors) || "Auteur inconnu"}
                            {b.isbn_13 ? ` · ISBN ${b.isbn_13}` : ""}
                          </span>
                          {bookCategoryPath(b) && (
                            <span className="block text-[11px] text-violet-600 truncate">{bookCategoryPath(b)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Message rouge : livre absent du catalogue → remplissage manuel */}
          {bookSearchError && (
            <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1.5">
              <X className="w-3.5 h-3.5 shrink-0" />
              {bookSearchError}
            </p>
          )}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-150 p-4 sm:p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

        {/* 1. BLOC ISBN & TITRE (mobile en 1er, desktop en haut à droite) */}
        <div className="order-1 lg:order-2 lg:col-span-8">
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            {/* ISBN */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                ISBN <span className="ml-1 text-xs font-normal text-gray-400">(Optionnel)</span>
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="Ex: 9782070413119"
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
              />
            </div>

            {/* Titre */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Titre <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Les Misérables, Mathématiques 2ème BAC, Physique..."
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
              />
            </div>
          </div>
        </div>

        {/* 2. BLOC COUVERTURE (mobile en 2e compact — sous le titre/ISBN —, desktop colonne gauche sticky) */}
        <div className="order-2 lg:order-1 lg:col-span-4 lg:row-span-2 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm lg:sticky lg:top-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Couverture</h2>

            <div className="flex flex-row lg:flex-col gap-4 items-center sm:items-start">
              {/* Aperçu : photo importée > couverture du catalogue > placeholder */}
              <div className="relative w-28 h-36 sm:w-36 sm:h-48 lg:w-full lg:h-auto lg:pb-[135%] rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shrink-0">
                {coverShown ? (
                  <SmartCoverImage
                    src={coverShown}
                    alt="Aperçu de la couverture"
                    className="object-contain p-2 lg:p-4"
                    sizes="(max-width: 640px) 112px, 144px"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                    <BookOpen className="w-8 h-8 lg:w-12 lg:h-12 mb-1 text-gray-300" />
                    <span className="text-[10px] lg:text-xs">Pas de couverture</span>
                  </div>
                )}
                {coverPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs cursor-pointer hover:bg-rose-700 transition-colors"
                    title="Supprimer la photo importée"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Import + gestion */}
              <div className="flex-1 w-full">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {coverPreview ? "Remplacer la photo" : "Importer une couverture (optionnel)"}
                  </span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/webp"
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-[#6D28D9] hover:file:bg-violet-100 cursor-pointer"
                  />
                  <p className="mt-1 text-[11px] sm:text-xs text-gray-400">JPG, PNG, WEBP — max 4 Mo.</p>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 3. BLOC AUTRES CHAMPS (Auteur, Catégorie, Commentaire) + action */}
        <div className="order-3 lg:order-3 lg:col-span-8">
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            {/* Auteur */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Auteur <span className="ml-1 text-xs font-normal text-gray-400">(Optionnel)</span>
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ex: Victor Hugo"
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
              />
            </div>

            {/* Catégorie — selects en cascade L1 → L2 → L3 (comme ListingForm) */}
            {refData?.categories && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Catégorie <span className="ml-1 text-xs font-normal text-gray-400">(Optionnel)</span>
                </label>
                <div className="space-y-2">
                  {/* Niveau 1 */}
                  <select
                    value={categoryPath[0]?.id ?? ""}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 cursor-pointer"
                  >
                    <option value="">-- Choisir une catégorie --</option>
                    {l1Categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                    ))}
                  </select>

                  {/* Niveau 2 */}
                  {l2Categories.length > 0 && (
                    <select
                      value={categoryPath[1]?.id ?? ""}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 cursor-pointer"
                    >
                      <option value="">-- Sous-catégorie --</option>
                      {l2Categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                      ))}
                    </select>
                  )}

                  {/* Niveau 3 */}
                  {l3Categories.length > 0 && (
                    <select
                      value={categoryPath[2]?.id ?? ""}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 cursor-pointer"
                    >
                      <option value="">-- Spécialité --</option>
                      {l3Categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name_fr}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Commentaire */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Commentaire / Précisions pour les vendeurs{" "}
                <span className="ml-1 text-xs font-normal text-gray-400">(Optionnel)</span>
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: Je cherche spécifiquement l'édition 2024 en bon état..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20"
              />
            </div>

            {/* Bouton d'action */}
            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-lg bg-[#6D28D9] text-sm font-bold text-white hover:bg-violet-800 transition-colors disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditing ? "Enregistrer les modifications" : "Publier la demande"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
    </>
  );
}
