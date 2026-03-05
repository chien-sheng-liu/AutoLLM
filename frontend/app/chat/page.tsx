"use client";
import { useEffect, useRef, useState } from "react";
import type { Message, Citation, ChatStreamEvent, Config } from "@/lib/api";
import { chatStream, getConfig } from "@/lib/api";
import ChatMessage from "@/app/components/ChatMessage";
import Button from "@/app/components/ui/Button";
import Textarea from "@/app/components/ui/Textarea";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import { createConversation, loadConversations, saveConversations, titleFromMessages, type Conversation } from "@/lib/conversations";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCitations, setLastCitations] = useState<Citation[]>([]);
  const [usedPrompt, setUsedPrompt] = useState<string | undefined>(undefined);
  const [showPrompt, setShowPrompt] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
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
    getConfig().then((c) => {
      setCfg(c);
      setModel(c.chat_model);
    }).catch(() => {});
  }, []);

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
    setInput("");
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
          setStreamAnswer("");
          updateCurrent((c) => ({ ...c, messages: finalMsgs, updatedAt: Date.now() }));
        }
      }, { signal: ctrl.signal, chat_model: model || cfg?.chat_model });
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

  // 自動調整輸入框高度
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 220; // px
    el.style.height = Math.min(el.scrollHeight, max) + "px";
    setInputHeight(el.offsetHeight);
  }, [input]);

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
              {lastCitations.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">參考來源（{lastCitations.length}）</h3>
                    <div className="flex items-center gap-2">
                      {usedPrompt && (
                        <button
                          className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                          onClick={() => setShowPrompt((v) => !v)}
                        >
                          {showPrompt ? "隱藏提示詞" : "顯示提示詞"}
                        </button>
                      )}
                      <button
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                        onClick={() => setRefsOpen((o) => !o)}
                      >
                        {refsOpen ? "收合" : "展開"}
                      </button>
                    </div>
                  </div>
                  {refsOpen && (
                    <>
                      <div className="mt-3 grid gap-2">
                        {lastCitations.map((c, i) => (
                          <div key={c.chunk_id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-800">
                            <div className="grid gap-1">
                              <div className="flex items-baseline gap-2">
                                <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-neutral-700">{i + 1}</span>
                                <strong>{c.name}</strong>
                                <span className="text-xs text-gray-500">相似度 {c.score.toFixed(3)}</span>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">{c.snippet}</div>
                            </div>
                            <span className="text-xs text-gray-500">片段 #{c.chunk_id}</span>
                          </div>
                        ))}
                      </div>
                      {showPrompt && usedPrompt && (
                        <div className="mt-3">
                          <div className="mb-2 text-xs text-gray-500">實際使用的提示詞</div>
                          <pre>{usedPrompt}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
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
                  <Button className="cursor-not-allowed whitespace-nowrap opacity-60" style={{ height: inputHeight }} disabled>
                    傳送中…
                  </Button>
                </>
              ) : (
                <Button style={{ height: inputHeight }} className="min-w-[72px] whitespace-nowrap" disabled={busy}>
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
    <div ref={rootRef} className="grid gap-6 md:grid-cols-12" style={{ height: containerH ? `${containerH}px` : undefined, overflow: containerH ? 'hidden' : undefined }}>
      {/* Sidebar */}
      <Card className={`p-3 md:col-span-2 ${sidebarOpen ? "" : "hidden md:block"} h-full overflow-auto`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">會話</div>
          <Button variant="outline" size="sm" onClick={newChat}>新對話</Button>
        </div>
        <div className="grid gap-1">
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCurrentId(c.id);
                setMessages(c.messages);
                setSidebarOpen(false);
              }}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 ${
                c.id === currentId ? "bg-gray-100 dark:bg-neutral-800" : ""
              }`}
            >
              <div className="truncate">{c.title || "新的對話"}</div>
              <div className="truncate text-xs text-gray-500">{new Date(c.updatedAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
        {currentId && (
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={renameChat}>重新命名</Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={deleteChat}>刪除</Button>
          </div>
        )}
      </Card>

      {/* Chat content */}
      <div className="md:col-span-10 flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">聊天</h2>
            <span className="hidden rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:border-neutral-800 dark:text-gray-300 md:inline">{messages.length} 則訊息</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-gray-500 md:inline">模型</span>
              <Input
                list="chat-model-suggest"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={cfg?.chat_provider === 'gemini' ? 'gemini-1.5-flash' : cfg?.chat_provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini'}
                className="w-56"
              />
              <datalist id="chat-model-suggest">
                {(cfg?.chat_provider === 'gemini'
                  ? ['gemini-1.5-flash','gemini-1.5-pro']
                  : cfg?.chat_provider === 'anthropic'
                  ? ['claude-3-haiku-20240307','claude-3-sonnet-20240229','claude-3-opus-20240229']
                  : ['gpt-4o-mini','gpt-4o','o3-mini']
                ).map((m) => (<option key={m} value={m} />))}
              </datalist>
            </div>
            <Button variant="outline" className="md:hidden" onClick={() => setSidebarOpen((s) => !s)}>
              {sidebarOpen ? "關閉會話" : "開啟會話"}
            </Button>
            <Button variant="outline" onClick={() => setImmersive(true)}>全螢幕</Button>
          </div>
        </div>

        <Card className="flex h-full flex-col">
          <div ref={chatRef} className="flex-1 overflow-auto p-4 md:p-6">
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

              {lastCitations.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">參考來源（{lastCitations.length}）</h3>
                    <div className="flex items-center gap-2">
                      {usedPrompt && (
                        <button
                          className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                          onClick={() => setShowPrompt((v) => !v)}
                        >
                          {showPrompt ? "隱藏提示詞" : "顯示提示詞"}
                        </button>
                      )}
                      <button
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                        onClick={() => setRefsOpen((o) => !o)}
                      >
                        {refsOpen ? "收合" : "展開"}
                      </button>
                    </div>
                  </div>
                  {refsOpen && (
                    <>
                      <div className="mt-3 grid gap-2">
                        {lastCitations.map((c, i) => (
                          <div key={c.chunk_id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-800">
                            <div className="grid gap-1">
                              <div className="flex items-baseline gap-2">
                                <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-neutral-700">{i + 1}</span>
                                <strong>{c.name}</strong>
                                <span className="text-xs text-gray-500">相似度 {c.score.toFixed(3)}</span>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">{c.snippet}</div>
                            </div>
                            <span className="text-xs text-gray-500">片段 #{c.chunk_id}</span>
                          </div>
                        ))}
                      </div>
                      {showPrompt && usedPrompt && (
                        <div className="mt-3">
                          <div className="mb-2 text-xs text-gray-500">實際使用的提示詞</div>
                          <pre>{usedPrompt}</pre>
                        </div>
                      )}
                    </>
                  )}
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
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap"
                    style={{ height: inputHeight }}
                    onClick={() => abortCtrl?.abort()}
                  >
                    停止
                  </Button>
                  <Button className="cursor-not-allowed whitespace-nowrap opacity-60" style={{ height: inputHeight }} disabled>
                    傳送中…
                  </Button>
                </>
              ) : (
                <Button style={{ height: inputHeight }} className="min-w-[72px] whitespace-nowrap" disabled={busy}>
                  送出
                </Button>
              )}
            </form>
          </div>
          
        </Card>

        {/* References moved inside chat card to avoid page scroll */}
      </div>
    </div>
  );
}
