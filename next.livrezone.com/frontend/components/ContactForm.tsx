"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

const SUBJECT_OPTIONS = [
  "Question générale sur la plateforme",
  "Signaler une annonce ou un contenu non conforme",
  "Assistance technique ou problème de compte",
  "Partenariat librairie ou professionnel",
  "Suggestion d'amélioration",
  "Autre demande",
];

export default function ContactForm() {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: SUBJECT_OPTIONS[0],
    message: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Veuillez renseigner votre nom.";
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = "Veuillez fournir une adresse email valide.";
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errors.message = "Votre message doit contenir au moins 10 caractères.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Simulation d'envoi ou intégration future avec API
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSubmitted(true);
      success("Votre message a été envoyé avec succès !");
    } catch {
      toastError("Une erreur est survenue lors de l'envoi. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900">Message bien reçu !</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Merci <strong className="text-gray-900">{formData.name}</strong>. Notre équipe a bien pris en compte votre demande et vous répondra à l&apos;adresse <strong className="text-gray-900">{formData.email}</strong> dans un délai de 24h à 48h ouvrées.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setFormData({
              name: "",
              email: "",
              subject: SUBJECT_OPTIONS[0],
              message: "",
            });
          }}
          className="inline-block px-5 py-2.5 bg-white border border-gray-200 text-xs sm:text-sm font-semibold rounded-xl text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nom */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Nom complet <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
            }}
            placeholder="Ex : Karim Bennani"
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${
              formErrors.name ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:border-violet-500 focus:ring-violet-100"
            } bg-white text-gray-900 focus:outline-none focus:ring-3 transition-all`}
          />
          {formErrors.name && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {formErrors.name}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Adresse email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (formErrors.email) setFormErrors({ ...formErrors, email: "" });
            }}
            placeholder="karim@exemple.com"
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${
              formErrors.email ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:border-violet-500 focus:ring-violet-100"
            } bg-white text-gray-900 focus:outline-none focus:ring-3 transition-all`}
          />
          {formErrors.email && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {formErrors.email}
            </p>
          )}
        </div>
      </div>

      {/* Objet */}
      <div className="space-y-1.5">
        <label htmlFor="subject" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Objet de la demande <span className="text-red-500">*</span>
        </label>
        <select
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 transition-all cursor-pointer"
        >
          {SUBJECT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label htmlFor="message" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Votre message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          rows={5}
          value={formData.message}
          onChange={(e) => {
            setFormData({ ...formData, message: e.target.value });
            if (formErrors.message) setFormErrors({ ...formErrors, message: "" });
          }}
          placeholder="Décrivez votre question, problème ou suggestion en détail..."
          className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${
            formErrors.message ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:border-violet-500 focus:ring-violet-100"
          } bg-white text-gray-900 focus:outline-none focus:ring-3 transition-all resize-y`}
        />
        {formErrors.message && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {formErrors.message}
          </p>
        )}
      </div>

      {/* Bouton d'envoi */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all disabled:opacity-60 cursor-pointer shadow-xs"
        >
          {loading ? (
            <span>Envoi en cours...</span>
          ) : (
            <>
              <span>Envoyer le message</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
