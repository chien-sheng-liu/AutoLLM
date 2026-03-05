export type Conversation = {
  id: string;
  title: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  createdAt: number;
  updatedAt: number;
};

const KEY = 'conversations.v1';

export function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Conversation[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveConversations(convs: Conversation[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(convs));
}

export function createConversation(): Conversation {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: '新的對話', messages: [], createdAt: now, updatedAt: now };
}

export function titleFromMessages(messages: Conversation['messages']): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return '新的對話';
  const t = firstUser.content.trim().split('\n')[0];
  return t.length > 18 ? t.slice(0, 18) + '…' : t || '新的對話';
}

