import { clearSession, getAccessToken, type AuthUser } from '@/lib/session';
import type { Conversation } from '@/lib/conversations';

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };
export type Citation = { name: string; page?: number | null };
export type Config = {
  chat_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  embedding_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  chat_model: string;
  embedding_model: string;
  temperature?: number;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  fallback_chat_provider?: string | null;
  fallback_chat_model?: string | null;
  // Simple mode fields
  ui_mode?: 'simple' | 'advanced' | string;
  preset?: 'qna' | 'summarize' | 'extract' | 'brainstorm' | 'compliance' | string;
  creativity?: 'precise' | 'balanced' | 'creative' | string;
  answer_length?: 'short' | 'medium' | 'long' | string;
  show_sources?: boolean;
  override_retrieval?: boolean;
  override_generation?: boolean;
};
export type DocumentItem = { document_id: string; name: string };
export type DocumentsList = { items: DocumentItem[] };
export type PermissionUser = { user_id: string; email: string; name?: string | null; auth?: string };
export type ChatResponse = { answer: string; citations?: Citation[]; used_prompt?: string; answer_id: string };
export type LoginResult = { access_token: string; token_type: string; user: AuthUser };

function shouldRedirectOn401() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return !(path.startsWith('/login') || path.startsWith('/register'));
}

function apiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  return base.replace(/\/$/, '');
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401 && shouldRedirectOn401()) {
      clearSession();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) message = Array.isArray(data.detail) ? data.detail[0]?.msg || message : data.detail;
      if (data?.error) message = data.error;
    } catch (_) {
      try { message = await res.text(); } catch (_) {}
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function getConfig(): Promise<Config> {
  return apiFetch<Config>(`/api/v1/config`, { cache: 'no-store' });
}

export async function updateConfig(payload: Partial<Config> & Pick<Config, 'chat_model'|'embedding_model'|'chunk_size'|'chunk_overlap'|'top_k'>): Promise<Config> {
  return apiFetch<Config>(`/api/v1/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export type ProvidersHealth = {
  chat: { provider: string; ok: boolean; error?: string; details?: string };
  embedding: { provider: string; ok: boolean; error?: string; details?: string };
};

export async function providerHealth(): Promise<ProvidersHealth> {
  return apiFetch<ProvidersHealth>(`/api/v1/providers/health`);
}

export async function listDocuments(): Promise<DocumentsList> {
  return apiFetch<DocumentsList>(`/api/v1/docs`, { cache: 'no-store' });
}

export async function deleteDocument(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/v1/docs/${id}`, { method: 'DELETE' });
}

export async function uploadDocument(file: File): Promise<{ document_id: string; name: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<{ document_id: string; name: string }>(`/api/v1/docs/upload`, {
    method: 'POST',
    body: fd,
  });
}

// content quick search API removed

export async function chat(messages: Message[], options?: { top_k?: number; temperature?: number; chat_model?: string; chat_provider?: string; conversation_id?: string }): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(`/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...options }),
  });
}

export type ChatStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; citations?: Citation[]; used_prompt?: string; answer_id: string }
  | { type: 'error'; message: string };

export async function chatStream(
  messages: Message[],
  onEvent: (ev: ChatStreamEvent) => void,
  options?: { top_k?: number; temperature?: number; chat_model?: string; chat_provider?: string; conversation_id?: string; signal?: AbortSignal }
): Promise<void> {
  const ctrl = new AbortController();
  const signal = options?.signal || ctrl.signal;
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBase()}/api/v1/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, ...options }),
    signal,
  });
  if (!res.ok || !res.body) {
    if (res.status === 401 && shouldRedirectOn401()) {
      clearSession();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    const text = await res.text().catch(() => '');
    throw new Error(text || `Stream failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try { onEvent(JSON.parse(jsonStr)); } catch {}
      }
    }
  }
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiFetch<{ items: Conversation[] }>(`/api/v1/chat/conversations`, { cache: 'no-store' });
  return res.items || [];
}

export async function persistConversations(conversations: Conversation[]): Promise<Conversation[]> {
  const res = await apiFetch<{ items: Conversation[] }>(`/api/v1/chat/conversations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: conversations }),
  });
  return res.items || [];
}

export async function fetchConversationMessages(conversationId: string): Promise<Message[]> {
  const res = await apiFetch<{ messages: Message[] }>(`/api/v1/chat/conversations/${conversationId}`);
  return res.messages || [];
}

export async function createServerConversation(title?: string): Promise<{ id: string; title: string }>{
  return apiFetch<{ id: string; title: string }>(`/api/v1/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function renameServerConversation(id: string, title: string): Promise<{ ok: boolean }>{
  return apiFetch<{ ok: boolean }>(`/api/v1/chat/conversations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function deleteServerConversation(id: string): Promise<{ ok: boolean }>{
  return apiFetch<{ ok: boolean }>(`/api/v1/chat/conversations/${id}`, { method: 'DELETE' });
}

export async function sendFeedback(answerId: string, vote: 'up'|'down'): Promise<{ ok: boolean }>{
  return apiFetch<{ ok: boolean }>(`/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer_id: answerId, vote }),
  });
}

export function uploadDocumentWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ document_id: string; name: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase()}/api/v1/docs/upload`);
    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('Invalid server response')); }
      } else {
        reject(new Error(xhr.responseText || 'Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export async function registerAccount(payload: { email: string; password: string; name?: string | null }): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Admin APIs
export async function adminListUsers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>(`/api/v1/admin/users`);
}

export async function adminSetUserAuth(userId: string, auth: 'admin'|'manager'|'user'|'administrator'): Promise<{ ok: boolean }>{
  return apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${userId}/auth`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth }),
  });
}

export async function adminGetUserPermissions(userId: string): Promise<{ document_ids: string[] }>{
  return apiFetch<{ document_ids: string[] }>(`/api/v1/admin/users/${userId}/permissions`);
}

export async function adminSetUserPermissions(userId: string, documentIds: string[]): Promise<{ ok: boolean }>{
  return apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${userId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: documentIds }),
  });
}

export async function adminListAllDocuments(): Promise<DocumentsList> {
  return apiFetch<DocumentsList>(`/api/v1/admin/documents`);
}

export async function listPermissionUsers(): Promise<PermissionUser[]> {
  return apiFetch<PermissionUser[]>(`/api/v1/docs/permissions/users`);
}

export async function getDocumentPermissions(docId: string): Promise<{ user_ids: string[] }>{
  return apiFetch<{ user_ids: string[] }>(`/api/v1/docs/${docId}/permissions`);
}

export async function setDocumentPermissions(docId: string, userIds: string[]): Promise<{ ok: boolean }>{
  return apiFetch<{ ok: boolean }>(`/api/v1/docs/${docId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export async function login(payload: { email: string; password: string }): Promise<LoginResult> {
  return apiFetch<LoginResult>(`/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<void> {
  await apiFetch(`/api/v1/auth/logout`, { method: 'POST' });
}

export async function fetchProfile(): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/v1/auth/me`);
}
