"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Loader2, X } from "lucide-react";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/components/Toast";
import { useQuery } from "@tanstack/react-query";

interface CategoryNode {
  id: number;
  name_fr: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: refData } = useQuery({
    queryKey: ["referenceData"],
    queryFn: async () => {
      const { data } = await api.get("/reference-data");
      return data;
    },
  });

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setAuthor(initialData.author || "");
      setIsbn(initialData.isbn || "");
      setCategoryId(initialData.category_id ? String(initialData.category_id) : "");
      setComment(initialData.comment || "");
      setCoverPreview(initialData.cover_url || null);
    }
  }, [initialData]);

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
      if (comment.trim()) formData.append("comment", comment.trim());
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
        success(data.message || "Votre demande a été enregistrée !");
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
    <div className="bg-white rounded-2xl border border-gray-150 p-6 sm:p-8 shadow-xs">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Titre */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Titre du livre <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Les Misérables, Mathématiques 2ème BAC, Physique..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#6D28D9] focus:bg-white transition-colors text-gray-900"
          />
        </div>

        {/* Auteur et ISBN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Auteur (optionnel)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Victor Hugo"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#6D28D9] focus:bg-white transition-colors text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              ISBN (optionnel)
            </label>
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Ex: 9782..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-[#6D28D9] focus:bg-white transition-colors text-gray-900"
            />
          </div>
        </div>

        {/* Catégorie */}
        {refData?.categories && (
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Catégorie (optionnel)
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#6D28D9] focus:bg-white transition-colors text-gray-900 cursor-pointer"
            >
              <option value="">Sélectionner une catégorie</option>
              {refData.categories.map((cat: CategoryNode) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_fr}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Photo / Couverture */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Photo ou couverture du livre (optionnel)
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {coverPreview ? "Changer la photo" : "Ajouter une photo"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            {coverPreview && (
              <div className="relative group">
                <div className="w-12 h-16 rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                  <img src={coverPreview} className="w-full h-full object-cover" alt="Aperçu" />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-xs cursor-pointer hover:bg-rose-700"
                  title="Supprimer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Commentaire */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Commentaire / Précisions pour les vendeurs (optionnel)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: Je cherche spécifiquement l'édition 2024 en bon état..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#6D28D9] focus:bg-white transition-colors text-gray-900"
          />
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/dashboard/demandes"
            className="px-5 py-3 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-[#6D28D9] text-white font-bold text-xs rounded-xl hover:bg-violet-800 transition-colors flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isEditing ? "Enregistrer les modifications" : "Publier la demande"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
