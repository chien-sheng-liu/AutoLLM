"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Message, Citation, ChatStreamEvent, Config } from "@/lib/api";
import { chatStream, getConfig, sendFeedback, fetchConversations, fetchConversationMessages, createServerConversation, renameServerConversation, deleteServerConversation } from "@/lib/api";
import ChatMessage from "@/app/components/ChatMessage";
import Button from "@/app/components/ui/Button";
import Textarea from "@/app/components/ui/Textarea";
import { createConversation, titleFromMessages, type Conversation } from "@/lib/conversations";
import { useLanguage } from "@/app/providers/LanguageProvider";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCitations, setLastCitations] = useState<Citation[]>([]);
  const [usedPrompt, setUsedPrompt] = useState<string | undefined>(undefined);
  const [lastAnswerId, setLastAnswerId] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<null | 'up' | 'down'>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [showScroller, setShowScroller] = useState(false);
  const [streamAnswer, setStreamAnswer] = useState("");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(48);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [model, setModel] = useState<string>("");
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'anthropic' | string>('openai');
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState<number | null>(null);
  const [conversationsReady, setConversationsReady] = useState(false);
  const { t, language, autoDetectFromInput } = useLanguage();
  const fallbackTitle = t('chat.newConversation');
  const isDefaultTitle = (title?: string | null) => {
    const normalized = (title || '').trim();
    return !normalized || normalized === fallbackTitle || normalized === '新的對話' || normalized === 'New conversation';
  };
  const displayTitle = (title?: string | null) => (isDefaultTitle(title) ? fallbackTitle : (title || fallbackTitle));
  const providerOptions = [
    { id: 'openai', label: 'OpenAI', hint: t('chat.providerHints.openai') },
    { id: 'gemini', label: 'Gemini', hint: t('chat.providerHints.gemini') },
    { id: 'anthropic', label: 'Claude', hint: t('chat.providerHints.anthropic') },
  ] as const;

  const sortConversations = useCallback((list: Conversation[]) => {
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const currentIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const loadVersionRef = useRef(0);

  const loadConversations = useCallback(async (selectId?: string | null, options?: { keepCurrent?: boolean; skipMessages?: boolean; allowEmpty?: boolean }) => {
    const { keepCurrent = false, skipMessages = false, allowEmpty = true } = options || {};
    const version = loadVersionRef.current + 1;
    loadVersionRef.current = version;
    try {
      let list = await fetchConversations();
      if (!Array.isArray(list)) list = [];
      if (list.length === 0) {
        if (!allowEmpty) {
          const created = await createServerConversation(fallbackTitle);
          await loadConversations(created.id, { keepCurrent: false, skipMessages });
          return;
        }
        if (version !== loadVersionRef.current) return;
        setConvs([]);
        setCurrentId(null);
        if (!skipMessages) setMessages([]);
        return;
      }
      const sorted = sortConversations(list as Conversation[]);
      if (version !== loadVersionRef.current) return;
      setConvs(sorted);
      let target = selectId ?? (keepCurrent ? currentIdRef.current : (sorted[0]?.id ?? null));
      if (target && !sorted.some((c) => c.id === target)) {
        target = sorted[0]?.id ?? null;
      }
      if (!target) {
        if (version !== loadVersionRef.current) return;
        setCurrentId(null);
        if (!skipMessages) setMessages([]);
      } else {
        if (version !== loadVersionRef.current) return;
        setCurrentId(target);
        if (!skipMessages) {
          try {
            const msgs = await fetchConversationMessages(target);
            if (version !== loadVersionRef.current) return;
            setMessages(msgs);
          } catch {
            if (version !== loadVersionRef.current) return;
            setMessages([]);
          }
        }
      }
    } catch {
      if (version !== loadVersionRef.current) return;
      setConvs([]);
      if (!skipMessages) setMessages([]);
    } finally {
      if (version === loadVersionRef.current) setConversationsReady(true);
    }
  }, [sortConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    // Restore last selection from localStorage first
    try {
      const lp = localStorage.getItem('rag.chat.provider');
      const lm = localStorage.getItem('rag.chat.model');
      if (lp) setProvider(lp as any);
      if (lm) setModel(lm);
    } catch {}
    getConfig().then((c) => {
      setCfg(c);
      if (!localStorage.getItem('rag.chat.model')) setModel(c.chat_model);
      if (!localStorage.getItem('rag.chat.provider')) setProvider((c.chat_provider as any) || 'openai');
    }).catch(() => {});
  }, []);

  // Sync model suggestion when switching provider
  useEffect(() => {
    const sugg = chatSuggestions(provider);
    if (sugg.length && !sugg.includes(model)) {
      setModel(sugg[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => {
    try { localStorage.setItem('rag.chat.provider', String(provider)); } catch {}
  }, [provider]);
  useEffect(() => {
    try { if (model) localStorage.setItem('rag.chat.model', model); } catch {}
  }, [model]);

  // Fix chat page height: only chat window scrolls, not the page
  useEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const available = window.innerHeight - top - 8; // small buffer
      setContainerH(Math.max(360, available));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  function updateCurrent(updater: (c: Conversation) => Conversation) {
    if (!currentId) return;
    setConvs((prev) => {
      if (!prev.length) return prev;
      const next = prev.map((c) => (c.id === currentId ? updater(c) : c));
      const sorted = sortConversations(next);
      const cur = sorted.find((c) => c.id === currentId);
      if (cur) setMessages(cur.messages);
      return sorted;
    });
  }

  async function newChat() {
    if (!conversationsReady) return;
    try {
      const created = await createServerConversation(fallbackTitle);
      await loadConversations(created.id);
      setLastCitations([]);
      setUsedPrompt(undefined);
    } catch {}
  }

  async function renameChat() {
    if (!conversationsReady) return;
    const cur = convs.find((c) => c.id === currentId);
    if (!cur) return;
    const name = prompt(t('chat.renamePrompt'), cur.title || "");
    if (name === null) return;
    const title = name.trim();
    if (!title) return;
    try {
      const fid = cur.id;
      setConvs((prev) => prev.map((c) => c.id === fid ? { ...c, title } : c));
      await renameServerConversation(fid, title);
      await loadConversations(fid, { keepCurrent: true, skipMessages: true });
    } catch {}
  }

  async function deleteChat() {
    if (!conversationsReady || !currentId) return;
    const cur = convs.find((c) => c.id === currentId);
    if (!cur) return;
    if (!confirm(t('chat.deleteConversationConfirm'))) return;
    const targetId = currentId;
    setConvs((prev) => prev.filter((c) => c.id !== targetId));
    if (currentIdRef.current === targetId) {
      setCurrentId(null);
      setMessages([]);
    }
    try {
      await deleteServerConversation(targetId, typeof cur.series === 'number' ? cur.series : undefined);
      await loadConversations(undefined, { keepCurrent: false });
      setLastCitations([]);
      setUsedPrompt(undefined);
    } catch {
      // If server delete failed, reload to sync
      loadConversations(undefined, { keepCurrent: false }).catch(() => {});
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMsgs: Message[] = [...messages, userMessage];
    setMessages(newMsgs);
    autoDetectFromInput(userMessage.content);
    // Clear input immediately
    setInput("");
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.value = "";
        el.style.height = "auto";
        handleInputHeightChange(el.offsetHeight || 48);
      }
    });
    // Auto-name conversation on first user message (UI-side) and persist to server
    const firstLine = userMessage.content.trim().split('\n')[0];
    const autoTitle = firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
    if (currentId && autoTitle) {
      const cur = convs.find((c) => c.id === currentId);
      if (cur && isDefaultTitle(cur.title)) {
        const fid = currentId;
        setConvs((prev) => prev.map((c) => c.id === fid ? { ...c, title: autoTitle, updatedAt: Date.now() } as any : c));
        renameServerConversation(fid, autoTitle)
          .then(() => loadConversations(fid, { keepCurrent: true, skipMessages: true }))
          .catch(() => {});
      }
    }
    updateCurrent((c) => ({
      ...c,
      title: c.messages.length === 0 ? titleFromMessages([userMessage]) : c.title,
      messages: newMsgs,
      updatedAt: Date.now(),
    }));
    const ctrl = new AbortController();
    setAbortCtrl(ctrl);
    setBusy(true);
    try {
      let acc = "";
      setStreamAnswer("");
      await chatStream(newMsgs, (ev: ChatStreamEvent) => {
        if (ev.type === "delta") {
          acc += ev.content || "";
          setStreamAnswer(acc);
        } else if (ev.type === "done") {
          const finalMsgs = [...newMsgs, { role: "assistant", content: acc } as Message];
          setMessages(finalMsgs);
          setLastCitations(ev.citations || []);
          setUsedPrompt(ev.used_prompt);
          setLastAnswerId(ev.answer_id || null);
          setFeedbackSent(null);
          setStreamAnswer("");
          updateCurrent((c) => ({ ...c, messages: finalMsgs, updatedAt: Date.now() }));
          loadConversations(currentId, { keepCurrent: true, skipMessages: true }).catch(() => {});
        }
      }, { signal: ctrl.signal, chat_model: model || cfg?.chat_model, chat_provider: provider || (cfg?.chat_provider as any), conversation_id: currentId || undefined, language });
    } catch (err: any) {
      if (ctrl.signal.aborted) {
        const partial = streamAnswer;
        if (partial) {
          const finalMsgs = [...newMsgs, { role: "assistant", content: partial } as Message];
          setMessages(finalMsgs);
          setLastCitations([]);
          setUsedPrompt(undefined);
          setStreamAnswer("");
          updateCurrent((c) => ({ ...c, messages: finalMsgs, updatedAt: Date.now() }));
        }
      } else {
        const msg = (err as any)?.message || err;
        setMessages([...newMsgs, { role: "assistant", content: t('chat.streamingError', { message: String(msg) }) }]);
      }
    } finally {
      setBusy(false);
      setAbortCtrl(null);
    }
  }

  // Reusable streamer for regenerate/continue
  async function startStream(withMessages: Message[]) {
    const ctrl = new AbortController();
    setAbortCtrl(ctrl);
    setBusy(true);
    try {
      let acc = "";
      setStreamAnswer("");
      await chatStream(withMessages, (ev: ChatStreamEvent) => {
        if (ev.type === "delta") {
          acc += ev.content || "";
          setStreamAnswer(acc);
        } else if (ev.type === "done") {
          const finalMsgs = [...withMessages, { role: "assistant", content: acc } as Message];
          setMessages(finalMsgs);
          setLastCitations(ev.citations || []);
          setUsedPrompt(ev.used_prompt);
          setLastAnswerId(ev.answer_id || null);
          setFeedbackSent(null);
          setStreamAnswer("");
          updateCurrent((c) => ({ ...c, messages: finalMsgs, updatedAt: Date.now() }));
          loadConversations(currentId, { keepCurrent: true, skipMessages: true }).catch(() => {});
        }
      }, { chat_model: model || cfg?.chat_model, chat_provider: provider || (cfg?.chat_provider as any), conversation_id: currentId || undefined, signal: ctrl.signal, language });
    } catch (err) {
      if (!ctrl.signal.aborted) {
        const msg = (err as any)?.message || err;
        setMessages([...withMessages, { role: "assistant", content: t('chat.streamingError', { message: String(msg) }) }]);
      }
    } finally {
      setBusy(false);
      setAbortCtrl(null);
    }
  }

  function handleRegenerate() {
    if (busy || messages.length === 0) return;
    // Find last user message; rebuild messages up to it and stream again
    let idx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { idx = i; break; }
    }
    if (idx === -1) return;
    const base = messages.slice(0, idx + 1);
    setMessages(base);
    startStream(base);
  }

  function handleContinue() {
    if (busy) return;
    const next = [...messages, { role: 'user', content: t('chat.typingContinue') } as Message];
    setMessages(next);
    startStream(next);
  }

  function handleCopyLast() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        navigator.clipboard.writeText(messages[i].content).catch(() => {});
        break;
      }
    }
  }

  function chatSuggestions(p?: string): string[] {
    const id = (p || provider || 'openai');
    if (id === 'gemini') {
      return [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash-8b',
      ];
    }
    if (id === 'anthropic') {
      return [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];
    }
    // OpenAI default
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o3-mini',
    ];
  }

  function displayModelLabel(m: string): string {
    // Keep labels compact to avoid overflow
    // Anthropic Claude
    if (m.startsWith('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
    if (m.startsWith('claude-3-5-haiku')) return 'Claude 3.5 Haiku';
    if (m.startsWith('claude-3-opus')) return 'Claude 3 Opus';
    if (m.startsWith('claude-3-sonnet')) return 'Claude 3 Sonnet';
    if (m.startsWith('claude-3-haiku')) return 'Claude 3 Haiku';
    // Google Gemini
    if (m.startsWith('gemini-2.0-flash')) return 'Gemini 2.0 Flash';
    if (m.startsWith('gemini-1.5-flash-8b')) return 'Gemini 1.5 Flash 8B';
    if (m.startsWith('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
    if (m.startsWith('gemini-1.5-pro')) return 'Gemini 1.5 Pro';
    // OpenAI
    if (m === 'gpt-4o') return 'GPT-4o';
    if (m === 'gpt-4o-mini') return '4o-mini';
    if (m === 'gpt-4.1') return 'GPT-4.1';
    if (m === 'gpt-4.1-mini') return '4.1-mini';
    if (m === 'o3-mini') return 'o3-mini';
    return m;
  }

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streamAnswer]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      setShowScroller(!atBottom);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [immersive]);

  // Keep citations collapsed by default; user can expand manually

  // Auto adjust input height
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 900;
  const maxInputHeight = Math.max(120, Math.min(260, ((containerH ?? viewportH) * 0.3)));
  const handleInputHeightChange = (h: number) => setInputHeight(h);
  const clearInput = () => {
    setInput("");
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.value = "";
        el.style.height = "auto";
        handleInputHeightChange(el.offsetHeight || 48);
      }
    });
  };

  const renderCitationsSection = () => {
    if (cfg && cfg.show_sources === false) return null;
    if (!lastCitations.length) return null;
    return (
      <section className="mt-3 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-indigo-900/40 dark:bg-neutral-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-500">{t('chat.citationsTitle')}</p>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('chat.citationsSubtitle')}</h3>
          </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {usedPrompt && (
                <button
                  type="button"
                  className="rounded-full border border-indigo-200 px-3 py-1 font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
                  onClick={() => setShowPrompt((v) => !v)}
                >
                  {showPrompt ? t('chat.hidePrompt') : t('chat.showPrompt')}
                </button>
              )}
              <button
                type="button"
                className="rounded-full border border-gray-200 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                onClick={() => setRefsOpen((o) => !o)}
              >
                {refsOpen ? t('chat.hideSources') : t('chat.showSources')}
              </button>
            {lastAnswerId && (
              <div className="ml-2 flex items-center gap-1">
                <span className="text-gray-500">{t('chat.feedbackPrompt')}</span>
                <button
                  type="button"
                  disabled={!!feedbackSent}
                  onClick={async () => {
                    if (!lastAnswerId) return;
                    try { await sendFeedback(lastAnswerId, 'up'); setFeedbackSent('up'); } catch (_) {}
                  }}
                  className={`rounded-full border px-2 py-0.5 ${feedbackSent === 'up' ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'}`}
                >{t('chat.feedbackUp')}</button>
                <button
                  type="button"
                  disabled={!!feedbackSent}
                  onClick={async () => {
                    if (!lastAnswerId) return;
                    try { await sendFeedback(lastAnswerId, 'down'); setFeedbackSent('down'); } catch (_) {}
                  }}
                  className={`rounded-full border px-2 py-0.5 ${feedbackSent === 'down' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'}`}
                >{t('chat.feedbackDown')}</button>
              </div>
            )}
          </div>
        </div>
        {refsOpen && (
          <div className="mt-4 space-y-3">
            {lastCitations.map((c, i) => (
              <article
                key={`${c.name}-${i}-${c.page ?? 'na'}`}
                className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50/40 p-3 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[12px] font-bold text-white">
                        {i + 1}
                      </span>
                      {c.name}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{typeof c.page === 'number' ? t('chat.pageLabel', { page: c.page }) : t('chat.pageUnknown')}</p>
                  </div>
                  <span className="text-xs text-gray-500">{t('chat.sourceLabel')}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500"></div>
              </article>
            ))}
          </div>
        )}
        {showPrompt && usedPrompt && (
          <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 p-3 text-[13px] text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">{t('chat.systemPromptLabel')}</div>
            <pre className="whitespace-pre-wrap">{usedPrompt}</pre>
          </div>
        )}
      </section>
    );
  };

  if (immersive) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 text-sm dark:border-neutral-800">
          <div className="font-semibold">{t('chat.immersiveTitle')}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
                setLastCitations([]);
                setUsedPrompt(undefined);
                updateCurrent((c) => ({ ...c, messages: [], updatedAt: Date.now() }));
              }}
              disabled={busy}
            >{t('chat.clearMessages')}</Button>
            <Button variant="outline" onClick={() => setImmersive(false)}>{t('chat.exitImmersive')}</Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={chatRef} className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
            {messages.length === 0 && !streamAnswer && (
              <div className="text-gray-500">{t('chat.emptyState')}</div>
            )}
            <div className="grid gap-4">
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {streamAnswer && <ChatMessage role="assistant" content={streamAnswer} />}
              {busy && !streamAnswer && (
                <div className="flex w-full justify-start">
                  <div className="flex max-w-[95vw] items-start gap-4 md:max-w-[960px]">
                    <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full text-xl shadow border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200">🤖</div>
                    <div className="rounded-2xl border px-3 py-2 text-[15px] leading-relaxed shadow-sm border-gray-200 bg-gray-50 text-gray-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-gray-100">
                      <div className="typing-dots text-gray-500 dark:text-gray-300"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                </div>
              )}
              {renderCitationsSection()}
              {showScroller && (
                <div className="sticky bottom-2 flex justify-end pr-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = chatRef.current;
                      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    }}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700"
                  >
                    {t('chat.scrollToBottom')}
                  </button>
                </div>
              )}
              
            </div>
          </div>
          <div className="shrink-0 border-t border-gray-200 bg-white p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <form onSubmit={onSend} className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                value={input}
                rows={1}
                maxHeight={maxInputHeight}
                onHeightChange={handleInputHeightChange}
                placeholder={t('chat.inputPlaceholder')}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && input.trim()) onSend(e);
                  }
                }}
              />
              {busy ? (
                <Button
                  type="submit"
                  className="cursor-not-allowed whitespace-nowrap opacity-60"
                  style={{ height: inputHeight }}
                  disabled
                >
                  {t('chat.sending')}
                </Button>
              ) : (
                <Button type="submit" style={{ height: inputHeight }} className="min-w-[72px] whitespace-nowrap" disabled={busy}>
                  {t('chat.send')}
                </Button>
              )}
            </form>
          </div>
          
        </div>

        {/* references shown within the scrollable chat area in immersive mode */}
      </div>
    );
  }


  return (
    <div
      ref={rootRef}
      className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-2 py-4 md:px-6 lg:flex-row"
      style={{ height: containerH ? containerH + "px" : undefined }}
    >
        <aside className="order-2 flex h-full flex-col overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-4 shadow-soft backdrop-blur-lg lg:order-1 lg:w-[260px]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">{t('chat.historyBadge')}</p>
              <h2 className="text-lg font-semibold text-slate-100">{t('chat.conversationListTitle')}</h2>
            </div>
            <Button variant="outline" size="sm" onClick={newChat} disabled={!conversationsReady}>{t('chat.createConversation')}</Button>
          </div>
          <div className="space-y-2 overflow-auto pr-1">
            {convs.map((c) => {
              const active = c.id === currentId;
              const baseClasses = 'group w-full rounded-2xl border px-3 py-2.5 text-left text-sm transition backdrop-blur-md';
              const variant = active
                ? 'border-indigo-200 bg-white shadow dark:border-indigo-900/60 dark:bg-neutral-800'
                : 'border-transparent bg-white/60 hover:border-indigo-100 hover:bg-white dark:bg-neutral-800/60 dark:hover:border-neutral-700';
              return (
                <button
                  key={c.id}
                onClick={async () => {
                  setCurrentId(c.id);
                  try { setMessages(await fetchConversationMessages(c.id)); } catch { setMessages([]); }
                }}
                  className={`${baseClasses} ${variant}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium text-slate-900 dark:text-gray-100">{displayTitle(c.title)}</div>
                    {active && <span className="text-[11px] uppercase tracking-wide text-indigo-500">{t('chat.latestBadge')}</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">{new Date(c.updatedAt).toLocaleString()}</div>
                </button>
              );
            })}
            {!convs.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-neutral-800 dark:text-gray-400">
                {t('chat.noConversations')}
              </div>
            )}
          </div>
          {currentId && (
            <div className="mt-5 grid gap-2">
              <Button variant="outline" size="sm" onClick={renameChat} disabled={!conversationsReady}>{t('chat.menuRename')}</Button>
              <Button variant="danger" size="sm" onClick={deleteChat} disabled={!conversationsReady}>{t('chat.menuDelete')}</Button>
            </div>
          )}
        </aside>

        <div className="order-1 flex min-h-0 flex-1 flex-col gap-4 lg:order-2">
          <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.35em] text-indigo-400">{t('chat.activeLabel')}</p>
                <h1 className="text-lg font-semibold text-slate-100">{displayTitle(convs.find((c) => c.id === currentId)?.title)}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button variant="outline" size="sm" onClick={() => setImmersive(true)}>{t('chat.immersiveMode')}</Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-xs text-slate-300 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
                {providerOptions.map((p) => {
                  const selected = provider === p.id;
                  const buttonClasses = selected
                    ? 'rounded-full bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-glow'
                    : 'rounded-full text-slate-100 hover:bg-white/20';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      aria-pressed={selected}
                      className={`h-7 px-3 text-[11px] font-medium transition ${buttonClasses}`}
                      title={p.hint}
                    >{p.label}</button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]">
                <div className="flex gap-1.5">
                  {chatSuggestions(provider).map((m) => {
                    const selected = model === m;
                    const pillClasses = selected
                      ? 'border border-white/20 bg-gradient-to-tr from-indigo-600/90 to-fuchsia-600/90 text-white shadow-glow'
                      : 'border border-white/15 bg-white/10 text-slate-100 hover:bg-white/20';
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModel(m)}
                        aria-pressed={selected}
                        className={`h-7 rounded-full px-3 text-[11px] transition ${pillClasses}`}
                      >{displayModelLabel(m)}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/12 bg-white/5 backdrop-blur-md">
            <div ref={chatRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-5 sm:px-6">
              {messages.length === 0 && !streamAnswer && (
                <div className="rounded-3xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-slate-300">
                  {t('chat.emptyState')}
                </div>
              )}
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {streamAnswer && <ChatMessage role="assistant" content={streamAnswer} />}
              {busy && !streamAnswer && (
                <div className="flex w-full justify-start">
                  <div className="flex max-w-[95vw] items-start gap-4 md:max-w-[1000px]">
                    <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-lg text-violet-700 shadow dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200">🤖</div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[14px] leading-relaxed text-slate-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-800 dark:text-gray-100">
                      <div className="typing-dots text-gray-500 dark:text-gray-300"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                </div>
              )}
              {renderCitationsSection()}
              {showScroller && (
                <div className="sticky bottom-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const el = chatRef.current;
                      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    }}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-slate-100"
                  >
                    {t('chat.scrollToBottom')}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-300 sm:px-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {!busy && (
                  <>
                    <button type="button" onClick={handleRegenerate} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-white/20">
                      {t('chat.regenerate')}
                    </button>
                    <button type="button" onClick={handleContinue} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-white/20">
                      {t('chat.continue')}
                    </button>
                    <button type="button" onClick={handleCopyLast} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-white/20">
                      {t('chat.copy')}
                    </button>
                  </>
                )}
              </div>
              <form onSubmit={onSend} className="flex items-end gap-3">
                <Textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  maxHeight={maxInputHeight}
                  onHeightChange={handleInputHeightChange}
                  placeholder={t('chat.inputPlaceholder')}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!busy && input.trim()) onSend(e);
                    }
                  }}
                />
                {busy ? (
                  <Button type="submit" className="cursor-not-allowed whitespace-nowrap opacity-60" style={{ height: inputHeight }} disabled>
                    {t('chat.sending')}
                  </Button>
                ) : (
                  <Button type="submit" style={{ height: inputHeight }} className="min-w-[72px] whitespace-nowrap" disabled={busy}>
                    {t('chat.send')}
                  </Button>
                )}
              </form>
            </div>
          </div>
        </div>
    </div>
  );
}
