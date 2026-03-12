"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/Button";
import Container from "@/app/components/ui/Container";
import Badge from "@/app/components/ui/Badge";
import { useLanguage } from "@/app/providers/LanguageProvider";
import { isAuthenticated } from "@/lib/session";

export default function HomePage() {
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="relative overflow-hidden">
      {/* Brand-aligned background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(124,92,255,0.18) 0%, rgba(79,140,255,0.12) 60%, transparent 100%)" }} />
        <div className="absolute -bottom-40 -right-24 h-[22rem] w-[22rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(79,140,255,0.15) 0%, rgba(124,92,255,0.08) 60%, transparent 100%)" }} />
      </div>

      {/* Hero */}
      <Container className="relative flex flex-col items-center py-16 text-center md:py-24">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>{t('home.badgeWorkspace')}</Badge>
          <Badge tone="neutral">{t('home.badgeRag')}</Badge>
          <Badge tone="success">{t('home.badgeProd')}</Badge>
        </div>
        <h1
          className="mt-5 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          {t('home.heroTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-[62ch] text-base text-[var(--text-secondary)]">
          {t('home.heroDescription')}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/chat" className={buttonClasses({ variant: "primary", size: "md" })}>{t('home.ctaChat')}</Link>
          <Link href="/data" className={buttonClasses({ variant: "outline", size: "md" })}>{t('home.ctaUpload')}</Link>
          <Link href="/settings" className={buttonClasses({ variant: "outline", size: "md" })}>{t('home.ctaConfigure')}</Link>
        </div>
        <div className="mt-3 text-center text-[11px] text-[var(--text-muted)]">{t('home.signInRequired')}</div>
      </Container>
    </div>
  );
}
