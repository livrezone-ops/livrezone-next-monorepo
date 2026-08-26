"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./axios";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoreListing {
  id: number;
  title: string;
  price?: number | null;
  discountPrice?: number | null;
  cover?: string | null;
  coverThumb?: string | null;
  isbn?: string | null;
  user_id?: number | null;
  sellerNickname?: string | null;
  sellerPhone?: string | null;
  city?: string | null;
  availableQuantity?: number | null;
  status?: string | null;
  available?: boolean;
}

export interface CartLine {
  listingId: number;
  quantity: number;
  listing: StoreListing;
}

export interface CartSellerGroup {
  seller: {
    id: number;
    nickname: string;
    city?: string | null;
    phone?: string | null;
  } | null;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
}

type GuestModalType = "cart" | "wishlist";

// Forme persistée dans localStorage (avec TTL).
interface PersistedLine {
  listingId: number;
  quantity: number;
  listing: StoreListing;
  addedAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Constantes & utilitaires
// ---------------------------------------------------------------------------

const TTL_MS = 24 * 60 * 60 * 1000; // 24 heures
const WS_KEY = "livrezone_wishlist_v1";
const CT_KEY = "livrezone_cart_v1";

function now(): number {
  return Date.now();
}

function normalizeListing(l: StoreListing): StoreListing {
  return {
    id: l.id,
    title: l.title,
    price: l.price ?? null,
    discountPrice: l.discountPrice ?? null,
    cover: l.cover ?? null,
    coverThumb: l.coverThumb ?? null,
    isbn: l.isbn ?? null,
    user_id: l.user_id ?? null,
    sellerNickname: l.sellerNickname ?? null,
    sellerPhone: l.sellerPhone ?? null,
    city: l.city ?? null,
    availableQuantity: l.availableQuantity ?? null,
    status: l.status ?? null,
    available: l.available ?? isListingAvailable(l),
  };
}

/**
 * Un listing est disponible si son statut est « published » et que le stock
 * restant est strictement positif (ou inconnu).
 */
export function isListingAvailable(l: Pick<StoreListing, "status" | "availableQuantity">): boolean {
  const statusOk = !l.status || l.status === "published";
  const stockOk =
    l.availableQuantity === null ||
    l.availableQuantity === undefined ||
    l.availableQuantity > 0;
  return statusOk && stockOk;
}

/**
 * Construit l'URL de la page détail d'un listing, cohérente avec la route
 * /{nickname}/{id}-{isbn}-{titre-slugifié} utilisée par l'application.
 */
export function buildListingUrl(l: Pick<StoreListing, "id" | "title" | "isbn" | "sellerNickname" | "user_id">): string {
  const nickname =
    l.sellerNickname || `utilisateur-${l.user_id ?? "x"}`;
  const isbn = l.isbn || "livre";
  const titleSlug = slugify(l.title);
  return `/${nickname}/${l.id}-${isbn}-${titleSlug}`;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function safeGet(key: string): PersistedLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PersistedLine[]) : [];
  } catch {
    return [];
  }
}

function safeSet(key: string, value: PersistedLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage saturé / désactivé : on ignore silencieusement
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Purge les éléments expirés (> 24h) ou mal formés. */
function pruneLines(lines: PersistedLine[]): PersistedLine[] {
  const t = now();
  return (lines || []).filter((line) => {
    if (!line || typeof line !== "object") return false;
    if (typeof line.addedAt !== "number") return false; // ancien format : purge
    const expires = typeof line.expiresAt === "number" ? line.expiresAt : line.addedAt + TTL_MS;
    return expires > t;
  });
}

// ---------------------------------------------------------------------------
// API (utilisateurs connectés)
// ---------------------------------------------------------------------------

interface RawWishlistItem {
  id: number;
  title: string;
  price?: number | null;
  discount_price?: number | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  cover_source_url?: string | null;
  isbn_13?: string | null;
  user_id?: number | null;
  quantity?: number | null;
  status?: string | null;
  user?: {
    profile?: {
      nickname?: string | null;
      phone?: string | null;
      city?: { name?: string | null } | null;
    } | null;
  } | null;
  book?: { isbn_13?: string | null } | null;
}

interface RawCartGroup {
  seller?: {
    id?: number;
    nickname?: string | null;
    city?: string | null;
  } | null;
  item_count?: number;
  subtotal?: number;
  items?: RawCartItem[];
}

interface RawCartItem {
  listing_id: number;
  quantity: number;
  listing?: {
    title?: string;
    price?: number | null;
    discount_price?: number | null;
    cover_url?: string | null;
    cover_thumbnail_url?: string | null;
    cover_source_url?: string | null;
    isbn_13?: string | null;
    quantity?: number | null;
    status?: string | null;
    user?: {
      profile?: {
        nickname?: string | null;
        phone?: string | null;
        city?: { name?: string | null } | null;
      } | null;
    } | null;
    book?: { isbn_13?: string | null } | null;
  } | null;
}

async function fetchWishlist(): Promise<StoreListing[]> {
  const { data } = await api.get("/wishlist");
  const list = Array.isArray(data.data) ? (data.data as RawWishlistItem[]) : [];
  return list
    .map(
      (l): StoreListing => {
        const base: StoreListing = {
          id: l.id,
          title: l.title,
          price: l.price,
          discountPrice: l.discount_price ?? null,
          cover: l.cover_url || l.cover_source_url || null,
          coverThumb: l.cover_thumbnail_url || l.cover_url || null,
          isbn: l.isbn_13 || l.book?.isbn_13 || null,
          user_id: l.user_id,
          sellerNickname: l.user?.profile?.nickname || `utilisateur-${l.user_id}`,
          sellerPhone: l.user?.profile?.phone ?? null,
          city: l.user?.profile?.city?.name ?? null,
          availableQuantity: l.quantity ?? null,
          status: l.status ?? null,
        };
        return { ...base, available: isListingAvailable(base) };
      }
    );
}

async function fetchCart(): Promise<CartSellerGroup[]> {
  const { data } = await api.get("/cart");
  const groups = Array.isArray(data.data) ? (data.data as RawCartGroup[]) : [];
  return groups.map(
    (g): CartSellerGroup => ({
      seller: g.seller
        ? {
            id: g.seller.id ?? 0,
            nickname: g.seller.nickname ?? "Vendeur LivreZone",
            city: g.seller.city ?? null,
            phone:
              (g.items ?? []).find((i) => i.listing?.user?.profile?.phone)
                ?.listing?.user?.profile?.phone ?? null,
          }
        : null,
      items: (g.items ?? []).map(
        (item): CartLine => {
          const listingData = item.listing;
          const base: StoreListing = {
            id: item.listing_id,
            title: listingData?.title ?? "Annonce indisponible",
            price: listingData?.price,
            discountPrice: listingData?.discount_price ?? null,
            cover: listingData?.cover_url || listingData?.cover_source_url || null,
            coverThumb: listingData?.cover_thumbnail_url || listingData?.cover_url || null,
            isbn: listingData?.isbn_13 || listingData?.book?.isbn_13 || null,
            sellerNickname:
              listingData?.user?.profile?.nickname ||
              (g.seller?.nickname ?? null),
            sellerPhone: listingData?.user?.profile?.phone ?? null,
            city: listingData?.user?.profile?.city?.name ?? null,
            availableQuantity: listingData?.quantity ?? null,
            // Listing supprimé / introuvable côté serveur => indisponible.
            status: listingData ? (listingData.status ?? null) : "deleted",
          };
          return {
            listingId: item.listing_id,
            quantity: item.quantity,
            listing: { ...base, available: isListingAvailable(base) },
          };
        }
      ),
      itemCount: g.item_count ?? 0,
      subtotal: g.subtotal ?? 0,
    })
  );
}

// ---------------------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------------------

interface CommerceContextValue {
  wishlist: StoreListing[];
  cart: CartLine[];
  wishlistCount: number;
  cartCount: number;
  cartSellers: CartSellerGroup[];
  isInWishlist: (listingId: number) => boolean;
  toggleWishlist: (listing: StoreListing) => void;
  addToCart: (listing: StoreListing, quantity?: number) => boolean;
  removeFromCart: (listingId: number) => void;
  updateCartQuantity: (listingId: number, quantity: number) => void;
  isInCart: (listingId: number) => boolean;
  cartQuantity: (listingId: number) => number;
  guestModalOpen: boolean;
  guestItem: StoreListing | null;
  guestModalType: GuestModalType | null;
  closeGuestModal: () => void;
  isAuthenticated: boolean;
}

const CommerceContext = createContext<CommerceContextValue | null>(null);

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isAuthenticated = !!authUser;

  const [wishlist, setWishlist] = useState<StoreListing[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [guestModal, setGuestModal] = useState<{
    open: boolean;
    item: StoreListing | null;
    type: GuestModalType | null;
  }>({ open: false, item: null, type: null });

  const mergedForUserId = useRef<number | null>(null);

  // Serveur : wishlist du compte connecté.
  const { data: serverWishlist } = useQuery<StoreListing[]>({
    queryKey: ["commerce", "wishlist"],
    queryFn: fetchWishlist,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  // Serveur : panier du compte connecté (groupé par vendeur).
  const { data: serverCart } = useQuery<CartSellerGroup[]>({
    queryKey: ["commerce", "cart"],
    queryFn: fetchCart,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  // Hydratation initiale depuis localStorage + purge des éléments > 24h.
  // Lecture d'un stockage externe au montage : modèle SSR-safe (rendu vide
  // côté serveur, puis rempli côté client) — exclusion légitime de la règle.
  useEffect(() => {
    const rawWishlist = pruneLines(safeGet(WS_KEY));
    const rawCart = pruneLines(safeGet(CT_KEY));

    setWishlist(
      rawWishlist
        .filter((l) => l.listingId && l.listing)
        .map((l) => normalizeListing(l.listing))
    );
    setCart(
      rawCart
        .filter((l) => l.listingId && l.listing)
        .map((l) => ({
          listingId: l.listingId,
          quantity: l.quantity,
          listing: normalizeListing(l.listing),
        }))
    );
  }, []);

  // Persistance guest (TTL 24h sur chaque élément).
  // Uniquement hors connexion : quand l'utilisateur est connecté, le serveur
  // est la source de vérité et on ne réécrit jamais localStorage (sinon un
  // refresh re-fusionnerait les quantités et les ferait doubler).
  // Les timestamps originaux sont préservés pour conserver un vrai TTL de 24h.
  useEffect(() => {
    if (isAuthenticated) return;
    const existing = new Map(
      safeGet(WS_KEY).map((l) => [l.listingId, l])
    );
    const t = now();
    safeSet(
      WS_KEY,
      wishlist.map((l) => {
        const prev = existing.get(l.id);
        return {
          listingId: l.id,
          quantity: 1,
          listing: l,
          addedAt: prev?.addedAt ?? t,
          expiresAt: prev?.expiresAt ?? t + TTL_MS,
        };
      })
    );
  }, [wishlist, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    const existing = new Map(
      safeGet(CT_KEY).map((l) => [l.listingId, l])
    );
    const t = now();
    safeSet(
      CT_KEY,
      cart.map((l) => {
        const prev = existing.get(l.listingId);
        return {
          listingId: l.listingId,
          quantity: l.quantity,
          listing: l.listing,
          addedAt: prev?.addedAt ?? t,
          expiresAt: prev?.expiresAt ?? t + TTL_MS,
        };
      })
    );
  }, [cart, isAuthenticated]);

  // À la déconnexion : purge du stockage local du compte précédent.
  const prevAuthRef = useRef<boolean>(isAuthenticated);
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      safeRemove(WS_KEY);
      safeRemove(CT_KEY);
      setWishlist([]);
      setCart([]);
      mergedForUserId.current = null;
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Galerie des données serveur vers l'état local (mode connecté).
  useEffect(() => {
    if (!isAuthenticated || !serverWishlist) return;
    setWishlist(serverWishlist);
  }, [serverWishlist, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !serverCart) return;
    const lines: CartLine[] = [];
    for (const group of serverCart) {
      lines.push(...group.items);
    }
    setCart(lines);
  }, [serverCart, isAuthenticated]);

  // Fusion guest -> compte à la connexion, puis purge du stockage local.
  // Comportement en cas d'échec partiel :
  // - chaque clé (wishlist / cart) est purgée dès que son merge réussit ;
  // - une clé dont le merge échoue est CONSERVÉE dans le localStorage et sera
  //   ré-essayée au prochain chargement/connexion (retry automatique) ;
  // - on ne marque la fusion comme complète que lorsque les deux merges ont
  //   abouti (ou qu'il n'y avait rien à fusionner).
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!authUser) return;
    if (mergedForUserId.current === authUser.id) return;

    const doMerge = async () => {
      const localWishlist = pruneLines(safeGet(WS_KEY));
      const localCart = pruneLines(safeGet(CT_KEY));

      const wishlistIds = localWishlist.map((l) => l.listingId);
      const cartItems = localCart
        .filter((l) => l.quantity > 0)
        .map((l) => ({ listing_id: l.listingId, quantity: l.quantity }));

      let wishlistOk = wishlistIds.length === 0;
      let cartOk = cartItems.length === 0;

      if (wishlistIds.length > 0) {
        try {
          await api.post("/wishlist/merge", { listing_ids: wishlistIds });
          wishlistOk = true;
        } catch {
          // échec : clé conservée pour retry au prochain chargement
        }
      }
      if (cartItems.length > 0) {
        try {
          await api.post("/cart/merge", { items: cartItems });
          cartOk = true;
        } catch {
          // échec : clé conservée pour retry au prochain chargement
        }
      }

      if (wishlistOk) safeRemove(WS_KEY);
      if (cartOk) safeRemove(CT_KEY);

      if (wishlistOk && cartOk) {
        setWishlist([]);
        setCart([]);
        mergedForUserId.current = authUser.id;
        queryClient.invalidateQueries({ queryKey: ["commerce"] });
      }
    };

    void doMerge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser?.id]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const toggleWishlist = useCallback(
    (listing: StoreListing) => {
      setWishlist((prev) => {
        const exists = prev.some((i) => i.id === listing.id);
        let next: StoreListing[];
        if (exists) {
          next = prev.filter((i) => i.id !== listing.id);
          showToast("Article retiré de vos favoris", "info");
          if (isAuthenticated) {
            void api
              .delete("/wishlist", { params: { listing_id: listing.id } })
              .catch(() => {});
          }
        } else {
          next = [...prev, normalizeListing(listing)];
          showToast("Article ajouté à vos favoris !", "success");
          if (isAuthenticated) {
            void api
              .post("/wishlist", { listing_id: listing.id })
              .catch(() => {});
          } else {
            setGuestModal((m) =>
              m.open ? m : { open: true, item: listing, type: "wishlist" }
            );
          }
        }
        return next;
      });
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["commerce"] });
      }
    },
    [isAuthenticated, queryClient, showToast]
  );

  const addToCart = useCallback(
    (listing: StoreListing, quantity = 1): boolean => {
      // Si l'article est déjà dans le panier, on n'ajoute rien :
      // la quantité se gère exclusivement depuis la page panier.
      if (cart.some((i) => i.listingId === listing.id)) {
        showToast("Cet article est déjà dans votre panier", "info");
        return false;
      }

      const maxQty = Math.min(
        listing.availableQuantity && listing.availableQuantity > 0
          ? listing.availableQuantity
          : 99,
        99
      );
      const qty = Math.max(1, Math.min(maxQty, Math.floor(quantity)));
      setCart((prev) => [
        ...prev,
        { listingId: listing.id, listing: normalizeListing(listing), quantity: qty },
      ]);
      showToast("Article ajouté à votre panier !", "success");

      if (isAuthenticated) {
        void api
          .post("/cart", { listing_id: listing.id, quantity: qty })
          .catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["commerce"] });
      } else {
        setGuestModal((m) =>
          m.open ? m : { open: true, item: listing, type: "cart" }
        );
      }

      return true;
    },
    [isAuthenticated, queryClient, cart, showToast]
  );

  const removeFromCart = useCallback(
    (listingId: number) => {
      setCart((prev) => prev.filter((i) => i.listingId !== listingId));
      showToast("Article retiré du panier", "info");
      if (isAuthenticated) {
        void api
          .delete("/cart", { params: { listing_id: listingId } })
          .catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["commerce"] });
      }
    },
    [isAuthenticated, queryClient, showToast]
  );

  const updateCartQuantity = useCallback(
    (listingId: number, quantity: number) => {
      const current = cart.find((i) => i.listingId === listingId);
      const maxQty = Math.min(
        current?.listing.availableQuantity &&
          current.listing.availableQuantity > 0
          ? current.listing.availableQuantity
          : 99,
        99
      );
      const qty = Math.max(1, Math.min(maxQty, Math.floor(quantity)));
      setCart((prev) =>
        prev.map((i) => (i.listingId === listingId ? { ...i, quantity: qty } : i))
      );
      if (isAuthenticated) {
        void api
          .put("/cart", { listing_id: listingId, quantity: qty })
          .catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["commerce"] });
      }
    },
    [isAuthenticated, queryClient, cart]
  );

  const closeGuestModal = useCallback(() => {
    setGuestModal({ open: false, item: null, type: null });
  }, []);

  // -------------------------------------------------------------------------
  // Dérivés
  // -------------------------------------------------------------------------

  const value = useMemo<CommerceContextValue>(() => {
    const cartSellers: CartSellerGroup[] = (() => {
      const groups = new Map<string, { seller: CartSellerGroup["seller"]; items: CartLine[] }>();
      for (const line of cart) {
        const uid = line.listing.user_id ?? null;
        const key = `U${uid ?? "guest"}`;
        let entry = groups.get(key);
        if (!entry) {
          entry = {
            seller: {
              id: uid ?? 0,
              nickname:
                line.listing.sellerNickname ??
                (uid ? `utilisateur-${uid}` : "Vendeur LivreZone"),
              city: line.listing.city ?? null,
              phone: line.listing.sellerPhone ?? null,
            },
            items: [],
          };
          groups.set(key, entry);
        }
        entry.items.push(line);
      }
      return Array.from(groups.values()).map((g) => ({
        seller: g.seller,
        items: g.items,
        itemCount: g.items.reduce((s, i) => s + i.quantity, 0),
        subtotal: g.items.reduce(
          (s, i) =>
            s + Number(i.listing.discountPrice ?? i.listing.price ?? 0) * i.quantity,
          0
        ),
      }));
    })();

    return {
      wishlist,
      cart,
      wishlistCount: wishlist.length,
      cartCount: cart.reduce((s, i) => s + i.quantity, 0),
      cartSellers,
      isInWishlist: (listingId: number) => wishlist.some((i) => i.id === listingId),
      toggleWishlist,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      isInCart: (listingId: number) => cart.some((i) => i.listingId === listingId),
      cartQuantity: (listingId: number) =>
        cart.find((i) => i.listingId === listingId)?.quantity ?? 0,
      guestModalOpen: guestModal.open,
      guestItem: guestModal.item,
      guestModalType: guestModal.type,
      closeGuestModal,
      isAuthenticated,
    };
  }, [
    wishlist,
    cart,
    toggleWishlist,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    guestModal,
    closeGuestModal,
    isAuthenticated,
  ]);

  return (
    <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
  );
}

export function useCommerce(): CommerceContextValue {
  const ctx = useContext(CommerceContext);
  if (!ctx) {
    throw new Error("useCommerce doit être utilisé sous <CommerceProvider>");
  }
  return ctx;
}