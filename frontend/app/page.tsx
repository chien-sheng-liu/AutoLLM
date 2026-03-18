"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";
import { useLanguage } from "@/app/providers/LanguageProvider";
import { isAuthenticated } from "@/lib/session";

export default function HomePage() {
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  return (
    <div className="relative overflow-hidden min-h-[80vh] flex flex-col items-center justify-center">
      {/* Amber glow accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 h-[36rem] w-[36rem] rounded-full blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(232,164,59,0.15) 0%, rgba(232,144,106,0.08) 50%, transparent 100%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-[20rem] w-[20rem] rounded-full blur-[80px]"
          style={{
            background:
              "radial-gradient(circle, rgba(91,156,246,0.10) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Hero */}
      <div className="relative flex flex-col items-center py-20 text-center md:py-28 max-w-4xl mx-auto">
        {/* Badges */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 animate-fade-up"
          style={{ animationDelay: "0ms" }}
        >
          <Badge>{t("home.badgeWorkspace")}</Badge>
          <Badge tone="neutral">{t("home.badgeRag")}</Badge>
          <Badge tone="success">{t("home.badgeProd")}</Badge>
        </div>

        {/* Headline */}
        <h1
          className="mt-8 font-display text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl leading-[1.05] animate-fade-up"
          style={{
            animationDelay: "80ms",
            background:
              "linear-gradient(135deg, var(--text-primary) 0%, var(--brand-primary) 55%, var(--text-secondary) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {t("home.heroTitle")}
        </h1>

        {/* Description */}
        <p
          className="mx-auto mt-6 max-w-[56ch] font-body text-base text-[var(--text-secondary)] leading-relaxed animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          {t("home.heroDescription")}
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href="/chat"
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            {t("home.ctaChat")}
          </Link>
          <Link
            href="/data"
            className={buttonClasses({ variant: "outline", size: "md" })}
          >
            {t("home.ctaUpload")}
          </Link>
          <Link
            href="/settings"
            className={buttonClasses({ variant: "outline", size: "md" })}
          >
            {t("home.ctaConfigure")}
          </Link>
        </div>

        <div
          className="mt-4 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] animate-fade-up"
          style={{ animationDelay: "320ms" }}
        >
          {t("home.signInRequired")}
        </div>

        {/* Feature pills */}
        <div
          className="mt-16 flex flex-wrap items-center justify-center gap-2 animate-fade-up"
          style={{ animationDelay: "400ms" }}
        >
          {[
            "RAG 管線",
            "pgvector",
            "串流回應",
            "多模型支援",
            "文件權限",
            "引用來源",
          ].map((feat) => (
            <span
              key={feat}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]"
            >
              {feat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
