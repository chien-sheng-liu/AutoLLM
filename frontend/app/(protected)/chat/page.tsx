"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Message, Citation, ChatStreamEvent, Config } from "@/lib/api";
import {
  chatStream,
  getConfig,
  sendFeedback,
  fetchConversations,
  fetchConversationMessages,
  createServerConversation,
  renameServerConversation,
  deleteServerConversation,
} from "@/lib/api";
import ChatMessage from "@/app/components/ChatMessage";
import StreamingBubble from "@/app/components/StreamingBubble";
import Button from "@/app/components/ui/Button";
import Textarea from "@/app/components/ui/Textarea";
import {
  createConversation,
  titleFromMessages,
  type Conversation,
} from "@/lib/conversations";
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
  const [feedbackSent, setFeedbackSent] = useState<null | "up" | "down">(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [showScroller, setShowScroller] = useState(false);
  const [streamAnswer, setStreamAnswer] = useState("");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(48);
  // Incrementing this key forces the Textarea to remount with a fresh DOM node,
  // guaranteeing the text is cleared regardless of React batching behaviour.
  const [inputKey, setInputKey] = useState(0);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [model, setModel] = useState<string>("");
  const [provider, setProvider] = useState<
    "openai" | "gemini" | "anthropic" | string
  >("openai");
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState<number | null>(null);
  const [conversationsReady, setConversationsReady] = useState(false);
  const { t, language, autoDetectFromInput } = useLanguage();
  const fallbackTitle = t("chat.newConversation");
  const isDefaultTitle = (title?: string | null) => {
    const normalized = (title || "").trim();
    return (
      !normalized ||
      normalized === fallbackTitle ||
      normalized === "新的對話" ||
      normalized === "New conversation"
    );
  };
  const displayTitle = (title?: string | null) =>
    isDefaultTitle(title) ? fallbackTitle : title || fallbackTitle;
  const providerOptions = [
    { id: "openai", label: "OpenAI", hint: t("chat.providerHints.openai") },
    { id: "gemini", label: "Gemini", hint: t("chat.providerHints.gemini") },
    {
      id: "anthropic",
      label: "Claude",
      hint: t("chat.providerHints.anthropic"),
    },
  ] as const;

  const sortConversations = useCallback((list: Conversation[]) => {
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const currentIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const loadVersionRef = useRef(0);

  const loadConversations = useCallback(
    async (
      selectId?: string | null,
      options?: {
        keepCurrent?: boolean;
        skipMessages?: boolean;
        allowEmpty?: boolean;
      },
    ) => {
      const {
        keepCurrent = false,
        skipMessages = false,
        allowEmpty = true,
      } = options || {};
      const version = loadVersionRef.current + 1;
      loadVersionRef.current = version;
      try {
        let list = await fetchConversations();
        if (!Array.isArray(list)) list = [];
        if (list.length === 0) {
          if (!allowEmpty) {
            const created = await createServerConversation(fallbackTitle);
            await loadConversations(created.id, {
              keepCurrent: false,
              skipMessages,
            });
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
        let target =
          selectId ??
          (keepCurrent ? currentIdRef.current : (sorted[0]?.id ?? null));
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
    },
    [sortConversations],
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    // Restore last selection from localStorage first
    try {
      const lp = localStorage.getItem("rag.chat.provider");
      const lm = localStorage.getItem("rag.chat.model");
      if (lp) setProvider(lp as any);
      if (lm) setModel(lm);
    } catch {}
    getConfig()
      .then((c) => {
        setCfg(c);
        if (!localStorage.getItem("rag.chat.model")) setModel(c.chat_model);
        if (!localStorage.getItem("rag.chat.provider"))
          setProvider((c.chat_provider as any) || "openai");
      })
      .catch(() => {});
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
    try {
      localStorage.setItem("rag.chat.provider", String(provider));
    } catch {}
  }, [provider]);
  useEffect(() => {
    try {
      if (model) localStorage.setItem("rag.chat.model", model);
    } catch {}
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
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function updateCurrent(updater: (c: Conversation) => Conversation) {
    if (!currentId) return;
    // NOTE: Do NOT call setMessages inside this setConvs updater.
    // Calling setState inside another setState's updater is a React anti-pattern
    // that causes unpredictable batching in React 18 and interferes with
    // flushSync. Callers are responsible for syncing messages separately.
    setConvs((prev) => {
      if (!prev.length) return prev;
      const next = prev.map((c) => (c.id === currentId ? updater(c) : c));
      return sortConversations(next);
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
    const name = prompt(t("chat.renamePrompt"), cur.title || "");
    if (name === null) return;
    const title = name.trim();
    if (!title) return;
    try {
      const fid = cur.id;
      setConvs((prev) => prev.map((c) => (c.id === fid ? { ...c, title } : c)));
      await renameServerConversation(fid, title);
      await loadConversations(fid, { keepCurrent: true, skipMessages: true });
    } catch {}
  }

  async function deleteChat() {
    if (!conversationsReady || !currentId) return;
    const cur = convs.find((c) => c.id === currentId);
    if (!cur) return;
    if (!confirm(t("chat.deleteConversationConfirm"))) return;
    const targetId = currentId;
    setConvs((prev) => prev.filter((c) => c.id !== targetId));
    if (currentIdRef.current === targetId) {
      setCurrentId(null);
      setMessages([]);
    }
    try {
      await deleteServerConversation(
        targetId,
        typeof cur.series === "number" ? cur.series : undefined,
      );
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
    // Increment inputKey to remount the Textarea with a fresh DOM node — the
    // only approach that reliably clears the textarea independent of React 18
    // batching or the controlled-component reconciliation order.
    setInput("");
    setInputKey((k) => k + 1);
    // Auto-name conversation on first user message (UI-side) and persist to server
    const firstLine = userMessage.content.trim().split("\n")[0];
    const autoTitle =
      firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    if (currentId && autoTitle) {
      const cur = convs.find((c) => c.id === currentId);
      if (cur && isDefaultTitle(cur.title)) {
        const fid = currentId;
        setConvs((prev) =>
          prev.map((c) =>
            c.id === fid
              ? ({ ...c, title: autoTitle, updatedAt: Date.now() } as any)
              : c,
          ),
        );
        renameServerConversation(fid, autoTitle)
          .then(() =>
            loadConversations(fid, { keepCurrent: true, skipMessages: true }),
          )
          .catch(() => {});
      }
    }
    updateCurrent((c) => ({
      ...c,
      title:
        c.messages.length === 0 ? titleFromMessages([userMessage]) : c.title,
      messages: newMsgs,
      updatedAt: Date.now(),
    }));
    const ctrl = new AbortController();
    setAbortCtrl(ctrl);
    setBusy(true);
    try {
      let acc = "";
      setStreamAnswer("");
      await chatStream(
        newMsgs,
        (ev: ChatStreamEvent) => {
          if (ev.type === "delta") {
            acc += ev.content || "";
            setStreamAnswer(acc);
          } else if (ev.type === "done") {
            const finalMsgs = [
              ...newMsgs,
              { role: "assistant", content: acc } as Message,
            ];
            setMessages(finalMsgs);
            setLastCitations(ev.citations || []);
            setUsedPrompt(ev.used_prompt);
            setLastAnswerId(ev.answer_id || null);
            setFeedbackSent(null);
            setStreamAnswer("");
            updateCurrent((c) => ({
              ...c,
              messages: finalMsgs,
              updatedAt: Date.now(),
            }));
            loadConversations(currentId, {
              keepCurrent: true,
              skipMessages: true,
            }).catch(() => {});
          }
        },
        {
          signal: ctrl.signal,
          chat_model: model || cfg?.chat_model,
          chat_provider: provider || (cfg?.chat_provider as any),
          conversation_id: currentId || undefined,
          language,
        },
      );
    } catch (err: any) {
      if (ctrl.signal.aborted) {
        const partial = streamAnswer;
        if (partial) {
          const finalMsgs = [
            ...newMsgs,
            { role: "assistant", content: partial } as Message,
          ];
          setMessages(finalMsgs);
          setLastCitations([]);
          setUsedPrompt(undefined);
          setStreamAnswer("");
          updateCurrent((c) => ({
            ...c,
            messages: finalMsgs,
            updatedAt: Date.now(),
          }));
        }
      } else {
        const msg = (err as any)?.message || err;
        setMessages([
          ...newMsgs,
          {
            role: "assistant",
            content: t("chat.streamingError", { message: String(msg) }),
          },
        ]);
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
      await chatStream(
        withMessages,
        (ev: ChatStreamEvent) => {
          if (ev.type === "delta") {
            acc += ev.content || "";
            setStreamAnswer(acc);
          } else if (ev.type === "done") {
            const finalMsgs = [
              ...withMessages,
              { role: "assistant", content: acc } as Message,
            ];
            setMessages(finalMsgs);
            setLastCitations(ev.citations || []);
            setUsedPrompt(ev.used_prompt);
            setLastAnswerId(ev.answer_id || null);
            setFeedbackSent(null);
            setStreamAnswer("");
            updateCurrent((c) => ({
              ...c,
              messages: finalMsgs,
              updatedAt: Date.now(),
            }));
            loadConversations(currentId, {
              keepCurrent: true,
              skipMessages: true,
            }).catch(() => {});
          }
        },
        {
          chat_model: model || cfg?.chat_model,
          chat_provider: provider || (cfg?.chat_provider as any),
          conversation_id: currentId || undefined,
          signal: ctrl.signal,
          language,
        },
      );
    } catch (err) {
      if (!ctrl.signal.aborted) {
        const msg = (err as any)?.message || err;
        setMessages([
          ...withMessages,
          {
            role: "assistant",
            content: t("chat.streamingError", { message: String(msg) }),
          },
        ]);
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
      if (messages[i].role === "user") {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;
    const base = messages.slice(0, idx + 1);
    setMessages(base);
    startStream(base);
  }

  function handleContinue() {
    if (busy) return;
    const next = [
      ...messages,
      { role: "user", content: t("chat.typingContinue") } as Message,
    ];
    setMessages(next);
    startStream(next);
  }

  function handleCopyLast() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        navigator.clipboard.writeText(messages[i].content).catch(() => {});
        break;
      }
    }
  }

  function chatSuggestions(p?: string): string[] {
    const id = p || provider || "openai";
    if (id === "gemini") {
      return [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-8b",
      ];
    }
    if (id === "anthropic") {
      return [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
      ];
    }
    // OpenAI default
    return ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"];
  }

  function displayModelLabel(m: string): string {
    // Keep labels compact to avoid overflow
    // Anthropic Claude
    if (m.startsWith("claude-3-5-sonnet")) return "Claude 3.5 Sonnet";
    if (m.startsWith("claude-3-5-haiku")) return "Claude 3.5 Haiku";
    if (m.startsWith("claude-3-opus")) return "Claude 3 Opus";
    if (m.startsWith("claude-3-sonnet")) return "Claude 3 Sonnet";
    if (m.startsWith("claude-3-haiku")) return "Claude 3 Haiku";
    // Google Gemini
    if (m.startsWith("gemini-2.0-flash")) return "Gemini 2.0 Flash";
    if (m.startsWith("gemini-1.5-flash-8b")) return "Gemini 1.5 Flash 8B";
    if (m.startsWith("gemini-1.5-flash")) return "Gemini 1.5 Flash";
    if (m.startsWith("gemini-1.5-pro")) return "Gemini 1.5 Pro";
    // OpenAI
    if (m === "gpt-4o") return "GPT-4o";
    if (m === "gpt-4o-mini") return "4o-mini";
    if (m === "gpt-4.1") return "GPT-4.1";
    if (m === "gpt-4.1-mini") return "4.1-mini";
    if (m === "o3-mini") return "o3-mini";
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
  const maxInputHeight = Math.max(
    120,
    Math.min(260, (containerH ?? viewportH) * 0.3),
  );
  // useCallback gives a stable reference so Textarea's useEffect does not
  // re-fire on every parent render (onHeightChange is in its deps array).
  const handleInputHeightChange = useCallback(
    (h: number) => setInputHeight(h),
    [],
  );
  const clearInput = () => {
    setInput("");
    setInputKey((k) => k + 1);
  };

  const renderCitationsSection = () => {
    if (cfg && cfg.show_sources === false) return null;
    if (!lastCitations.length) return null;
    return (
      <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 shadow-surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              {t("chat.citationsTitle")}
            </p>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t("chat.citationsSubtitle")}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {usedPrompt && (
              <button
                type="button"
                className="rounded-full border border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] px-3 py-1 text-[11px] font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-50)]"
                onClick={() => setShowPrompt((v) => !v)}
              >
                {showPrompt ? t("chat.hidePrompt") : t("chat.showPrompt")}
              </button>
            )}
            <button
              type="button"
              className="rounded-full border border-[var(--border-light)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface)]"
              onClick={() => setRefsOpen((o) => !o)}
            >
              {refsOpen ? t("chat.hideSources") : t("chat.showSources")}
            </button>
            {lastAnswerId && (
              <div className="flex items-center gap-1 text-[var(--text-muted)]">
                <span>{t("chat.feedbackPrompt")}</span>
                <button
                  type="button"
                  disabled={!!feedbackSent}
                  onClick={async () => {
                    if (!lastAnswerId) return;
                    try {
                      await sendFeedback(lastAnswerId, "up");
                      setFeedbackSent("up");
                    } catch (_) {}
                  }}
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${feedbackSent === "up" ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"}`}
                >
                  {t("chat.feedbackUp")}
                </button>
                <button
                  type="button"
                  disabled={!!feedbackSent}
                  onClick={async () => {
                    if (!lastAnswerId) return;
                    try {
                      await sendFeedback(lastAnswerId, "down");
                      setFeedbackSent("down");
                    } catch (_) {}
                  }}
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${feedbackSent === "down" ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]" : "border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"}`}
                >
                  {t("chat.feedbackDown")}
                </button>
              </div>
            )}
          </div>
        </div>
        {refsOpen && (
          <div className="mt-4 space-y-3">
            {lastCitations.map((c, i) => (
              <article
                key={`${c.name}-${i}-${c.page ?? "na"}`}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[12px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {typeof c.page === "number"
                        ? t("chat.pageLabel", { page: c.page })
                        : t("chat.pageUnknown")}
                    </p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {t("chat.sourceLabel")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
        {showPrompt && usedPrompt && (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] p-3 text-[13px] text-[var(--brand-primary)]">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.3em]">
              {t("chat.systemPromptLabel")}
            </div>
            <pre className="whitespace-pre-wrap border-none bg-transparent p-0 text-[13px] text-[var(--brand-primary)] shadow-none">
              {usedPrompt}
            </pre>
          </div>
        )}
      </section>
    );
  };

  const composerActionClasses =
    "rounded-full border border-transparent px-3 py-1 text-[12px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]";
  const conversationTitle = displayTitle(
    convs.find((c) => c.id === currentId)?.title,
  );

  if (immersive) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-app)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm">
          <div className="font-semibold">{t("chat.immersiveTitle")}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
                setLastCitations([]);
                setUsedPrompt(undefined);
                updateCurrent((c) => ({
                  ...c,
                  messages: [],
                  updatedAt: Date.now(),
                }));
              }}
              disabled={busy}
            >
              {t("chat.clearMessages")}
            </Button>
            <Button variant="outline" onClick={() => setImmersive(false)}>
              {t("chat.exitImmersive")}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={chatRef}
            className="min-h-0 flex-1 overflow-auto p-4 md:p-6"
          >
            {messages.length === 0 && !streamAnswer && (
              <div className="text-[var(--text-muted)]">
                {t("chat.emptyState")}
              </div>
            )}
            <div className="grid gap-1">
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {busy && (
                <StreamingBubble
                  content={streamAnswer}
                  isTyping={!streamAnswer}
                />
              )}
              {renderCitationsSection()}
              {showScroller && (
                <div className="sticky bottom-2 flex justify-end pr-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = chatRef.current;
                      if (el)
                        el.scrollTo({
                          top: el.scrollHeight,
                          behavior: "smooth",
                        });
                    }}
                    className="rounded-full border border-[var(--border-light)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-surface hover:bg-[var(--surface-muted)]"
                  >
                    {t("chat.scrollToBottom")}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:p-5">
            <form onSubmit={onSend} className="flex items-end gap-3">
              <Textarea
                key={inputKey}
                ref={inputRef}
                value={input}
                rows={1}
                maxHeight={maxInputHeight}
                onHeightChange={handleInputHeightChange}
                placeholder={t("chat.inputPlaceholder")}
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
                  {t("chat.sending")}
                </Button>
              ) : (
                <Button
                  type="submit"
                  style={{ height: inputHeight }}
                  className="min-w-[72px] whitespace-nowrap"
                  disabled={busy}
                >
                  {t("chat.send")}
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
      className="relative mx-auto flex w-full max-w-[1800px] flex-1 gap-5 px-4 pb-6 pt-4 lg:gap-7 lg:px-8"
      style={{ height: containerH ? `${containerH}px` : undefined }}
    >
      <aside className="flex h-full w-[250px] shrink-0 flex-col overflow-hidden rounded-[30px] border border-[var(--border-light)] bg-[var(--surface)] shadow-panel">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-light)] px-4 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--text-muted)]">
              {t("chat.historyBadge")}
            </p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t("chat.conversationListTitle")}
            </h2>
          </div>
          <Button size="sm" onClick={newChat} disabled={!conversationsReady}>
            {t("chat.createConversation")}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1.5">
            {convs.map((c) => {
              const active = c.id === currentId;
              const baseClasses =
                "w-full rounded-2xl border px-3.5 py-3 text-left text-sm transition";
              const variant = active
                ? "border-[var(--border-subtle)] bg-[var(--surface-panel)] shadow-surface"
                : "border-transparent bg-[var(--surface-muted)] hover:border-[var(--border-light)] hover:bg-[var(--surface)]";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={async () => {
                    setCurrentId(c.id);
                    try {
                      setMessages(await fetchConversationMessages(c.id));
                    } catch {
                      setMessages([]);
                    }
                  }}
                  className={`${baseClasses} ${variant}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-semibold text-[var(--text-primary)]">
                      {displayTitle(c.title)}
                    </div>
                    {active && (
                      <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--brand-primary)]">
                        {t("chat.latestBadge")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                    {new Date(c.updatedAt).toLocaleString()}
                  </div>
                </button>
              );
            })}
            {!convs.length && (
              <div className="rounded-2xl border border-dashed border-[var(--border-light)] px-3 py-4 text-center text-[12px] text-[var(--text-muted)]">
                {t("chat.noConversations")}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-[var(--border-light)] px-4 py-4">
          {currentId ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={renameChat}
                disabled={!conversationsReady}
              >
                {t("chat.menuRename")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={deleteChat}
                disabled={!conversationsReady}
              >
                {t("chat.menuDelete")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              {t("chat.noConversations")}
            </p>
          )}
        </div>
      </aside>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[36px] border border-[var(--border-light)] bg-[var(--surface)] shadow-panel">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-light)] px-6 py-5 lg:px-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              {t("chat.activeLabel")}
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              {conversationTitle}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImmersive(true)}
            >
              {t("chat.immersiveMode")}
            </Button>
          </div>
        </header>

        <div className="border-b border-[var(--border-light)] px-6 py-4 lg:px-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
                {t("chat.providerLabel")}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {providerOptions.map((p) => {
                  const selected = provider === p.id;
                  const buttonClasses = selected
                    ? "border border-[var(--soft-brand-border)] bg-[var(--brand-primary)] text-white shadow-brand"
                    : "border border-[var(--border-light)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface)]";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      aria-pressed={selected}
                      className={`h-8 rounded-full px-3 text-[11px] font-semibold transition ${buttonClasses}`}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="hidden h-8 w-px bg-[var(--border-light)] lg:block" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--text-muted)] whitespace-nowrap">
                {t("chat.modelLabel")}
              </span>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]">
                {chatSuggestions(provider).map((m) => {
                  const selected = model === m;
                  const pillClasses = selected
                    ? "border border-[var(--soft-brand-border)] bg-[var(--brand-primary)] text-white shadow-brand"
                    : "border border-[var(--border-light)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface)]";
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      aria-pressed={selected}
                      className={`h-8 rounded-full px-3 text-[11px] font-semibold transition ${pillClasses}`}
                    >
                      {displayModelLabel(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 bg-[var(--surface-panel)]">
          <div
            ref={chatRef}
            className="flex h-full w-full flex-col gap-1 overflow-y-auto px-4 pb-32 pt-8 sm:px-8 lg:px-12"
          >
            {messages.length === 0 && !streamAnswer && (
              <div className="mx-auto w-full max-w-[640px] rounded-3xl border border-dashed border-[var(--border-light)] px-6 py-12 text-center text-sm text-[var(--text-muted)]">
                {t("chat.emptyState")}
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessage key={i} role={m.role} content={m.content} />
            ))}
            {busy && (
              <StreamingBubble
                content={streamAnswer}
                isTyping={!streamAnswer}
              />
            )}
            {renderCitationsSection()}
          </div>
          <div
            className={`pointer-events-none absolute bottom-8 right-8 transition-all duration-200 ${showScroller ? "opacity-100" : "translate-y-1 opacity-0"}`}
          >
            <button
              type="button"
              onClick={() => {
                const el = chatRef.current;
                if (el)
                  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              }}
              className="pointer-events-auto rounded-full border border-[var(--border-light)] bg-[var(--surface)] px-4 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] shadow-surface hover:bg-[var(--surface-muted)]"
            >
              {t("chat.scrollToBottom")}
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--border-light)] bg-[var(--surface)] px-4 py-4 sm:px-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {!busy && (
              <>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className={composerActionClasses}
                >
                  {t("chat.regenerate")}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  className={composerActionClasses}
                >
                  {t("chat.continue")}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLast}
                  className={composerActionClasses}
                >
                  {t("chat.copy")}
                </button>
              </>
            )}
          </div>
          <form onSubmit={onSend} className="flex items-end gap-3">
            <Textarea
              key={inputKey}
              ref={inputRef}
              value={input}
              rows={1}
              maxHeight={maxInputHeight}
              onHeightChange={handleInputHeightChange}
              placeholder={t("chat.inputPlaceholder")}
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
                {t("chat.sending")}
              </Button>
            ) : (
              <Button
                type="submit"
                style={{ height: inputHeight }}
                className="min-w-[96px] whitespace-nowrap"
                disabled={busy}
              >
                {t("chat.send")}
              </Button>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
