"use client";
import { useEffect, useState } from 'react';
import { getConfig, updateConfig, providerHealth } from "@/lib/api";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Collapsible from "@/app/components/Collapsible";
import Tooltip from "@/app/components/ui/Tooltip";
import Segmented from "@/app/components/ui/Segmented";

type Cfg = {
  chat_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  embedding_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  chat_model: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  // Generation params
  temperature?: number;
  max_tokens?: number | null;
  top_p?: number | null;
  presence_penalty?: number | null;
  frequency_penalty?: number | null;
  // Fallback
  fallback_chat_provider?: string | null;
  fallback_chat_model?: string | null;
  // Simple mode fields
  ui_mode?: 'simple'|'advanced'|string;
  preset?: 'qna'|'summarize'|'extract'|'brainstorm'|'compliance'|string;
  creativity?: 'precise'|'balanced'|'creative'|string;
  answer_length?: 'short'|'medium'|'long'|string;
  show_sources?: boolean;
  override_retrieval?: boolean;
  override_generation?: boolean;
};

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [orig, setOrig] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{ chat?: string; embedding?: string }>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEmbedding, setShowEmbedding] = useState(false);
  const [tab, setTab] = useState<'simple'|'advanced'>('simple');
  const firstOr = <T,>(arr: T[], fallback: T) => (arr && arr.length ? arr[0] : fallback);
  const errs = (() => {
    if (!cfg) return { fatal: true } as any;
    return {
      chatModel: !cfg.chat_model,
      embModel: !cfg.embedding_model,
      chunkSize: cfg.chunk_size <= 0,
      overlap: cfg.chunk_overlap < 0 || cfg.chunk_overlap >= cfg.chunk_size,
      topK: cfg.top_k < 1,
      temp: cfg.temperature != null && (cfg.temperature < 0 || cfg.temperature > 2),
      topP: cfg.top_p != null && (cfg.top_p < 0 || cfg.top_p > 1),
      pres: cfg.presence_penalty != null && (cfg.presence_penalty < -2 || cfg.presence_penalty > 2),
      freq: cfg.frequency_penalty != null && (cfg.frequency_penalty < -2 || cfg.frequency_penalty > 2),
      maxTok: cfg.max_tokens != null && (cfg.max_tokens as number) < 1,
    };
  })();
  const invalid = !!(errs as any).fatal || Object.values(errs as any).some(Boolean);

  function scrollToField(id: string) {
    try {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).focus?.();
      }
    } catch {}
  }

  useEffect(() => {
    // Optimistic local defaults for instant load
    try {
      const tabLS = localStorage.getItem('settings.tab') as 'simple'|'advanced'|null;
      const preset = localStorage.getItem('settings.simple.preset') as any;
      const creativity = localStorage.getItem('settings.simple.creativity') as any;
      const length = localStorage.getItem('settings.simple.length') as any;
      const show = localStorage.getItem('settings.simple.show_sources');
      const optimistic: Cfg = {
        chat_provider: 'openai',
        embedding_provider: 'openai',
        chat_model: 'gpt-4o-mini',
        embedding_model: 'text-embedding-3-small',
        chunk_size: 1000,
        chunk_overlap: 200,
        top_k: 4,
        temperature: 0.5,
        top_p: 1,
        presence_penalty: 0,
        frequency_penalty: 0,
        fallback_chat_provider: null,
        fallback_chat_model: null,
        ui_mode: tabLS || 'simple',
        preset: preset || 'qna',
        creativity: creativity || 'balanced',
        answer_length: length || 'medium',
        show_sources: show ? show === 'true' : true,
        override_generation: false,
        override_retrieval: false,
      };
      setCfg(optimistic);
      setTab(optimistic.ui_mode as any);
    } catch {}
    getConfig()
      .then((c) => { setCfg((prev) => ({ ...(prev as any), ...c })); setOrig(c); })
      .catch((e) => alert(e?.message || '載入設定失敗'));
  }, []);

  useEffect(() => {
    if (!cfg) return;
    setTab((cfg.ui_mode as any) === 'advanced' ? 'advanced' : 'simple');
  }, [cfg?.ui_mode]);

  // Keep chat/embedding models consistent with provider selection when no free-text input is shown for chat model
  useEffect(() => {
    if (!cfg) return;
    const sugg = chatSuggestions(cfg.chat_provider);
    if (!sugg.includes(cfg.chat_model)) {
      setCfg({ ...cfg, chat_model: sugg[0] || cfg.chat_model });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.chat_provider]);
  useEffect(() => {
    if (!cfg) return;
    const sugg = embeddingSuggestions(cfg.embedding_provider);
    if (!sugg.includes(cfg.embedding_model)) {
      setCfg({ ...cfg, embedding_model: sugg[0] || cfg.embedding_model });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.embedding_provider]);

  // Keyboard shortcuts: 1..5 to select presets in Simple mode
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab !== 'simple' || !cfg) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) return;
      const map: Record<string, Cfg['preset']> = {
        '1': 'qna',
        '2': 'summarize',
        '3': 'extract',
        '4': 'brainstorm',
        '5': 'compliance',
      };
      const p = map[e.key as string];
      if (p) {
        setCfg({ ...cfg, preset: p });
        try { localStorage.setItem('settings.simple.preset', p); } catch {}
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, cfg]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setBusy(true);
    try {
      const saved = await updateConfig(cfg);
      setOrig(saved);
      alert('設定已更新');
    } catch (e: any) {
      alert(e?.message || '儲存失敗：無法儲存設定，請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  function pickForCompare(c: Cfg) {
    return {
      chat_provider: c.chat_provider || 'openai',
      chat_model: c.chat_model,
      embedding_provider: c.embedding_provider || 'openai',
      embedding_model: c.embedding_model,
      chunk_size: c.chunk_size,
      chunk_overlap: c.chunk_overlap,
      top_k: c.top_k,
      temperature: c.temperature ?? null,
      top_p: c.top_p ?? null,
      presence_penalty: c.presence_penalty ?? null,
      frequency_penalty: c.frequency_penalty ?? null,
      max_tokens: c.max_tokens ?? null,
      fallback_chat_provider: c.fallback_chat_provider ?? null,
      fallback_chat_model: c.fallback_chat_model ?? null,
      ui_mode: c.ui_mode || 'simple',
      preset: c.preset || 'qna',
      creativity: c.creativity || 'balanced',
      answer_length: c.answer_length || 'medium',
      show_sources: !!c.show_sources,
      override_generation: !!c.override_generation,
      override_retrieval: !!c.override_retrieval,
    } as const;
  }

  const dirty = (() => {
    if (!cfg || !orig) return false;
    try { return JSON.stringify(pickForCompare(cfg)) !== JSON.stringify(pickForCompare(orig)); } catch { return false; }
  })();

  function chatSuggestions(provider?: Cfg['chat_provider']): string[] {
    switch ((provider || 'openai')) {
      case 'gemini':
        return ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b'];
      case 'anthropic':
        return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
      default:
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'];
    }
  }

  function displayChatModel(id: string, provider?: Cfg['chat_provider']): string {
    const p = (provider || 'openai');
    if (p === 'anthropic') {
      if (/claude-3-5-sonnet/i.test(id)) return 'Claude Sonnet 3.5';
      if (/claude-3-5-haiku/i.test(id)) return 'Claude Haiku 3.5';
      if (/claude-3-opus/i.test(id)) return 'Claude Opus 3';
      if (/claude-3-sonnet/i.test(id)) return 'Claude Sonnet 3';
      if (/claude-3-haiku/i.test(id)) return 'Claude Haiku 3';
    }
    return id;
  }

  function embeddingSuggestions(provider?: Cfg['embedding_provider']): string[] {
    switch ((provider || 'openai')) {
      case 'gemini':
        return ['text-embedding-004'];
      default:
        return ['text-embedding-3-small', 'text-embedding-3-large'];
    }
  }

  function chatPlaceholder(p?: Cfg['chat_provider']): string {
    const first = chatSuggestions(p)[0];
    return `自訂模型 ID（例如 ${first || 'gpt-4o-mini'}）`;
  }

  function embPlaceholder(p?: Cfg['embedding_provider']): string {
    const first = embeddingSuggestions(p)[0];
    return `自訂模型 ID（例如 ${first || 'text-embedding-3-small'}）`;
  }

  async function onCheckProviders() {
    try {
      const res = await providerHealth();
      setHealth({
        chat: res.chat.ok ? `✅ ${res.chat.provider}` : `❌ ${res.chat.provider}: ${res.chat.error || res.chat.details || 'fail'}`,
        embedding: res.embedding.ok ? `✅ ${res.embedding.provider}` : `❌ ${res.embedding.provider}: ${res.embedding.error || res.embedding.details || 'fail'}`,
      });
    } catch (e: any) {
      setHealth({ chat: '❌ 檢查失敗', embedding: '❌ 檢查失敗' });
    }
  }

  function handleResetToRecommended() {
    if (!cfg) return;
    const cp = (cfg.chat_provider || 'openai') as Cfg['chat_provider'];
    const ep = (cfg.embedding_provider || 'openai') as Cfg['embedding_provider'];
    const recChat = firstOr(chatSuggestions(cp), 'gpt-4o-mini');
    const recEmb = firstOr(embeddingSuggestions(ep), 'text-embedding-3-small');
    setCfg({
      ...cfg,
      chat_provider: cp,
      embedding_provider: ep,
      chat_model: recChat,
      embedding_model: recEmb,
      chunk_size: 1000,
      chunk_overlap: 200,
      top_k: 4,
    });
  }

  if (!cfg) return <div className="text-gray-500">載入設定中…</div>;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Sidebar */}
      <aside className="col-span-12 md:col-span-3">
        <div className="sticky top-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">設定</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">管理模型、檢索與回答風格。</p>
          </div>
          <Card className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">提供者健康</div>
              <Button variant="outline" size="sm" type="button" onClick={onCheckProviders}>檢查</Button>
            </div>
            <div className="grid gap-1 text-xs">
              <div className="flex items-center justify-between"><span>Chat</span><span>{health.chat || '—'}</span></div>
              <div className="flex items-center justify-between"><span>Embedding</span><span>{health.embedding || '—'}</span></div>
            </div>
          </Card>
          <nav className="mt-4 grid gap-1 text-sm">
            <a href="#mode" className="rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800">模式</a>
            <a href="#models" className="rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800">模型</a>
            {tab === 'simple' && <a href="#simple" className="rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800">簡易模式</a>}
            {tab === 'advanced' && <a href="#generation" className="rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800">生成參數</a>}
            {tab === 'advanced' && <a href="#retrieval" className="rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800">檢索參數</a>}
          </nav>
          <div className="mt-4 grid gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => getConfig().then((c)=>{ setCfg(c); setOrig(c); }).catch(()=>{})}>重設為後端預設</Button>
            <Button variant="outline" size="sm" type="button" onClick={handleResetToRecommended}>重設建議值</Button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <section className="col-span-12 md:col-span-9">
        <form onSubmit={onSave} className="grid gap-6">
          {/* Mode */}
          <Card id="mode" className="p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">設定模式</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">簡易提供快速選項；進階可手動微調。</div>
              </div>
              <Segmented
                name="設定模式"
                options={[{id:'simple',label:'簡易', tooltip:'快捷選項與常見預設'},{id:'advanced',label:'進階', tooltip:'完整調整生成與檢索參數'}]}
                value={tab}
                onChange={(t)=>{ setTab(t as any); if (cfg) setCfg({ ...cfg, ui_mode: t }); try{ localStorage.setItem('settings.tab', t);}catch{} }}
              />
            </div>
          </Card>

          {/* Models */}
          <Card id="models" className="p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">模型提供者與型號</h3>
            </div>
            <div className="grid gap-6">
              {/* Chat provider & model */}
              <section className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm">Chat 提供者</label>
                  <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800" aria-label="Chat 提供者">
                    {(['openai','gemini','anthropic'] as const).map((p) => (
                      <Tooltip key={p} content={p==='openai' ? 'OpenAI：例如 gpt-4o-mini / gpt-4o' : p==='gemini' ? 'Gemini：例如 gemini-1.5-flash / 2.0-flash' : 'Claude：例如 claude-3-5-sonnet'}>
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCfg({ ...cfg!, chat_provider: p })}
                          aria-pressed={cfg!.chat_provider === p || (!cfg!.chat_provider && p==='openai')}
                          className={`h-7 px-2.5 text-[12px] leading-none rounded-md transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                            (cfg!.chat_provider || 'openai') === p
                              ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-700'
                          }`}
                          tabIndex={0}
                        >{p === 'anthropic' ? 'Claude' : p[0].toUpperCase() + p.slice(1)}</button>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">推薦型號</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]" aria-label="Chat 常用模型">
                    {chatSuggestions(cfg.chat_provider).map((m) => (
                      <Tooltip key={m} content={`套用模型：${m}`}>
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCfg({ ...cfg!, chat_model: m })}
                          className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-[12px] leading-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                            cfg!.chat_model === m ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'
                          }`}
                          tabIndex={0}
                          aria-pressed={cfg!.chat_model === m}
                        >{displayChatModel(m, cfg.chat_provider)}</button>
                      </Tooltip>
                    ))}
                  </div>
                  {/* Chat model free-text removed per requirement */}
                </div>
              </section>

              {/* Embedding provider & model */}
              <section className="grid gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100">嵌入模型（Embedding）</h4>
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setShowEmbedding(v => !v)}>
                    <span className={`transition-transform duration-150 ${showEmbedding ? 'rotate-180' : 'rotate-0'}`}>⌄</span>
                    {showEmbedding ? '隱藏' : '顯示'}
                  </button>
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800" aria-label="Embedding 提供者">
                  {(['openai','gemini'] as const).map((p) => (
                    <Tooltip key={p} content={p==='openai' ? 'OpenAI 向量：text-embedding-3-small/large' : 'Gemini 向量：text-embedding-004'}>
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCfg({ ...cfg!, embedding_provider: p })}
                        aria-pressed={cfg!.embedding_provider === p || (!cfg!.embedding_provider && p==='openai')}
                        className={`h-7 px-2.5 text-[12px] leading-none rounded-md transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                          (cfg!.embedding_provider || 'openai') === p
                            ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-700'
                        }`}
                        tabIndex={0}
                      >{p[0].toUpperCase() + p.slice(1)}</button>
                    </Tooltip>
                  ))}
                </div>
                <Collapsible open={showEmbedding}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">推薦型號</span>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]" aria-label="Embedding 常用模型">
                      {embeddingSuggestions(cfg.embedding_provider).map((m) => (
                        <Tooltip key={m} content={`套用向量模型：${m}`}>
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCfg({ ...cfg!, embedding_model: m })}
                            className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-[12px] leading-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                              cfg!.embedding_model === m ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200'
                            }`}
                            tabIndex={0}
                          >{m}</button>
                        </Tooltip>
                      ))}
                    </div>
                    <div className="min-w-[240px] flex-1">
                      <Input id="emb-model-input" aria-label="自訂 Embedding 模型 ID" value={cfg.embedding_model} onChange={(e) => setCfg({ ...cfg, embedding_model: e.target.value })} placeholder={embPlaceholder(cfg.embedding_provider)} />
                      {errs.embModel && (<div className="mt-1 text-xs text-red-600">請輸入有效的向量模型 ID。</div>)}
                    </div>
                  </div>
                </Collapsible>
              </section>
            </div>
          </Card>

          {/* Simple mode */}
          {tab === 'simple' && (
            <Card id="simple" className="p-4 md:p-5">
              <div className="grid gap-4">
                {/* Presets */}
                <div className="grid gap-3">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">使用情境</div>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {[
                      {id:'qna',title:'Q&A with Sources',desc:'問答並附來源',icon:'📚'},
                      {id:'summarize',title:'Summarize & Explain',desc:'總結與說明',icon:'📝'},
                      {id:'extract',title:'Extract & Structure',desc:'萃取與結構化',icon:'🧩'},
                      {id:'brainstorm',title:'Brainstorm',desc:'發想與提案',icon:'💡'},
                      {id:'compliance',title:'Strict Compliance',desc:'嚴謹與一致',icon:'✅'},
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setCfg({ ...cfg, preset: p.id as any }); try{ localStorage.setItem('settings.simple.preset', p.id);}catch{}}}
                        className={`relative flex h-full flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                          cfg.preset===p.id ? 'border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-200 dark:border-indigo-900/40 dark:bg-indigo-950/20' : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800'
                        }`}
                        tabIndex={0}
                        aria-pressed={cfg.preset===p.id}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-lg leading-none">{p.icon}</span>
                          <span className="text-sm font-semibold">{p.title}</span>
                        </div>
                        <div className="text-xs text-gray-500">{p.desc}</div>
                        {cfg.preset===p.id && (
                          <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white shadow-sm">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Essentials */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label className="text-sm inline-flex items-center gap-1">Creativity
                      <Tooltip content="控制模型的發散程度。精準更穩定、創意更活潑。">
                        <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] text-gray-600 dark:text-gray-300">i</span>
                      </Tooltip>
                    </label>
                    <Segmented
                      name="Creativity"
                      options={[{id:'precise',label:'精準'},{id:'balanced',label:'平衡'},{id:'creative',label:'創意'}]}
                      value={cfg.creativity || 'balanced'}
                      onChange={(v)=>{ setCfg({ ...cfg, creativity: v as any }); try{ localStorage.setItem('settings.simple.creativity', v);}catch{} }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm inline-flex items-center gap-1">回答長度
                      <Tooltip content="短：重點扼要；中：適中；長：詳盡。">
                        <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] text-gray-600 dark:text-gray-300">i</span>
                      </Tooltip>
                    </label>
                    <Segmented
                      name="Answer Length"
                      options={[{id:'short',label:'短'},{id:'medium',label:'中'},{id:'long',label:'長'}]}
                      value={cfg.answer_length || 'medium'}
                      onChange={(v)=>{ setCfg({ ...cfg, answer_length: v as any }); try{ localStorage.setItem('settings.simple.length', v);}catch{} }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm inline-flex items-center gap-1">顯示來源（Citations）
                      <Tooltip content="回答會附上引用片段與文件來源。">
                        <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] text-gray-600 dark:text-gray-300">i</span>
                      </Tooltip>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={cfg.show_sources !== false} onChange={(e)=>{ setCfg({ ...cfg, show_sources: e.target.checked }); try{ localStorage.setItem('settings.simple.show_sources', String(e.target.checked)); }catch{} }} />
                      顯示引用來源
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Advanced: Generation */}
          {tab === 'advanced' && (
          <Card id="generation" className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">生成參數</h3>
              <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={!!cfg.override_generation} onChange={(e)=> setCfg({ ...cfg!, override_generation: e.target.checked })} /> 手動調整
              </label>
            </div>
            <div className={`mt-3 grid gap-3 md:grid-cols-2 ${cfg!.override_generation ? '' : 'opacity-60'}`} aria-disabled={!cfg!.override_generation}>
              <div className="grid gap-1.5">
                <label className="text-sm inline-flex items-center gap-1">溫度（Temperature）
                  <Tooltip content="範例：精準 0.2／平衡 0.5／創意 0.9">
                    <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] text-gray-600 dark:text-gray-300">i</span>
                  </Tooltip>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={cfg.temperature ?? 0.2}
                    onChange={(e) => setCfg({ ...cfg!, temperature: Number(e.target.value) })}
                    disabled={!cfg!.override_generation}
                    className="flex-1"
                  />
                  <Input id="temp-number"
                    type="number"
                    step={0.1}
                    min={0}
                    max={2}
                    className="w-24"
                    value={cfg.temperature ?? 0.2}
                    onChange={(e) => setCfg({ ...cfg!, temperature: Number(e.target.value) })}
                    disabled={!cfg!.override_generation}
                  />
                </div>
                <div className="text-xs text-gray-500">0 更穩定、2 更具創造性。建議 0.2–0.8。</div>
                {errs.temp && (<div className="text-xs text-red-600">溫度範圍需在 0–2。</div>)}
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm inline-flex items-center gap-1">Top P
                  <Tooltip content="範例：保守 0.3／平衡 0.7／多樣 1.0">
                    <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] text-gray-600 dark:text-gray-300">i</span>
                  </Tooltip>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfg.top_p ?? 1}
                    onChange={(e) => setCfg({ ...cfg!, top_p: Number(e.target.value) })}
                    disabled={!cfg!.override_generation}
                    className="flex-1"
                  />
                  <Input id="topp-number" type="number" step={0.05} min={0} max={1} className="w-24" value={cfg.top_p ?? 1} onChange={(e) => setCfg({ ...cfg!, top_p: Number(e.target.value) })} disabled={!cfg!.override_generation} />
                </div>
                {errs.topP && (<div className="text-xs text-red-600">Top P 範圍需在 0–1。</div>)}
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm inline-flex items-center gap-1">Presence Penalty</label>
                <Input id="pres-number" type="number" step={0.1} min={-2} max={2} className="w-32" value={cfg.presence_penalty ?? 0} onChange={(e) => setCfg({ ...cfg!, presence_penalty: Number(e.target.value) })} disabled={!cfg!.override_generation} />
                {errs.pres && (<div className="text-xs text-red-600">需介於 -2 與 2。</div>)}
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm inline-flex items-center gap-1">Frequency Penalty</label>
                <Input id="freq-number" type="number" step={0.1} min={-2} max={2} className="w-32" value={cfg.frequency_penalty ?? 0} onChange={(e) => setCfg({ ...cfg!, frequency_penalty: Number(e.target.value) })} disabled={!cfg!.override_generation} />
                {errs.freq && (<div className="text-xs text-red-600">需介於 -2 與 2。</div>)}
              </div>
              <div className="grid gap-1.5 md:col-span-2">
                <label className="text-sm inline-flex items-center gap-1">最大輸出 Tokens</label>
                <Input id="max-tokens-input" type="number" min={1} step={1} className="w-40" value={cfg.max_tokens ?? ''} onChange={(e) => setCfg({ ...cfg!, max_tokens: e.target.value ? Number(e.target.value) : null })} disabled={!cfg!.override_generation} />
                {errs.maxTok && (<div className="text-xs text-red-600">請輸入正整數或留空。</div>)}
              </div>
            </div>
          </Card>
          )}

          {/* Advanced: Retrieval */}
          {tab === 'advanced' && (
          <Card id="retrieval" className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">檢索參數</h3>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={!!cfg.override_retrieval} onChange={(e)=> setCfg({ ...cfg!, override_retrieval: e.target.checked })} /> 手動調整
                </label>
                <button type="button" className="text-xs text-indigo-600 underline hover:opacity-90 dark:text-indigo-400" onClick={() => setShowAdvanced((v)=>!v)}>
                  {showAdvanced ? '隱藏説明' : '顯示説明'}
                </button>
              </div>
            </div>
            <Collapsible open={showAdvanced}>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Chunk 與重疊只影響未來上傳文件；既有索引需重新上傳重建。</p>
            </Collapsible>
            <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 ${cfg!.override_retrieval ? '' : 'opacity-60'}`} aria-disabled={!cfg!.override_retrieval}>
              <div className="grid gap-1.5">
                <label className="text-sm">Chunk 大小</label>
                <Input id="chunk-size-input" type="number" min={1} step={1} value={cfg.chunk_size} onChange={(e) => setCfg({ ...cfg!, chunk_size: Number(e.target.value) })} disabled={!cfg!.override_retrieval} />
                <div className="text-xs text-gray-500">每段文字的最大字元數，建議 1000。</div>
                {errs.chunkSize && (<div className="text-xs text-red-600">Chunk 大小必須大於 0。</div>)}
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">重疊長度</label>
                <Input id="chunk-overlap-input" type="number" min={0} step={1} value={cfg.chunk_overlap} onChange={(e) => setCfg({ ...cfg!, chunk_overlap: Number(e.target.value) })} disabled={!cfg!.override_retrieval} />
                <div className="text-xs text-gray-500">相鄰段落的重疊字元，建議 200（需小於 Chunk 大小）。</div>
                {errs.overlap && (<div className="text-xs text-red-600">重疊長度需在 0 與 Chunk 大小之間。</div>)}
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">檢索份數（Top K）</label>
                <Input id="topk-input" type="number" min={1} step={1} value={cfg.top_k} onChange={(e) => setCfg({ ...cfg!, top_k: Number(e.target.value) })} disabled={!cfg!.override_retrieval} />
                <div className="text-xs text-gray-500">每次取回的相關片段數，建議 4。</div>
                {errs.topK && (<div className="text-xs text-red-600">Top K 必須大於或等於 1。</div>)}
              </div>
            </div>
            {cfg.chunk_overlap >= cfg.chunk_size && (
              <div className="text-sm text-red-600">Chunk Overlap 必須小於 Chunk Size。</div>
            )}
          </Card>
          )}

          {/* Error summary */}
          {invalid && (
            <Card className="p-3">
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                <div className="mb-1 font-medium">有幾個欄位需要修正：</div>
                <div className="flex flex-wrap gap-2">
                  {errs.chatModel && (<button type="button" className="underline" onClick={()=>scrollToField('models')}>Chat 模型</button>)}
                  {errs.embModel && (<button type="button" className="underline" onClick={()=>scrollToField('emb-model-input')}>Embedding 模型</button>)}
                  {tab === 'advanced' && errs.chunkSize && (<button type="button" className="underline" onClick={()=>scrollToField('chunk-size-input')}>Chunk 大小</button>)}
                  {tab === 'advanced' && errs.overlap && (<button type="button" className="underline" onClick={()=>scrollToField('chunk-overlap-input')}>重疊長度</button>)}
                  {tab === 'advanced' && errs.topK && (<button type="button" className="underline" onClick={()=>scrollToField('topk-input')}>Top K</button>)}
                  {tab === 'advanced' && errs.temp && (<button type="button" className="underline" onClick={()=>scrollToField('temp-number')}>溫度</button>)}
                  {tab === 'advanced' && errs.topP && (<button type="button" className="underline" onClick={()=>scrollToField('topp-number')}>Top P</button>)}
                  {tab === 'advanced' && errs.pres && (<button type="button" className="underline" onClick={()=>scrollToField('pres-number')}>Presence Penalty</button>)}
                  {tab === 'advanced' && errs.freq && (<button type="button" className="underline" onClick={()=>scrollToField('freq-number')}>Frequency Penalty</button>)}
                  {tab === 'advanced' && errs.maxTok && (<button type="button" className="underline" onClick={()=>scrollToField('max-tokens-input')}>最大輸出 Tokens</button>)}
                </div>
              </div>
            </Card>
          )}

          {/* Save bar */}
          <div className="sticky bottom-0 z-10 -mb-2 -mx-1 mt-2">
            <div className="pointer-events-none bg-gradient-to-t from-white to-transparent pb-2 pt-10 dark:from-neutral-900">
              <div className="pointer-events-auto flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" type="button" onClick={handleResetToRecommended}>建議值</Button>
                <Button size="sm" disabled={busy || invalid || !dirty}>{busy ? '儲存中…' : dirty ? '儲存' : '已儲存'}</Button>
              </div>
            </div>
          </div>
        </form>

        <div className="mt-4 text-sm text-gray-500">注意：調整 Chunk/Overlap 僅影響後續上傳文件；需重新上傳以重建索引。</div>
      </section>
    </div>
  );
}
