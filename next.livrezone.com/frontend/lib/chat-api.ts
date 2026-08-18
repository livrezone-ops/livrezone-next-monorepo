"use client";

import api from "./axios";

// ---------------------------------------------------------------------------
// Types alignés sur le backend Api\ChatController
// ---------------------------------------------------------------------------

export interface ChatUser {
  id: number;
  nickname: string;
  avatar?: string | null;
}

export interface ChatLastMessage {
  id: number;
  sender_id: number;
  message: string;
  created_at: string;
}

export interface ChatThread {
  id: number;
  other_user: ChatUser;
  last_message?: ChatLastMessage | null;
  last_message_at?: string | null;
  unread_count: number;
}

export interface ChatThreadListResponse {
  data: ChatThread[];
  total_unread: number;
}

export interface ChatMessage {
  id: number;
  chat_thread_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatThreadDetail {
  id: number;
  other_user: ChatUser;
  messages: ChatMessage[];
}

export interface ChatThreadDetailResponse {
  data: ChatThreadDetail;
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function listThreads(): Promise<ChatThreadListResponse> {
  const { data } = await api.get<ChatThreadListResponse>("/chat/threads");
  return data;
}

export async function getOrCreateThread(userId: number): Promise<{ id: number }> {
  const { data } = await api.post<{ data: { id: number } }>("/chat/threads", {
    user_id: userId,
  });
  return data.data;
}

export async function getThreadMessages(
  threadId: number,
  page = 1
): Promise<ChatThreadDetailResponse> {
  const { data } = await api.get<ChatThreadDetailResponse>(
    `/chat/threads/${threadId}`,
    { params: { page } }
  );
  return data;
}

export async function sendMessage(
  threadId: number,
  message: string
): Promise<ChatMessage> {
  const { data } = await api.post<{ data: ChatMessage }>(
    `/chat/threads/${threadId}/messages`,
    { message }
  );
  return data.data;
}

export async function deleteMessage(
  threadId: number,
  messageId: number
): Promise<void> {
  await api.post(`/chat/threads/${threadId}/messages/${messageId}/delete`);
}

export async function deleteThread(threadId: number): Promise<void> {
  await api.post(`/chat/threads/${threadId}/delete`);
}

export async function updateMessage(
  threadId: number,
  messageId: number,
  message: string
): Promise<ChatMessage> {
  const { data } = await api.post<{ data: ChatMessage }>(
    `/chat/threads/${threadId}/messages/${messageId}/update`,
    { message }
  );
  return data.data;
}

export async function markThreadAsRead(threadId: number): Promise<void> {
  await api.post(`/chat/threads/${threadId}/read`);
}