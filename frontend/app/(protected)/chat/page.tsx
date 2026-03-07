"use client";
import { useEffect, useRef, useState } from "react";
import type { Message, Citation, ChatStreamEvent, Config } from "@/lib/api";
import { chatStream, getConfig, sendFeedback } from "@/lib/api";
import ChatMessage from "@/app/components/ChatMessage";
import Button from "@/app/components/ui/Button";
import Textarea from "@/app/components/ui/Textarea";
import Card from "@/app/components/ui/Card";
import { createConversation, loadConversations, saveConversations, titleFromMessages, type Conversation } from "@/lib/conversations";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(48);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [model, setModel] = useState<string>("");
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'anthropic' | string>('openai');
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState<number | null>(null);

  useEffect(() => {
    const list = loadConversations();
    if (list.length === 0) {
      const nc = createConversation();
      saveConversations([nc]);
      setConvs([nc]);
      setCurrentId(nc.id);
      setMessages([]);
    } else {
      const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
      setConvs(sorted);
      setCurrentId(sorted[0].id);
      setMessages(sorted[0].messages);
    }
  }, []);

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
    setConvs((prev) => {
      const next = prev.map((c) => (c.id === currentId ? updater(c) : c));
      saveConversations(next);
      const cur = next.find((c) => c.id === currentId);
      if (cur) setMessages(cur.messages);
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }

  function newChat() {
    const nc = createConversation();
    const list = [nc, ...convs];
    saveConversations(list);
    setConvs(list);
    setCurrentId(nc.id);
    setMessages([]);
    setLastCitations([]);
    setUsedPrompt(undefined);
  }

  function renameChat() {
    const cur = convs.find((c) => c.id === currentId);
    if (!cur) return;
    const name = prompt("重新命名對話", cur.title || "");
    if (name === null) return;
    updateCurrent((c) => ({ ...c, title: name.trim() || c.title, updatedAt: Date.now() }));
  }

  function deleteChat() {
    const cur = convs.find((c) => c.id === currentId);
    if (!cur) return;
    if (!confirm("確定要刪除此對話？")) return;
    const rest = convs.filter((c) => c.id !== currentId);
    saveConversations(rest);
    setConvs(rest);
    if (rest.length) {
      setCurrentId(rest[0].id);
      setMessages(rest[0].messages);
    } else {
      const nc = createConversation();
      saveConversations([nc]);
      setConvs([nc]);
      setCurrentId(nc.id);
      setMessages([]);
    }
    setLastCitations([]);
    setUsedPrompt(undefined);
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMsgs: Message[] = [...messages, userMessage];
    setMessages(newMsgs);
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
        }
      }, { signal: ctrl.signal, chat_model: model || cfg?.chat_model, chat_provider: provider || (cfg?.chat_provider as any) });
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
        }
      }, { chat_model: model || cfg?.chat_model, chat_provider: provider || (cfg?.chat_provider as any), signal: ctrl.signal });
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
                  <div className="flex max-w-[95ch] md:max-w-[110ch] items-start gap-4">
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

  const messageCount = messages.length + (streamAnswer ? 1 : 0);
  const quickPrompts = [
    "請用三點總結最新上傳的文件",
    "幫我列出可行建議",
    "潛在風險有哪些？",
  ];

  function handleQuickPrompt(text: string) {
    setInput(text);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="space-y-2">

      <div
        ref={rootRef}
        className="grid gap-4 md:grid-cols-[280px_1fr]"
        style={{ height: containerH ? containerH + "px" : undefined }}
      >
        <Card
          className={`p-4 ${sidebarOpen ? "" : "hidden md:block"} h-full overflow-auto border border-white/60 bg-white/90 shadow-soft dark:border-neutral-800/70 dark:bg-neutral-900/80`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Conversations</p>
              <h3 className="font-semibold">會話清單</h3>
            </div>
            <Button variant="outline" size="sm" onClick={newChat}>新對話</Button>
          </div>
          <div className="grid gap-2">
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCurrentId(c.id);
                  setMessages(c.messages);
                  setSidebarOpen(false);
                }}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800 ${
                  c.id === currentId ? "border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800" : "border-gray-200 bg-white"
                }`}
              >
                <div className="truncate font-medium">{c.title || "新的對話"}</div>
                <div className="truncate text-xs text-gray-500">{new Date(c.updatedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
          {currentId && (
            <div className="mt-4 grid gap-2">
              <Button variant="outline" size="sm" onClick={renameChat}>重新命名</Button>
              <Button variant="danger" size="sm" onClick={deleteChat}>刪除</Button>
            </div>
          )}
        </Card>

        <div className="flex h-full min-h-0 flex-col gap-3">
          <Card className="flex h-full min-h-0 flex-col">
            <div className="border-b border-gray-200 bg-white/90 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/80">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 backdrop-blur dark:border-neutral-700 dark:bg-neutral-800">
                  {([
                    { id: 'openai', label: 'OpenAI', hint: '通用/高品質' },
                    { id: 'gemini', label: 'Gemini', hint: '推理/長上下文' },
                    { id: 'anthropic', label: 'Claude', hint: '語言/安全' },
                  ] as const).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      aria-pressed={provider === p.id}
                      className={`h-6 px-2.5 py-0 text-[11px] leading-none font-medium transition ${
                        provider === p.id
                          ? 'rounded-md bg-indigo-600 text-white shadow dark:bg-indigo-500'
                          : 'rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-700'
                      }`}
                      title={p.hint}
                    >{p.label}</button>
                  ))}
                </div>
                <div className="flex-1" />
              </div>
              <div className="mt-1 flex gap-1.5 overflow-x-auto pb-0 [scrollbar-width:thin]">
                {chatSuggestions(provider).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    aria-pressed={model === m}
                    className={`h-6 whitespace-nowrap rounded-full px-2.5 py-0 text-[11px] leading-none transition ${
                      model === m
                        ? 'border border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'
                    }`}
                    title={m}
                  >{displayModelLabel(m)}</button>
                ))}
              </div>
            </div>
            <div ref={chatRef} className="flex-1 overflow-auto p-4 md:p-6">
              {messages.length === 0 && !streamAnswer && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-gray-300">
                  對文件有任何問題，儘管問我！
                </div>
              )}
              <div className="grid gap-4">
                {messages.map((m, i) => (
                  <ChatMessage key={i} role={m.role} content={m.content} />
                ))}
                {streamAnswer && <ChatMessage role="assistant" content={streamAnswer} />}
                {busy && !streamAnswer && (
                  <div className="flex w-full justify-start">
                    <div className="flex max-w-[95ch] md:max-w-[110ch] items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full text-xl shadow border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200">🤖</div>
                      <div className="rounded-2xl border px-3 py-2 text-[15px] leading-relaxed shadow-sm border-gray-200 bg-gray-50 text-gray-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-gray-100">
                        <div className="typing-dots text-gray-500 dark:text-gray-300"><span></span><span></span><span></span></div>
                      </div>
                    </div>
                  </div>
                )}

                {renderCitationsSection()}
              </div>
            </div>
            <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-neutral-800 dark:bg-neutral-900/80">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex flex-wrap gap-2">
                  {!busy && (
                    <>
                      <button type="button" onClick={handleRegenerate} className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800">重新產生</button>
                      <button type="button" onClick={handleContinue} className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800">繼續</button>
                      <button type="button" onClick={handleCopyLast} className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800">複製</button>
                    </>
                  )}
                  {busy && (
                    <button type="button" onClick={() => abortCtrl?.abort()} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-red-600 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800">停止</button>
                  )}
                </div>
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
                    if (e.key === "Enter" && !e.shiftKey) {
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
          </Card>
        </div>
      </div>
    </div>
  );
}
