/**
 * Types de notifications in-app — miroir front du registre backend
 * (App\Services\NotificationTypeService, exposé via `meta.types`).
 *
 * Évolutivité : pour ajouter un type de notification, ajouter l'entrée côté
 * backend (registre) ET ici (libellé FR). Tout type renvoyé par l'API mais
 * absent de ce miroir est tout de même affiché (retombe sur la clé technique),
 * afin qu'aucune refonte front ne soit nécessaire.
 */
export interface NotificationTypeInfo {
  key: string;
  label: string;
}

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  book_orders: "Demandes",
  messages: "Messages",
  newsletter: "Newsletter",
  promos: "Promotions",
  site_updates: "Mises à jour du site",
  features: "Nouvelles fonctionnalités",
};

export const DEFAULT_NOTIFICATION_TYPES: NotificationTypeInfo[] = Object.entries(
  NOTIFICATION_TYPE_LABELS
).map(([key, label]) => ({ key, label }));

/**
 * Fusionne les types exposés par l'API (meta.types : clé => libellé) avec le
 * miroir front. Sans réponse API, retombe sur le miroir local.
 */
export function mergeNotificationTypes(
  metaTypes?: Record<string, string> | null
): NotificationTypeInfo[] {
  if (!metaTypes || Object.keys(metaTypes).length === 0) {
    return DEFAULT_NOTIFICATION_TYPES;
  }
  return Object.entries(metaTypes).map(([key, label]) => ({
    key,
    label: NOTIFICATION_TYPE_LABELS[key] ?? label,
  }));
}

export interface AppNotification {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  /** Date d'épinglage (null = non épinglée) — colonne ajoutée en V2. */
  pinned_at?: string | null;
}

export interface InboxMeta {
  current_page: number;
  last_page: number;
  total: number;
  unread_count: number;
  /** Registre des types filtrables (clé => libellé FR). */
  types?: Record<string, string>;
}

/**
 * Lien de consultation d'une notification (null = non cliquable).
 *
 * - Demande (book_orders) : ouvre la demande dans l'espace /demandes via la
 *   recherche par titre (la liste /demandes n'a pas de page détail par id) ;
 * - Autres : suit `data.link` s'il s'agit d'un chemin interne.
 */
/**
 * Clé métier du type de notification : stockée dans `data.type` à l'émission ;
 * retombe sur le champ `type` Laravel si absent (notification sans clé métier).
 */
export function notificationTypeKey(n: AppNotification): string {
  const data = n.data || {};
  return typeof data.type === "string" ? data.type : n.type;
}

/**
 * Libellé FR du type (miroir front) ; tout type inconnu retombe sur sa clé
 * technique afin de toujours afficher quelque chose d'exploitable.
 */
export function notificationTypeLabel(n: AppNotification): string {
  const key = notificationTypeKey(n);
  return NOTIFICATION_TYPE_LABELS[key] ?? key;
}

export function notificationHref(n: AppNotification): string | null {
  const data = n.data || {};
  // La clé métier est stockée dans data.type à l'émission ; le champ `type`
  // Laravel contient le nom de classe et n'est pas exploitable en l'état.
  const notifType = notificationTypeKey(n);
  if (notifType === "book_orders") {
    const title = typeof data.title === "string" ? data.title : "";
    return "/demandes" + (title ? `?search=${encodeURIComponent(title)}` : "");
  }
  const link = typeof data.link === "string" ? data.link : null;
  return link && link.startsWith("/") ? link : null;
}

export function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  // timeZone fixé pour un rendu identique serveur/client (hydratation).
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}
