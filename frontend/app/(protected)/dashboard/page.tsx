"use client";
import { useEffect, useState } from "react";
import { getConfig, listDocuments, type DocumentItem } from "@/lib/api";
import { buttonClasses } from "@/app/components/ui/Button";
import Stat from "@/app/components/ui/Stat";
import { useLanguage } from "@/app/providers/LanguageProvider";

type Overview = {
  docsCount: number;
  docItems: DocumentItem[];
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  chat_model: string;
  embedding_model: string;
};

export default function Page() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    Promise.all([listDocuments(), getConfig()])
      .then(([d, c]) =>
        setOv({
          docsCount: d.items?.length || 0,
          docItems: d.items || [],
          chunk_size: c.chunk_size,
          chunk_overlap: c.chunk_overlap,
          top_k: c.top_k,
          chat_model: c.chat_model,
          embedding_model: c.embedding_model,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const shimmer = "animate-pulse bg-[var(--surface-muted)]";

  return (
    <div className="grid gap-6">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-10 md:px-10 md:py-12">
        {/* Glow accents */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-[var(--brand-primary)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[var(--accent-blue)]/10 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--brand-primary)]">
                {t('home.dashBadge')}
              </span>
            </div>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
              {t('home.dashHeadline')}
            </h1>
            <p className="max-w-[60ch] font-body text-base text-[var(--text-secondary)] sm:text-lg">
              {t('home.dashDescription')}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a className={buttonClasses({ variant: 'primary', size: 'md' })} href="/chat">
                {t('home.dashStart')}
              </a>
              <a className={buttonClasses({ variant: 'outline', size: 'md' })} href="/data">
                {t('home.dashUpload')}
              </a>
              <a className={buttonClasses({ variant: 'outline', size: 'md' })} href="/settings">
                {t('home.dashSettings')}
              </a>
            </div>
          </div>

          {/* Quick look stats */}
          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              {t('home.quickLook')}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label={t('home.stats.docsLabel')}
                value={loading ? <span className={`inline-block h-7 w-16 rounded ${shimmer}`} /> : (ov?.docsCount ?? 0)}
              />
              <Stat
                label={t('home.stats.topKLabel')}
                value={loading ? <span className={`inline-block h-7 w-12 rounded ${shimmer}`} /> : (ov?.top_k ?? '—')}
              />
              <Stat
                label={t('home.stats.chunkLabel')}
                value={loading ? <span className={`inline-block h-7 w-20 rounded ${shimmer}`} /> : (ov?.chunk_size ?? '—')}
              />
              <Stat
                label={t('home.stats.modelLabel')}
                value={loading ? <span className={`inline-block h-5 w-40 rounded ${shimmer}`} /> : (
                  <div className="font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
                    <div>Chat: <span className="text-[var(--text-primary)]">{ov?.chat_model}</span></div>
                    <div>Emb: <span className="text-[var(--text-primary)]">{ov?.embedding_model}</span></div>
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats row */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('home.stats.docsLabel')}     value={loading ? "—" : ov?.docsCount ?? 0}       hint={t('home.stats.docsHint')} />
        <Stat label={t('home.stats.quickChunk')}    value={loading ? "—" : ov?.chunk_size ?? "—"}    hint={t('home.stats.chunkHint')} />
        <Stat label={t('home.stats.quickOverlap')}  value={loading ? "—" : ov?.chunk_overlap ?? "—"} hint={t('home.stats.overlapHint')} />
        <Stat label={t('home.stats.topKLabel')}     value={loading ? "—" : ov?.top_k ?? "—"} />
      </section>

      {/* Recent documents */}
      <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display font-semibold text-[var(--text-primary)]">{t('home.recentsTitle')}</div>
          <a className="font-body text-sm text-[var(--brand-primary)] transition hover:text-[var(--brand-hover)]" href="/data">
            {t('home.recentsViewAll')} →
          </a>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-16 rounded-xl ${shimmer}`} />
            ))}
          </div>
        ) : ov && ov.docItems.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ov.docItems.slice(0, 6).map((d) => (
              <div
                key={d.document_id}
                className="flex items-center justify-between rounded-xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3 transition hover:border-[var(--border-subtle)] hover:bg-[var(--surface-card)]"
              >
                <div className="truncate pr-3">
                  <div className="truncate font-body text-sm font-medium text-[var(--text-primary)]" title={d.name}>
                    {d.name}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-muted)]">
                    {t('common.idLabel')}: {d.document_id}
                  </div>
                </div>
                <a href="/chat" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
                  {t('nav.chat')}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-body text-sm text-[var(--text-secondary)]">{t('home.noDocs')}</p>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-6 py-5">
        <div>
          <div className="font-display font-semibold text-[var(--text-primary)]">{t('home.shortcutsTitle')}</div>
          <p className="mt-0.5 font-body text-sm text-[var(--text-secondary)]">{t('home.shortcutsSubtitle')}</p>
        </div>
        <div className="flex gap-3">
          <a className={buttonClasses({ variant: 'primary', size: 'md' })} href="/data">{t('home.shortcutsUpload')}</a>
          <a className={buttonClasses({ variant: 'outline', size: 'md' })} href="/chat">{t('home.shortcutsChat')}</a>
        </div>
      </section>
    </div>
  );
}
