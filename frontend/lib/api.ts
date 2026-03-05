export type Message = { role: 'system' | 'user' | 'assistant'; content: string };
export type Citation = { document_id: string; name: string; chunk_id: string; score: number; snippet: string };
export type Config = {
  chat_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  embedding_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  chat_model: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
};
export type DocumentItem = { document_id: string; name: string };
export type DocumentsList = { items: DocumentItem[] };
export type ChatResponse = { answer: string; citations?: Citation[]; used_prompt?: string };

function apiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  return base.replace(/\/$/, '');
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, init);
  if (!res.ok) {
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

export async function chat(messages: Message[], options?: { top_k?: number; temperature?: number; chat_model?: string }): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(`/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...options }),
  });
}

export type ChatStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; citations?: Citation[]; used_prompt?: string }
  | { type: 'error'; message: string };

export async function chatStream(
  messages: Message[],
  onEvent: (ev: ChatStreamEvent) => void,
  options?: { top_k?: number; temperature?: number; chat_model?: string; signal?: AbortSignal }
): Promise<void> {
  const ctrl = new AbortController();
  const signal = options?.signal || ctrl.signal;
  const res = await fetch(`${apiBase()}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...options }),
    signal,
  });
  if (!res.ok || !res.body) {
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

export function uploadDocumentWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ document_id: string; name: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase()}/api/v1/docs/upload`);
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
