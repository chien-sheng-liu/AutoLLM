"use client";
import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/Button";
import Container from "@/app/components/ui/Container";
import Badge from "@/app/components/ui/Badge";
import { useLanguage } from "@/app/providers/LanguageProvider";

export default function HomePage() {
  const { t } = useLanguage();
  return (
    <div className="relative overflow-hidden">
      {/* Global bg layers come from layout; add local accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-indigo-600/25 via-violet-600/20 to-fuchsia-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[22rem] w-[22rem] rounded-full bg-gradient-to-tr from-cyan-400/20 to-blue-500/20 blur-3xl" />
      </div>

      {/* Hero */}
      <Container className="relative flex flex-col items-center py-16 text-center md:py-24">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>{t('home.badgeWorkspace')}</Badge>
          <Badge tone="neutral">{t('home.badgeRag')}</Badge>
          <Badge tone="success">{t('home.badgeProd')}</Badge>
        </div>
        <h1 className="mt-5 bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-[62ch] text-base text-gray-700 dark:text-gray-300">
          {t('home.heroDescription')}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/chat" className={buttonClasses({ variant: "primary", size: "md" })}>{t('home.ctaChat')}</Link>
          <Link href="/data" className={buttonClasses({ variant: "outline", size: "md" })}>{t('home.ctaUpload')}</Link>
          <Link href="/settings" className={buttonClasses({ variant: "outline", size: "md" })}>{t('home.ctaConfigure')}</Link>
        </div>
        <div className="mt-3 text-center text-[11px] text-gray-500 dark:text-gray-400">{t('home.signInRequired')}</div>
      </Container>
    </div>
  );
}
