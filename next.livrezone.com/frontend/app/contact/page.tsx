import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import ContactForm from "@/components/ContactForm";
import { Mail, MessageSquare, Clock, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Contactez-nous | LivreZone",
  description:
    "Contactez l'équipe d'assistance LivreZone pour toute question, signalement d'annonce, partenariat librairie ou problème technique.",
};

const WHATSAPP_URL = "https://wa.me/212711214131";
const PHONE_DISPLAY = "+212 7 11 21 41 31";

export default function ContactPage() {
  return (
    <InfoPage
      title="Contactez-nous"
      badge="Support & Écoute"
      description="Une question sur un livre, un signalement à effectuer ou une demande de partenariat ? Notre équipe est à votre écoute pour vous accompagner."
    >
      {/* Canaux de contact rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Email */}
        <div className="p-4 rounded-xl border border-gray-150 bg-gray-50/70 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Par email</h3>
            <a
              href="mailto:contact@livrezone.com"
              className="text-sm font-semibold text-violet-700 hover:underline block mt-0.5"
            >
              contact@livrezone.com
            </a>
          </div>
        </div>

        {/* WhatsApp & Téléphone */}
        <div className="p-4 rounded-xl border border-gray-150 bg-gray-50/70 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">WhatsApp & Téléphone</h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                {PHONE_DISPLAY}
              </a>
              <span className="text-xs text-gray-400 font-normal">(07 11 21 41 31)</span>
            </div>
          </div>
        </div>

        {/* Horaires & Délais */}
        <div className="p-4 rounded-xl border border-gray-150 bg-gray-50/70 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Délai de réponse</h3>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              Sous 24h à 48h ouvrées
            </p>
          </div>
        </div>
      </div>

      {/* Rappel modération / signalement urgent */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs sm:text-sm">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block mb-0.5">Vous souhaitez signaler un contenu non conforme ?</strong>
          <span>
            Si une annonce ou un commentaire enfreint la charte éthique (atteinte aux croyances, au Royaume, absence de pudeur), sélectionnez l&apos;objet « Signaler une annonce » ci-dessous en précisant le lien ou le titre du livre concerné.
          </span>
        </div>
      </div>

      {/* Formulaire de contact */}
      <section className="pt-2 space-y-4">
        <div className="border-b border-gray-150 pb-3">
          <h2 className="text-lg font-bold text-gray-900">Envoyez-nous un message</h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Remplissez ce formulaire et nous reviendrons vers vous au plus vite.
          </p>
        </div>
        <ContactForm />
      </section>
    </InfoPage>
  );
}