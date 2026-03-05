"use client";
import { useEffect, useState } from 'react';
import { getConfig, updateConfig, providerHealth } from "@/lib/api";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";

type Cfg = {
  chat_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  embedding_provider?: 'openai' | 'gemini' | 'anthropic' | string;
  chat_model: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
};

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{ chat?: string; embedding?: string }>({});
  const invalid = (() => {
    if (!cfg) return true;
    if (!cfg.chat_model || !cfg.embedding_model) return true;
    if (cfg.chunk_size <= 0) return true;
    if (cfg.chunk_overlap < 0 || cfg.chunk_overlap >= cfg.chunk_size) return true;
    if (cfg.top_k < 1) return true;
    return false;
  })();

  useEffect(() => {
    getConfig().then(setCfg).catch((e) => alert(e?.message || '設定載入失敗'));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setBusy(true);
    try {
      await updateConfig(cfg);
      alert('已儲存');
    } catch (e: any) {
      alert(e?.message || '儲存失敗');
    } finally {
      setBusy(false);
    }
  }

  function chatSuggestions(provider?: Cfg['chat_provider']): string[] {
    switch ((provider || 'openai')) {
      case 'gemini':
        return ['gemini-1.5-flash', 'gemini-1.5-pro'];
      case 'anthropic':
        return ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
      default:
        return ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];
    }
  }

  function embeddingSuggestions(provider?: Cfg['embedding_provider']): string[] {
    switch ((provider || 'openai')) {
      case 'gemini':
        return ['text-embedding-004'];
      default:
        return ['text-embedding-3-small', 'text-embedding-3-large'];
    }
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

  if (!cfg) return <div className="text-gray-500">載入中…</div>;

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">RAG 設定</h2>
        <Badge variant="brand">OpenAI</Badge>
      </div>
      <form onSubmit={onSave} className="max-w-3xl">
        <Card className="p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-sm">Chat 提供者 / 模型</label>
                <div className="flex items-center gap-2">
                  <select
                    className="w-40 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                    value={cfg.chat_provider || 'openai'}
                    onChange={(e) => setCfg({ ...cfg, chat_provider: e.target.value as Cfg['chat_provider'] })}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="anthropic">Claude (Anthropic)</option>
                  </select>
                  <Input list="chat-models" className="flex-1" value={cfg.chat_model} onChange={(e) => setCfg({ ...cfg, chat_model: e.target.value })} placeholder={
                    cfg.chat_provider === 'gemini' ? 'gemini-1.5-flash' : cfg.chat_provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini'
                  } />
                </div>
                <datalist id="chat-models">
                  {chatSuggestions(cfg.chat_provider).map((m) => (<option key={m} value={m} />))}
                </datalist>
                <div className="text-xs text-gray-500">OpenAI 對話模型（例如 gpt-4o-mini）。</div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">Embedding 提供者 / 模型</label>
                <div className="flex items-center gap-2">
                  <select
                    className="w-40 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                    value={cfg.embedding_provider || 'openai'}
                    onChange={(e) => setCfg({ ...cfg, embedding_provider: e.target.value as Cfg['embedding_provider'] })}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                  <Input list="emb-models" className="flex-1" value={cfg.embedding_model} onChange={(e) => setCfg({ ...cfg, embedding_model: e.target.value })} placeholder={
                    cfg.embedding_provider === 'gemini' ? 'text-embedding-004' : 'text-embedding-3-small'
                  } />
                </div>
                <datalist id="emb-models">
                  {embeddingSuggestions(cfg.embedding_provider).map((m) => (<option key={m} value={m} />))}
                </datalist>
                <div className="text-xs text-gray-500">OpenAI 向量化模型。</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="grid gap-1.5">
                <label className="text-sm">Chunk Size</label>
                <Input type="number" value={cfg.chunk_size} onChange={(e) => setCfg({ ...cfg, chunk_size: Number(e.target.value) })} />
                <div className="text-xs text-gray-500">每個 chunk 的字元數（預設 1000）。</div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">Chunk Overlap</label>
                <Input type="number" value={cfg.chunk_overlap} onChange={(e) => setCfg({ ...cfg, chunk_overlap: Number(e.target.value) })} />
                <div className="text-xs text-gray-500">必須小於 Chunk Size（預設 200）。</div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">Top K</label>
                <Input type="number" value={cfg.top_k} onChange={(e) => setCfg({ ...cfg, top_k: Number(e.target.value) })} />
                <div className="text-xs text-gray-500">每次檢索返回的片段數（預設 4）。</div>
              </div>
            </div>
            {cfg.chunk_overlap >= cfg.chunk_size && (
              <div className="text-sm text-red-600">Chunk Overlap 必須小於 Chunk Size。</div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div>供應商健康狀態：<span>{health.chat || '—'}</span> / <span>{health.embedding || '—'}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={onCheckProviders}>檢查供應商</Button>
                <Button disabled={busy || invalid}>{busy ? '儲存中…' : '儲存'}</Button>
              </div>
            </div>
          </div>
        </Card>
      </form>
      <div className="text-sm text-gray-500">注意：調整 Chunk Size / Overlap 僅影響後續上傳的文件。請重新上傳以重新建立索引。</div>
    </div>
  );
}
