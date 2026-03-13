'use client';

import { useState, useEffect, useMemo } from 'react';
import type { PromptSection } from '@/lib/api';
import { getPrompts, updatePrompts, resetPrompt, resetAllPrompts } from '@/lib/api';

// Agent display metadata
const AGENT_META: Record<string, { label: string; description: string; color: string }> = {
  reasoning: {
    label: 'Reasoning Agent',
    description: '第一層：負責意圖分析、安全過濾，以及決定路由到哪個 sub-agent。',
    color: 'text-purple-400',
  },
  answer_generation: {
    label: 'Answer Agent',
    description: '從知識庫檢索相關文件，根據來源生成有引用的回答。',
    color: 'text-cyan-400',
  },
  chitchat: {
    label: 'Chitchat Agent',
    description: '處理閒聊與範疇外問題，不進行文件檢索，語氣輕鬆自然。',
    color: 'text-green-400',
  },
};

export default function PromptEditor() {
  const [sections, setSections] = useState<PromptSection[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    getPrompts()
      .then((data) => {
        setSections(data);
        // Initialize drafts from current_value
        const init: Record<string, string> = {};
        data.forEach((s) => { init[s.key] = s.current_value; });
        setDrafts(init);
      })
      .catch(() => setError('無法載入 Prompt 設定'))
      .finally(() => setLoading(false));
  }, []);

  // Group sections by agent
  const grouped = useMemo(() => {
    const groups: Record<string, PromptSection[]> = {};
    sections.forEach((s) => {
      if (!groups[s.agent]) groups[s.agent] = [];
      groups[s.agent].push(s);
    });
    return groups;
  }, [sections]);

  const isDirty = (key: string) => {
    const original = sections.find((s) => s.key === key);
    return original ? drafts[key] !== original.current_value : false;
  };

  const hasAnyDraft = sections.some((s) => isDirty(s.key));

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function handleSave() {
    const changed: Record<string, string> = {};
    sections.forEach((s) => {
      if (isDirty(s.key)) changed[s.key] = drafts[s.key];
    });
    if (!Object.keys(changed).length) return;
    setSaving(true);
    try {
      await updatePrompts(changed);
      // Re-fetch to get updated is_overridden flags
      const fresh = await getPrompts();
      setSections(fresh);
      const init: Record<string, string> = {};
      fresh.forEach((s) => { init[s.key] = s.current_value; });
      setDrafts(init);
      flash('已儲存');
    } catch (e: any) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetOne(key: string) {
    setSaving(true);
    try {
      await resetPrompt(key);
      const fresh = await getPrompts();
      setSections(fresh);
      const init: Record<string, string> = {};
      fresh.forEach((s) => { init[s.key] = s.current_value; });
      setDrafts(init);
      flash(`已重設：${key}`);
    } catch (e: any) {
      setError(e.message || '重設失敗');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAll() {
    if (!confirm('確定要將所有 Prompt 重設為預設值？')) return;
    setSaving(true);
    try {
      await resetAllPrompts();
      const fresh = await getPrompts();
      setSections(fresh);
      const init: Record<string, string> = {};
      fresh.forEach((s) => { init[s.key] = s.current_value; });
      setDrafts(init);
      flash('已全部重設為預設值');
    } catch (e: any) {
      setError(e.message || '重設失敗');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-[var(--color-text-muted)] py-8 text-center">載入中…</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            編輯各 Agent 使用的 System Prompt。儲存後立即生效，無需重啟。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetAll}
            disabled={saving}
            className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)] rounded transition-colors disabled:opacity-40"
          >
            全部重設
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasAnyDraft}
            className="px-4 py-1.5 text-xs bg-[var(--color-accent)] text-[var(--color-bg)] rounded font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? '儲存中…' : '儲存變更'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded px-3 py-2">
          {successMsg}
        </div>
      )}

      {/* Agent groups */}
      {Object.entries(grouped).map(([agent, agentSections]) => {
        const meta = AGENT_META[agent] || { label: agent, description: '', color: 'text-[var(--color-text)]' };
        return (
          <div key={agent} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            {/* Agent header */}
            <div className="px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <div className={`text-sm font-semibold ${meta.color}`}>{meta.label}</div>
              {meta.description && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{meta.description}</p>
              )}
            </div>

            {/* Sections */}
            <div className="divide-y divide-[var(--color-border)]">
              {agentSections.map((section) => {
                const dirty = isDirty(section.key);
                const overridden = section.is_overridden || dirty;
                return (
                  <div key={section.key} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {section.label.replace(/^[^—]+—\s*/, '')}
                        </span>
                        {overridden && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            已自訂
                          </span>
                        )}
                      </div>
                      {(section.is_overridden || dirty) && (
                        <button
                          onClick={() => {
                            if (section.is_overridden) {
                              handleResetOne(section.key);
                            } else {
                              // Just revert draft to default
                              setDrafts((d) => ({ ...d, [section.key]: section.default_value }));
                            }
                          }}
                          disabled={saving}
                          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2 transition-colors disabled:opacity-40 shrink-0"
                        >
                          重設為預設
                        </button>
                      )}
                    </div>
                    {section.description && (
                      <p className="text-xs text-[var(--color-text-muted)]">{section.description}</p>
                    )}
                    <textarea
                      value={drafts[section.key] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [section.key]: e.target.value }))}
                      rows={Math.min(12, Math.max(4, (drafts[section.key] || '').split('\n').length + 1))}
                      className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono leading-relaxed resize-y focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                      placeholder="輸入 prompt…"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
