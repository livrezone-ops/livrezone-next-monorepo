"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listThreads,
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  updateMessage,
  deleteMessage,
  deleteThread,
  type ChatThread,
  type ChatMessage,
} from "@/lib/chat-api";
import { subscribeToThread } from "@/lib/chat-realtime";
import { playMessageSound } from "@/lib/chat-sounds";
import { setChatActive } from "@/lib/chat-active";
import { useAuth } from "@/hooks/useAuth";
import { useToasts } from "@/hooks/useToasts";
import Toast from "@/components/Toast";

function getImageUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://api-next.livrezone.com${url}`;
}

function initials(nickname: string): string {
  return (nickname || "?").charAt(0).toUpperCase();
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 24 * 60 * 60 * 1000) {
    return formatTime(iso);
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

interface ChatThreadDetailCache {
  data: {
    messages: ChatMessage[];
    [key: string]: unknown;
  };
}

export default function ChatClient() {
  const { user } = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts();
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const threadFromUrl = searchParams.get("thread");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(() => {
    const n = threadFromUrl ? Number(threadFromUrl) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Liste des fils (rafraîchie toutes les 30s en fallback du temps réel).
  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ["chat", "threads"],
    queryFn: listThreads,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const threads = threadsData?.data ?? [];
  const totalUnread = threadsData?.total_unread ?? 0;

  // Détail du fil sélectionné (avec repli temps réel : refetch périodique).
  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ["chat", "thread", selectedThreadId],
    queryFn: () => getThreadMessages(selectedThreadId!),
    enabled: !!selectedThreadId,
    refetchInterval: 8000,
  });
  const messages = detail?.data.messages ?? [];
  const otherUser = detail?.data.other_user;

  // Prévenir le Header qu'une conversation est ouverte (masque la pastille non lus).
  useEffect(() => {
    setChatActive(!!selectedThreadId);
    return () => setChatActive(false);
  }, [selectedThreadId]);

  // Marquage lu à l'ouverture d'un fil avec non-lus.
  useEffect(() => {
    if (!selectedThreadId) return;
    const thread = (threads as ChatThread[]).find(
      (t) => t.id === selectedThreadId
    );
    if (thread && thread.unread_count > 0) {
      markThreadAsRead(selectedThreadId)
        .catch(() => {})
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  // À l'ouverture d'un fil, on repart du bas (sans jamais faire défiler la page).
  useEffect(() => {
    atBottomRef.current = true;
    scrollToBottom();
  }, [selectedThreadId, scrollToBottom]);

  // Scroll du conteneur de messages (jamais la page entière) quand un message arrive.
  useEffect(() => {
    if (atBottomRef.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Temps réel : réception / modification / suppression d'un message live.
  useEffect(() => {
    if (!selectedThreadId) return;
    const cleanup = subscribeToThread(selectedThreadId, {
      onMessage: (data: ChatMessage) => {
        playMessageSound("received");
        queryClient.setQueryData(
          ["chat", "thread", selectedThreadId],
          (prev: ChatThreadDetailCache | undefined) => {
            if (!prev) return prev;
            const exists = (prev.data.messages ?? []).some(
              (m) => m.id === data.id
            );
            if (exists) return prev;
            return {
              ...prev,
              data: { ...prev.data, messages: [...prev.data.messages, data] },
            };
          }
        );
        queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
      },
      onUpdated: (data) => {
        queryClient.setQueryData(
          ["chat", "thread", selectedThreadId],
          (prev: ChatThreadDetailCache | undefined) => {
            if (!prev) return prev;
            return {
              ...prev,
              data: {
                ...prev.data,
                messages: prev.data.messages.map((m) =>
                  m.id === data.id
                    ? { ...m, message: data.message, updated_at: data.updated_at }
                    : m
                ),
              },
            };
          }
        );
        queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
      },
      onDeleted: (data) => {
        queryClient.setQueryData(
          ["chat", "thread", selectedThreadId],
          (prev: ChatThreadDetailCache | undefined) => {
            if (!prev) return prev;
            return {
              ...prev,
              data: {
                ...prev.data,
                messages: prev.data.messages.filter((m) => m.id !== data.id),
              },
            };
          }
        );
        queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
      },
    });
    return cleanup;
  }, [selectedThreadId, queryClient]);

  // Envoi d'un message (texte passé en variable).
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      await sendMessage(selectedThreadId!, text);
      return text;
    },
    onMutate: async (text: string) => {
      const threadId = selectedThreadId!;
      queryClient.setQueryData(
        ["chat", "thread", threadId],
        (prev: ChatThreadDetailCache | undefined) => {
          if (!prev) return prev;
          const optimistic: ChatMessage = {
            id: -Date.now(),
            chat_thread_id: threadId,
            sender_id: user?.id ?? 0,
            message: text,
            is_read: false,
            read_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return {
            ...prev,
            data: { ...prev.data, messages: [...prev.data.messages, optimistic] },
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
      setDraft("");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["chat", "thread", selectedThreadId],
      });
    },
    onSuccess: () => {
      playMessageSound("sent");
    },
    onError: () => {
      pushToast("Echec de l'envoi du message.", "error");
    },
  });

  // Modification d'un message (auteur uniquement).
  const updateMutation = useMutation({
    mutationFn: (messageId: number) =>
      updateMessage(selectedThreadId!, messageId, editText.trim()),
    onMutate: (messageId: number) => {
      const threadId = selectedThreadId!;
      queryClient.setQueryData(
        ["chat", "thread", threadId],
        (prev: ChatThreadDetailCache | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              messages: prev.data.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      message: editText.trim(),
                      updated_at: new Date().toISOString(),
                    }
                  : m
              ),
            },
          };
        }
      );
    },
    onSuccess: () => {
      setEditingId(null);
      setEditText("");
      queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
    },
    onError: () => {
      pushToast("Échec de la modification du message.", "error");
    },
  });

  // Suppression d'un message (auteur uniquement).
  const deleteMutation = useMutation({
    mutationFn: (messageId: number) =>
      deleteMessage(selectedThreadId!, messageId),
    onMutate: (messageId: number) => {
      const threadId = selectedThreadId!;
      queryClient.setQueryData(
        ["chat", "thread", threadId],
        (prev: ChatThreadDetailCache | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              messages: prev.data.messages.filter((m) => m.id !== messageId),
            },
          };
        }
      );
    },
    onError: () => {
      pushToast("Échec de la suppression du message.", "error");
      queryClient.invalidateQueries({
        queryKey: ["chat", "thread", selectedThreadId],
      });
    },
  });

  // Suppression d'une conversation entière.
  const deleteThreadMutation = useMutation({
    mutationFn: (threadId: number) => deleteThread(threadId),
    onMutate: (threadId: number) => {
      setSelectedThreadId((cur) => (cur === threadId ? null : cur));
      queryClient.setQueryData(
        ["chat", "threads"],
        (prev: { data: ChatThread[]; total_unread: number } | undefined) => {
          if (!prev) return prev;
          const data = prev.data.filter((t) => t.id !== threadId);
          return { ...prev, data };
        }
      );
    },
    onError: () => {
      pushToast("Échec de la suppression de la conversation.", "error");
      queryClient.invalidateQueries({ queryKey: ["chat", "threads"] });
    },
  });

  const handleDeleteThread = (threadId: number) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Supprimer cette conversation ? Tous les messages seront perdus."
      )
    ) {
      return;
    }
    deleteThreadMutation.mutate(threadId);
  };

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || !selectedThreadId) return;
      sendMutation.mutate(text);
    },
    [draft, selectedThreadId, sendMutation]
  );

  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditText(msg.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleDelete = (msg: ChatMessage) => {
    if (typeof window !== "undefined" && !window.confirm("Supprimer ce message ?")) {
      return;
    }
    deleteMutation.mutate(msg.id);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Toast toasts={toasts} dismiss={dismissToast} />

      <h1 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-[#6D28D9]" />
        Ma messagerie
        {totalUnread > 0 && (
          <span className="bg-[#6D28D9] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            {totalUnread} non lu(s)
          </span>
        )}
      </h1>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex min-h-[560px]">
        {/* COLONNE LISTE DES FILS (rail d'avatars en mobile, liste complète en desktop) */}
        <div className="w-[76px] lg:w-[320px] shrink-0 border-r border-gray-100">
          <div className="hidden lg:block px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[13px] font-bold text-gray-900">Conversations</p>
          </div>

          {threadsLoading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!threadsLoading && threads.length === 0 && (
            <div className="py-10 flex lg:flex-col items-center justify-center px-4 text-center">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-0 lg:mb-3" />
              <p className="hidden lg:block text-sm text-gray-500">
                Aucune conversation pour le moment.
              </p>
              <p className="hidden lg:block text-xs text-gray-400 mt-1">
                Contactez un vendeur pour démarrer une discussion.
              </p>
            </div>
          )}

          <ul className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
            {threads.map((thread) => {
              const selected = thread.id === selectedThreadId;
              return (
                <li key={thread.id}>
                  <div
                    className={`flex items-stretch group transition-colors ${
                      selected ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`flex-1 min-w-0 text-left py-3 pl-2 pr-1 lg:px-4 flex items-center justify-center lg:justify-start gap-3 cursor-pointer ${
                        selected
                          ? "border-l-4 border-l-[#6D28D9]"
                          : "border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {getImageUrl(thread.other_user.avatar) ? (
                          <img
                            src={getImageUrl(thread.other_user.avatar) as string}
                            alt=""
                            className="w-10 h-10 lg:w-11 lg:h-11 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold">
                            {initials(thread.other_user.nickname)}
                          </div>
                        )}
                        {thread.unread_count > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="hidden lg:block min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-gray-900 truncate">
                          {thread.other_user.nickname}
                        </p>
                        <p
                          className={`text-[12px] truncate ${
                            thread.unread_count > 0
                              ? "text-gray-900 font-semibold"
                              : "text-gray-500"
                          }`}
                        >
                          {thread.last_message?.message ?? "Nouvelle conversation"}
                        </p>
                      </div>
                    </button>
                    <div className="hidden lg:flex flex-col items-end gap-1 pr-3 flex-shrink-0">
                      {thread.last_message_at && (
                        <span className="text-[10px] text-gray-400">
                          {formatDate(thread.last_message_at)}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteThread(thread.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        aria-label="Supprimer la conversation"
                        title="Supprimer la conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* PANNEAU CONVERSATION */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedThreadId ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  Sélectionnez une conversation
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* En-tête interlocuteur */}
              <div className="px-3 lg:px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
                {otherUser && (
                  <div className="flex items-center gap-3 min-w-0">
                    {getImageUrl(otherUser.avatar) ? (
                      <img
                        src={getImageUrl(otherUser.avatar) as string}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold">
                        {initials(otherUser.nickname)}
                      </div>
                    )}
                    <span className="text-[13px] font-bold text-gray-900 truncate">
                      {otherUser.nickname}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleDeleteThread(selectedThreadId as number)}
                  className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  aria-label="Supprimer la conversation"
                  title="Supprimer la conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-5 space-y-2 max-h-[460px] min-h-[360px] bg-gray-50/30"
              >
                {detailLoading && (
                  <div className="flex items-center justify-center py-10 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {!detailLoading &&
                  messages.map((msg) => {
                    const mine = msg.sender_id === (user?.id ?? -1);
                    const isEditing = editingId === msg.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {isEditing ? (
                          <div className="w-full max-w-[85%] flex flex-col gap-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  if (editText.trim())
                                    updateMutation.mutate(msg.id);
                                }
                                if (e.key === "Escape") cancelEdit();
                              }}
                              rows={2}
                              className="w-full resize-none border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#6D28D9] text-gray-900"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-[12px] px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                disabled={!editText.trim() || updateMutation.isPending}
                                onClick={() => updateMutation.mutate(msg.id)}
                                className="text-[12px] px-3 py-1 rounded-lg bg-[#6D28D9] text-white disabled:opacity-40 hover:opacity-95 cursor-pointer"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`group relative max-w-[75%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed ${
                              mine
                                ? "bg-[#6D28D9] text-white rounded-br-md"
                                : "bg-white border border-gray-100 text-gray-800 rounded-bl-md"
                            }`}
                          >
                            <p className="break-words whitespace-pre-wrap">
                              {msg.message}
                            </p>
                            <p
                              className={`text-[10px] mt-1 ${
                                mine ? "text-violet-200" : "text-gray-400"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                              {mine && (
                                <span className="ml-1">
                                  {msg.is_read ? "· lu" : "· envoyé"}
                                </span>
                              )}
                            </p>
                            {mine && (
                              <div className="absolute -bottom-7 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => startEdit(msg)}
                                  aria-label="Modifier"
                                  className="p-1 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-[#6D28D9] shadow-sm cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(msg)}
                                  aria-label="Supprimer"
                                  className="p-1 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-red-600 shadow-sm cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Saisie */}
              <form
                onSubmit={handleSend}
                className="px-4 py-3 border-t border-gray-100 flex items-center gap-2"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  rows={1}
                  placeholder="Écrire un message…"
                  className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#6D28D9] text-gray-900"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#6D28D9] text-white flex items-center justify-center hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-40"
                  aria-label="Envoyer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
