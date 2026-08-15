"use client";

import React, { useState } from "react";
import { Star, X, Loader2 } from "lucide-react";
import api from "@/lib/axios";

interface RatingModalProps {
  nickname: string;
  onClose: () => void;
  onSuccess: (average: number, count: number, score: number, comment: string) => void;
  initialScore?: number;
  initialComment?: string;
}

export default function RatingModal({
  nickname,
  onClose,
  onSuccess,
  initialScore,
  initialComment,
}: RatingModalProps) {
  const [score, setScore] = useState(initialScore || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score < 1) {
      setError("Veuillez choisir une note.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post(`/profiles/${nickname}/ratings`, {
        score,
        comment: comment.trim() || null,
      });
      onSuccess(data.rating_average, data.rating_count, score, comment.trim());
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.comment?.[0] ||
          "Une erreur est survenue. Réessayez."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Donner un avis</h3>
          <button
            onClick={onClose}
            type="button"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6">
          <div className="mb-6 text-center">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Note globale
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="transition-transform hover:scale-110 cursor-pointer"
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      (hover || score) >= n
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {error && <span className="text-red-500 text-xs mt-2 block">{error}</span>}
          </div>

          <div className="mb-6">
            <label
              htmlFor="rating-comment"
              className="block text-sm font-bold text-gray-700 mb-2"
            >
              Commentaire (facultatif)
            </label>
            <textarea
              id="rating-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 transition-all resize-none"
              placeholder="Partagez votre expérience avec ce vendeur..."
            />
            <div className="text-right text-[11px] text-gray-400 mt-1">
              {comment.length}/1000
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl hover:bg-gray-50 transition-colors text-sm cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#6D28D9] text-white font-bold py-2.5 px-4 rounded-xl hover:bg-[#5b21b6] transition-colors shadow-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publier l&apos;avis
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}