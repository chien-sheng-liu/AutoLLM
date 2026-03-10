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

  const shimmer = "animate-pulse bg-[var(--surface-muted)] dark:bg-neutral-800";

  return (
    <div className="grid gap-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] px-6 py-10 shadow-soft dark:border-neutral-800 dark:bg-neutral-900 md:px-10 md:py-14">
        <div className="pointer-events-none absolute -top-16 -right-24 h-56 w-56 rounded-full bg-gradient-to-tr from-indigo-500/30 to-violet-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-24 h-56 w-56 rounded-full bg-gradient-to-tr from-pink-500/20 to-rose-500/20 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" /> {t('home.dashBadge')}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t('home.dashHeadline')}
            </h1>
            <p className="max-w-[60ch] text-base text-[var(--text-secondary)] sm:text-lg">
              {t('home.dashDescription')}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a className={`${buttonClasses({ variant: 'primary', size: 'md' })}`} href="/chat">
                {t('home.dashStart')}
              </a>
              <a className={`${buttonClasses({ variant: 'outline', size: 'md' })}`} href="/data">
                {t('home.dashUpload')}
              </a>
              <a className={`${buttonClasses({ variant: 'outline', size: 'md' })}`} href="/settings">
                {t('home.dashSettings')}
              </a>
            </div>
          </div>

          {/* Visual stats (Stat grid) */}
          <div className="relative">
            <div className="mb-3 text-sm font-medium text-[var(--text-muted)]">{t('home.quickLook')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label={t('home.stats.docsLabel')} value={loading ? <span className={`inline-block h-7 w-16 rounded ${shimmer}`} /> : (ov?.docsCount ?? 0)} />
              <Stat label={t('home.stats.topKLabel')} value={loading ? <span className={`inline-block h-7 w-12 rounded ${shimmer}`} /> : (ov?.top_k ?? '—')} />
              <Stat label={t('home.stats.chunkLabel')} value={loading ? <span className={`inline-block h-7 w-20 rounded ${shimmer}`} /> : (ov?.chunk_size ?? '—')} />
              <Stat label={t('home.stats.modelLabel')} value={loading ? <span className={`inline-block h-5 w-40 rounded ${shimmer}`} /> : (
                <div className="text-sm">
                  <div>Chat: {ov?.chat_model}</div>
                  <div>Emb: {ov?.embedding_model}</div>
                </div>
              )} />
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('home.stats.docsLabel')} value={loading ? "—" : ov?.docsCount ?? 0} hint={t('home.stats.docsHint')} />
        <Stat label={t('home.stats.quickChunk')} value={loading ? "—" : ov?.chunk_size ?? "—"} hint={t('home.stats.chunkHint')} />
        <Stat label={t('home.stats.quickOverlap')} value={loading ? "—" : ov?.chunk_overlap ?? "—"} hint={t('home.stats.overlapHint')} />
        <Stat label={t('home.stats.topKLabel')} value={loading ? "—" : ov?.top_k ?? "—"} />
      </section>


      {/* Recent documents */}
      <section className="rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-semibold">{t('home.recentsTitle')}</div>
          <a className="text-sm text-[var(--brand-primary)] hover:underline" href="/data">{t('home.recentsViewAll')}</a>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-14 rounded-xl ${shimmer}`} />
            ))}
          </div>
        ) : ov && ov.docItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ov.docItems.slice(0, 6).map((d) => (
              <div key={d.document_id} className="flex items-center justify-between rounded-xl border border-[var(--border-light)] p-4 text-sm dark:border-neutral-800">
                <div className="truncate pr-3">
                  <div className="truncate font-medium" title={d.name}>{d.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{t('common.idLabel')}: {d.document_id}</div>
                </div>
                <a href="/chat" className={`${buttonClasses({ variant: 'outline', size: 'sm' })}`}>{t('nav.chat')}</a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-secondary)]">{t('home.noDocs')}</div>
        )}
      </section>

      {/* Final CTA kept minimal for actions */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
        <div className="max-w-[70ch]">
          <div className="text-sm font-medium text-[var(--text-primary)]">{t('home.shortcutsTitle')}</div>
          <p className="text-sm text-[var(--text-secondary)]">{t('home.shortcutsSubtitle')}</p>
        </div>
        <div className="flex gap-3">
          <a className={`${buttonClasses({ variant: 'primary', size: 'md' })}`} href="/data">{t('home.shortcutsUpload')}</a>
          <a className={`${buttonClasses({ variant: 'outline', size: 'md' })}`} href="/chat">{t('home.shortcutsChat')}</a>
        </div>
      </section>
    </div>
  );
}
