"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Message, Citation, ChatStreamEvent, Config } from "@/lib/api";
import { chatStream, getConfig, sendFeedback, fetchConversations, fetchConversationMessages, createServerConversation, renameServerConversation, deleteServerConversation } from "@/lib/api";
import ChatMessage from "@/app/components/ChatMessage";
import Button from "@/app/components/ui/Button";
import Textarea from "@/app/components/ui/Textarea";
import { createConversation, titleFromMessages, type Conversation } from "@/lib/conversations";

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
          const created = await createServerConversation('新的對話');
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
      const created = await createServerConversation('新的對話');
      await loadConversations(created.id);
      setLastCitations([]);
      setUsedPrompt(undefined);
    } catch {}
  }

  async function renameChat() {
    if (!conversationsReady) return;
    const cur = convs.find((c) => c.id === currentId);
    if (!cur) return;
    const name = prompt("重新命名對話", cur.title || "");
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
    if (!confirm("確定要刪除此對話？")) return;
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
    // Auto-name conversation on first user message (UI-side) and persist to server
    const firstLine = userMessage.content.trim().split('\n')[0];
    const autoTitle = firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
    if (currentId && autoTitle) {
      const cur = convs.find((c) => c.id === currentId);
      if (cur && (!cur.title || cur.title === '新的對話')) {
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
    clearInput();
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
      }, { signal: ctrl.signal, chat_model: model || cfg?.chat_model, chat_provider: provider || (cfg?.chat_provider as any), conversation_id: currentId || undefined });
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
        setMessages([...newMsgs, { role: "assistant", content: `錯誤：${err?.message || err}` }]);
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
      }, { chat_model: model || cfg?.chat_model, chat_provider: provider || (cfg?.chat_provider as any), conversation_id: currentId || undefined, signal: ctrl.signal });
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setMessages([...withMessages, { role: "assistant", content: `錯誤：${(err as any)?.message || err}` }]);
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
    const next = [...messages, { role: 'user', content: '請繼續。' } as Message];
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

  // 自動調整輸入框高度
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
      <section className="mt-5 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-indigo-900/40 dark:bg-neutral-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-500">Citations</p>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">追溯來源</h3>
          </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {usedPrompt && (
                <button
                  type="button"
                  className="rounded-full border border-indigo-200 px-3 py-1 font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
                  onClick={() => setShowPrompt((v) => !v)}
                >
                  {showPrompt ? "隱藏提示詞" : "顯示提示詞"}
                </button>
              )}
              <button
                type="button"
                className="rounded-full border border-gray-200 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                onClick={() => setRefsOpen((o) => !o)}
              >
                {refsOpen ? "收合引用" : "展開引用"}
              </button>
            {lastAnswerId && (
              <div className="ml-2 flex items-center gap-1">
                <span className="text-gray-500">這個回答是否有幫助？</span>
                <button
                  type="button"
                  disabled={!!feedbackSent}
                  onClick={async () => {
                    if (!lastAnswerId) return;
                    try { await sendFeedback(lastAnswerId, 'up'); setFeedbackSent('up'); } catch (_) {}
                  }}
                  className={`rounded-full border px-2 py-0.5 ${feedbackSent === 'up' ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'}`}
                >贊成</button>
                <button
                  type="button"
                  disabled={!!feedbackSent}
                  onClick={async () => {
                    if (!lastAnswerId) return;
                    try { await sendFeedback(lastAnswerId, 'down'); setFeedbackSent('down'); } catch (_) {}
                  }}
                  className={`rounded-full border px-2 py-0.5 ${feedbackSent === 'down' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'}`}
                >不贊成</button>
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
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{typeof c.page === 'number' ? `第 ${c.page} 頁` : '頁碼不詳'}</p>
                  </div>
                  <span className="text-xs text-gray-500">來源</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500"></div>
              </article>
            ))}
          </div>
        )}
        {showPrompt && usedPrompt && (
          <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 p-3 text-[13px] text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">System Prompt</div>
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
          <div className="font-semibold">沉浸式聊天</div>
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
            >清除訊息</Button>
            <Button variant="outline" onClick={() => setImmersive(false)}>退出全螢幕</Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={chatRef} className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
            {messages.length === 0 && !streamAnswer && (
              <div className="text-gray-500">對文件有任何問題，儘管問我！</div>
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
                    回到底部
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
                placeholder="輸入訊息，按 Enter 送出（Shift+Enter 換行）"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && input.trim()) onSend(e);
                  }
                }}
              />
              {busy ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap"
                    style={{ height: inputHeight }}
                    onClick={() => abortCtrl?.abort()}
                  >
                    停止
                  </Button>
                  <Button
                    type="submit"
                    className="cursor-not-allowed whitespace-nowrap opacity-60"
                    style={{ height: inputHeight }}
                    disabled
                  >
                    傳送中…
                  </Button>
                </>
              ) : (
                <Button type="submit" style={{ height: inputHeight }} className="min-w-[72px] whitespace-nowrap" disabled={busy}>
                  送出
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
    <div className="relative isolate min-h-[calc(100vh-80px)] bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.15),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.25),_transparent_60%)]" />
      <div
        ref={rootRef}
        className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row"
        style={{ height: containerH ? containerH + "px" : undefined }}
      >
        <aside className="order-2 rounded-3xl border border-white/50 bg-white/80 p-5 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70 lg:order-1 lg:w-[320px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-gray-400">History</p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-gray-100">會話清單</h2>
            </div>
            <Button variant="outline" size="sm" onClick={newChat} disabled={!conversationsReady}>新對話</Button>
          </div>
          <div className="space-y-2 overflow-auto pr-1">
            {convs.map((c) => {
              const active = c.id === currentId;
              const baseClasses = 'group w-full rounded-2xl border px-3 py-3 text-left text-sm transition';
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
                    <div className="truncate font-medium text-slate-900 dark:text-gray-100">{c.title || '新的對話'}</div>
                    {active && <span className="text-[11px] uppercase tracking-wide text-indigo-500">最新</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">{new Date(c.updatedAt).toLocaleString()}</div>
                </button>
              );
            })}
            {!convs.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-neutral-800 dark:text-gray-400">
                尚未建立對話。
              </div>
            )}
          </div>
          {currentId && (
            <div className="mt-6 grid gap-2">
              <Button variant="outline" size="sm" onClick={renameChat} disabled={!conversationsReady}>重新命名</Button>
              <Button variant="danger" size="sm" onClick={deleteChat} disabled={!conversationsReady}>刪除</Button>
            </div>
          )}
        </aside>

        <section className="order-1 flex flex-1 flex-col rounded-3xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-900/85 lg:order-2">
          <header className="border-b border-white/60 px-5 py-4 dark:border-neutral-800/70">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.3em] text-indigo-500">Active conversation</p>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-gray-100">{convs.find((c) => c.id === currentId)?.title || '新的對話'}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button variant="outline" size="sm" onClick={() => setImmersive(true)}>沉浸模式</Button>
              </div>
            </div>
          </header>

          <div className="border-b border-white/60 px-5 py-3 text-xs text-slate-600 dark:border-neutral-800/70 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
                {([
                  { id: 'openai', label: 'OpenAI', hint: '通用/高品質' },
                  { id: 'gemini', label: 'Gemini', hint: '推理/長上下文' },
                  { id: 'anthropic', label: 'Claude', hint: '語言/安全' },
                ] as const).map((p) => {
                  const selected = provider === p.id;
                  const buttonClasses = selected
                    ? 'rounded-full bg-indigo-600 text-white shadow dark:bg-indigo-500'
                    : 'rounded-full text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-neutral-700';
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
                      ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300';
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

          <div className="flex-1 overflow-hidden">
            <div ref={chatRef} className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6 pt-6 sm:px-8">
              {messages.length === 0 && !streamAnswer && (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-gray-400">
                  對文件有任何問題，儘管問我！
                </div>
              )}
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {streamAnswer && <ChatMessage role="assistant" content={streamAnswer} />}
              {busy && !streamAnswer && (
                <div className="flex w-full justify-start">
                  <div className="flex max-w-[95vw] items-start gap-4 md:max-w-[960px]">
                    <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-xl text-violet-700 shadow dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200">🤖</div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] leading-relaxed text-slate-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-800 dark:text-gray-100">
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200"
                  >
                    回到底部
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/60 px-4 py-4 text-xs text-slate-500 dark:border-neutral-800/70 dark:text-gray-400 sm:px-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {!busy && (
                <>
                  <button type="button" onClick={handleRegenerate} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200">
                    重新產生
                  </button>
                  <button type="button" onClick={handleContinue} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200">
                    繼續
                  </button>
                  <button type="button" onClick={handleCopyLast} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200">
                    複製
                  </button>
                </>
              )}
              {busy && (
                <button type="button" onClick={() => abortCtrl?.abort()} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  停止
                </button>
              )}
            </div>
            <form onSubmit={onSend} className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                value={input}
                rows={1}
                maxHeight={maxInputHeight}
                onHeightChange={handleInputHeightChange}
                placeholder="輸入訊息，Enter 送出（Shift+Enter 換行）"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && input.trim()) onSend(e);
                  }
                }}
              />
              {busy ? (
                <>
                  <Button type="button" variant="outline" className="whitespace-nowrap" style={{ height: inputHeight }} onClick={() => abortCtrl?.abort()}>
                    停止
                  </Button>
                  <Button type="submit" className="cursor-not-allowed whitespace-nowrap opacity-60" style={{ height: inputHeight }} disabled>
                    傳送中…
                  </Button>
                </>
              ) : (
                <Button type="submit" style={{ height: inputHeight }} className="min-w-[72px] whitespace-nowrap" disabled={busy}>
                  送出
                </Button>
              )}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
