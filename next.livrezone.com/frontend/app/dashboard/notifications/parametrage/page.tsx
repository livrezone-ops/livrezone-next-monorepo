"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  BellRing,
  Check,
  Copy,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Settings2,
  Tag,
  Unlink,
} from "lucide-react";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications";

// Toggle : composant stable défini au niveau module (jamais recréé à chaque
// rendu — règle React Compiler "Cannot create components during render").
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${checked ? "bg-[#6D28D9]" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// Toast : composant stable défini au niveau module (règle React Compiler).
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-gray-900 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg">
      {message}
    </div>
  );
}

interface ChannelRow {
  key: string;
  label: string;
  description: string;
}

// Canaux EXTERNES (S1) : uniquement email / telegram / whatsapp. Les
// notifications internes de la plateforme sont toujours actives (jamais
// affichées ici) et la messagerie interne (chat) n'est pas un canal.
const CHANNELS: ChannelRow[] = [
  { key: "email", label: "Email", description: "Résumés et alertes sur votre adresse e-mail." },
  { key: "telegram", label: "Telegram", description: "Alertes instantanées via le bot LivreZone (voir la section ci-dessous)." },
  { key: "whatsapp", label: "WhatsApp", description: "Alerte quand un livre que vous cherchez est mis en vente. Nécessite un numéro de mobile dans votre profil." },
];

// Types de notifications (S2) : miroir du registre backend
// NotificationTypeService. Pour ajouter un type : entrée backend + une ligne
// ici (le libellé retombe sur la clé technique si absent du miroir).
const TYPE_DESCRIPTIONS: Record<string, string> = {
  book_orders: "Nouvelles demandes de livres et disponibilité de vos recherches.",
  messages: "Réponses et échanges sur vos annonces et demandes.",
  newsletter: "Nos nouveautés et conseils de lecture.",
  promos: "Offres exclusives de nos libraires.",
  site_updates: "Évolutions et maintenance de la plateforme.",
  features: "Découverte des nouvelles fonctionnalités LivreZone.",
};

export default function NotificationSettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [channels, setChannels] = useState<Record<string, boolean>>({ email: true, telegram: true, whatsapp: true });
  const [types, setTypes] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Éligibilité Telegram selon l'abonnement (calculée côté API) :
  // Premium toujours, Pro si toggle admin, Free jamais.
  const [telegramAllowed, setTelegramAllowed] = useState(true);
  const [telegramMention, setTelegramMention] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Chargement du paramétrage courant (setState uniquement dans les callbacks
  // asynchrones — règle react-hooks/set-state-in-effect en "error").
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    api.get("/profile/notifications")
      .then(({ data }) => {
        if (!active) return;
        setChannels(data.channels ?? { email: true, telegram: true, whatsapp: true });
        setTypes(data.types ?? {});
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setTelegramAllowed(data.telegram_allowed ?? true);
        setTelegramMention(data.telegram_mention ?? null);
        setLoaded(true);
      })
      .catch((e) => console.error("Erreur:", e));
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // Catégories parent disponibles (endpoint déjà consommé par le front).
  const { data: refData } = useQuery<{ parent_categories: { id: number; name_fr: string }[] }>({
    queryKey: ["referenceData"],
    queryFn: async () => {
      const { data } = await api.get("/reference-data");
      return data;
    },
    enabled: isAuthenticated,
  });

  // --- Section 3 : Telegram (connexion / état / déconnexion) ---
  const {
    data: telegram,
    refetch: refetchTelegram,
    isFetching: telegramLoading,
  } = useQuery<{ linked: boolean; deep_link?: string; token_expires_at?: string }>({
    queryKey: ["telegramLink"],
    queryFn: async () => {
      const { data } = await api.get("/profile/telegram/link");
      return data;
    },
    enabled: isAuthenticated,
  });

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const generateTelegramLink = async () => {
    try {
      await refetchTelegram();
    } catch (e) {
      console.error("Erreur Telegram:", e);
    }
  };

  const unlinkTelegram = async () => {
    try {
      await api.post("/profile/telegram/unlink");
      await refetchTelegram();
      showToast("Compte Telegram délié.");
    } catch (e) {
      console.error("Erreur:", e);
      showToast("Erreur lors de la déconnexion Telegram.");
    }
  };

  const copyLink = () => {
    if (telegram?.deep_link) {
      navigator.clipboard?.writeText(telegram.deep_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleChannel = (key: string) => {
    if (key === "telegram" && !telegramAllowed) return; // canal verrouillé par l'abonnement
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleType = (key: string) => setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleCategory = (id: number) =>
    setCategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.post("/profile/notifications", {
        channels: telegramAllowed ? channels : { ...channels, telegram: false },
        types,
        categories,
      });
      queryClient.invalidateQueries({ queryKey: ["notificationSettings"] });
      showToast("Paramètres de notification sauvegardés !");
    } catch (e) {
      console.error("Erreur sauvegarde:", e);
      showToast("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !isAuthenticated || !loaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/dashboard/notifications" className="text-xs font-bold text-[#6D28D9] hover:text-violet-800 flex items-center gap-1 mb-3">
          ← Retour aux notifications
        </Link>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-[#6D28D9]" /> Paramétrage des notifications
        </h1>
        <p className="text-sm text-gray-500 mt-1">Choisissez comment et pour quoi vous souhaitez être alerté.</p>
      </div>

      <div className="space-y-6">
        {/* ===== Section 1 : Canaux de notification ===== */}
        <section className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Canaux de notification</h2>
          <p className="text-sm text-gray-500 mb-5">Par quels canaux externes souhaitez-vous être alerté ?</p>

          <div className="space-y-4">
            {CHANNELS.map((ch) => {
              const locked = ch.key === "telegram" && !telegramAllowed;
              return (
                <div
                  key={ch.key}
                  className={`flex items-start justify-between gap-4 pb-4 last:pb-0 border-b border-gray-100 last:border-0 ${locked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${locked ? "bg-gray-100" : "bg-violet-50"}`}>
                      {ch.key === "email" && <Mail className="w-4.5 h-4.5 text-[#6D28D9]" />}
                      {ch.key === "telegram" && <Send className={`w-4.5 h-4.5 ${locked ? "text-gray-400" : "text-[#6D28D9]"}`} />}
                      {ch.key === "whatsapp" && <MessageCircle className="w-4.5 h-4.5 text-[#6D28D9]" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{ch.label}</p>
                      <p className="text-xs text-gray-500">
                        {ch.key === "telegram" && telegramMention ? telegramMention : ch.description}
                      </p>
                    </div>
                  </div>
                  <div className={locked ? "cursor-not-allowed" : ""}>
                    <Toggle checked={!!channels[ch.key]} onChange={() => toggleChannel(ch.key)} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== Section 2 : Types de notifications à recevoir ===== */}
        <section className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Types de notifications à recevoir</h2>
          <p className="text-sm text-gray-500 mb-5">Quelles notifications souhaitez-vous recevoir ?</p>

          <div className="space-y-4">
            {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-start justify-between gap-4 pb-4 last:pb-0 border-b border-gray-100 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    {key === "book_orders" && <BellRing className="w-4.5 h-4.5 text-[#6D28D9]" />}
                    {key === "newsletter" && <Bell className="w-4.5 h-4.5 text-[#6D28D9]" />}
                    {key === "promos" && <Tag className="w-4.5 h-4.5 text-[#6D28D9]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{TYPE_DESCRIPTIONS[key] ?? ""}</p>
                  </div>
                </div>
                <Toggle checked={types[key] ?? true} onChange={() => toggleType(key)} />
              </div>
            ))}
          </div>

          {/* Catégories parent / centres d'intérêt */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Centres d&apos;intérêt (catégories parent)</h3>
            <p className="text-xs text-gray-500 mb-3">
              Reçevez uniquement les alertes de demandes concernant les catégories qui vous intéressent. Aucune sélection = toutes les catégories.
            </p>
            {refData?.parent_categories?.length ? (
              <div className="flex flex-wrap gap-2">
                {refData.parent_categories.map((c) => {
                  const selected = categories.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCategory(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                        selected
                          ? "bg-[#6D28D9] border-[#6D28D9] text-white"
                          : "bg-white border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-700"
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
                      {c.name_fr}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Catégories indisponibles pour le moment.</p>
            )}
          </div>
        </section>

        {/* ===== Section 3 : Paramétrage Telegram ===== */}
        <section className="bg-white rounded-xl border border-gray-150 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Telegram</h2>
          <p className="text-sm text-gray-500 mb-5">
            Connectez votre compte pour recevoir vos notifications en direct via le bot LivreZone.
          </p>

          <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Send className="w-4.5 h-4.5 text-[#6D28D9]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  État de connexion :{" "}
                  {telegramLoading ? (
                    <span className="text-gray-400">vérification…</span>
                  ) : telegram?.linked ? (
                    <span className="text-green-600">connecté</span>
                  ) : (
                    <span className="text-red-500">non connecté</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {telegram?.linked
                    ? "Votre compte Telegram est lié à LivreZone. Vous recevez les alertes sur ce canal."
                    : "Générez un lien, ouvrez-le dans Telegram puis appuyez sur « Démarrer » pour associer votre compte."}
                </p>
              </div>
            </div>
            {telegram?.linked ? (
              <button
                onClick={unlinkTelegram}
                disabled={!telegramAllowed}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors shrink-0 ${
                  telegramAllowed
                    ? "border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
                    : "border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Unlink className="w-4 h-4" /> Déconnecter
              </button>
            ) : telegramAllowed ? (
              <button
                onClick={generateTelegramLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6D28D9] text-white text-xs font-bold hover:bg-violet-800 transition-colors shrink-0 cursor-pointer"
              >
                <Link2 className="w-4 h-4" /> {telegram?.deep_link ? "Régénérer le lien" : "Connecter"}
              </button>
            ) : (
              <span className="text-xs text-gray-400 font-bold shrink-0 max-w-[180px] text-right">
                {telegramMention ?? "Canal indisponible avec votre abonnement."}
              </span>
            )}
          </div>

          {!telegram?.linked && telegram?.deep_link && telegramAllowed && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-2">
                Lien de connexion valable 30 minutes :
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 break-all text-gray-700">
                  {telegram.deep_link}
                </code>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:text-violet-700 hover:border-violet-200 transition-colors cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Sauvegarde (sections 1 & 2) */}
        <div className="flex justify-end pt-2">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#6D28D9] text-white rounded-xl text-sm font-bold hover:bg-violet-800 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer les préférences
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}