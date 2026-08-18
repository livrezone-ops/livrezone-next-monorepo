"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, ChevronLeft, Loader2 } from "lucide-react";
import {
  listThreads,
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  type ChatThread,
  type ChatMessage,
} from "@/lib/chat-api";
import { subscribeToThread } from "@/lib/chat-realtime";
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Liste des fils (rafraîchie toutes les 30s en fallback du temps réel).
  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ["chat", "threads"],
    queryFn: listThreads,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const threads = threadsData?.data ?? [];
  const totalUnread = threadsData?.total_unread ?? 0;

  // Détail du fil sélectionné.
  const {
    data: detail,
    isLoading: detailLoading,
    isFetching: detailFetching,
  } = useQuery({
    queryKey: ["chat", "thread", selectedThreadId],
    queryFn: () => getThreadMessages(selectedThreadId!),
    enabled: !!selectedThreadId,
  });
  const messages = detail?.data.messages ?? [];
  const otherUser = detail?.data.other_user;

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

  // Scroll en bas à chaque nouveau message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Temps réel : réception d'un message live.
  useEffect(() => {
    if (!selectedThreadId) return;
    const cleanup = subscribeToThread(selectedThreadId, (data: ChatMessage) => {
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
    onError: () => {
      pushToast("Echec de l'envoi du message.", "error");
    },
  });

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || !selectedThreadId) return;
      sendMutation.mutate(text);
    },
    [draft, selectedThreadId, sendMutation]
  );

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

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden lg:grid lg:grid-cols-[320px_1fr] min-h-[560px]">
        {/* COLONNE LISTE DES FILS */}
        <div className="border-b lg:border-b-0 lg:border-r border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[13px] font-bold text-gray-900">Conversations</p>
          </div>

          {threadsLoading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!threadsLoading && threads.length === 0 && (
            <div className="py-10 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Aucune conversation pour le moment.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Contactez un vendeur pour démarrer une discussion.
              </p>
            </div>
          )}

          <ul className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
            {threads.map((thread) => {
              const selected = thread.id === selectedThreadId;
              return (
                <li key={thread.id}>
                  <button
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                      selected ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {getImageUrl(thread.other_user.avatar) ? (
                        <img
                          src={getImageUrl(thread.other_user.avatar) as string}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold">
                          {initials(thread.other_user.nickname)}
                        </div>
                      )}
                      {thread.unread_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-bold text-gray-900 truncate">
                          {thread.other_user.nickname}
                        </p>
                        {thread.last_message_at && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatDate(thread.last_message_at)}
                          </span>
                        )}
                      </div>
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
                </li>
              );
            })}
          </ul>
        </div>

        {/* PANNEAU CONVERSATION */}
        <div className="flex flex-col">
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
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
                <button
                  onClick={() => setSelectedThreadId(null)}
                  className="lg:hidden text-gray-500 hover:text-gray-900 p-1"
                  aria-label="Retour"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {otherUser && (
                  <div className="flex items-center gap-3">
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
                    <span className="text-[13px] font-bold text-gray-900">
                      {otherUser.nickname}
                    </span>
                  </div>
                )}
                {detailFetching && !detailLoading && (
                  <Loader2 className="h-4 w-4 text-gray-300 animate-spin ml-auto" />
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2 max-h-[460px] min-h-[360px] bg-gray-50/30">
                {detailLoading && (
                  <div className="flex items-center justify-center py-10 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {!detailLoading &&
                  messages.map((msg) => {
                    const mine = msg.sender_id === (user?.id ?? -1);
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed ${
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
                        </div>
                      </div>
                    );
                  })}
                <div ref={messagesEndRef} />
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

interface ChatThreadDetailCache {
  data: {
    messages: ChatMessage[];
    [key: string]: unknown;
  };
}