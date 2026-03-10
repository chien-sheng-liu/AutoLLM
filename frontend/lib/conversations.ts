export type Conversation = {
  id: string;
  title: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  createdAt: number;
  updatedAt: number;
  series?: number;
};

export function createConversation(): Conversation {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: 'New conversation', messages: [], createdAt: now, updatedAt: now };
}

export function titleFromMessages(messages: Conversation['messages']): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const t = firstUser.content.trim().split('\n')[0];
  return t.length > 18 ? t.slice(0, 18) + '…' : t || 'New conversation';
}
