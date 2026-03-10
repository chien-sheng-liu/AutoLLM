"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getStoredUser, type AuthUser } from "@/lib/session";
import { logout as apiLogout, fetchProfile } from "@/lib/api";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/app/providers/LanguageProvider";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => pathname === href;
  const [user, setUser] = useState<AuthUser | null>(null);
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  useEffect(() => {
    // Best-effort: refresh profile to get latest auth for this tab only
    fetchProfile().then((u) => {
      setUser(u);
    }).catch(() => {});
  }, []);

  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null;
  }

  async function handleLogout() {
    try {
      await apiLogout();
    } catch (err) {
      console.warn('logout failed', err);
    } finally {
      clearSession();
      setUser(null);
      router.replace('/login');
    }
  }

  const role = ((user?.auth || '') as string).toLowerCase();
  const canAdmin = role === 'admin' || role === 'administrator';
  const canManage = canAdmin || role === 'manager';
  const avatarLabel = (user?.name || user?.email || 'A').slice(0, 1).toUpperCase();
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const navLinks = [
    { href: '/', label: t('nav.home'), show: true },
    { href: '/chat', label: t('nav.chat'), show: true },
    { href: '/data', label: t('nav.data'), show: canManage },
    { href: '/settings', label: t('nav.settings'), show: true },
  ].filter((item) => item.show);

  return (
    <div className="sticky top-0 z-50 px-4 pb-3 pt-4 md:px-10">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)]/95 px-4 py-3 shadow-soft backdrop-blur">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] text-lg font-semibold text-[var(--brand-primary)] shadow-surface"
            aria-hidden
          >
            ⚡
          </span>
          <div className="text-sm">
            <div className="font-semibold tracking-tight text-[var(--text-primary)]">{t('nav.brand')}</div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">AI Copilot</div>
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 text-sm md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)] ${
                  active
                    ? 'bg-[var(--brand-50)] text-[var(--brand-primary)] shadow-surface'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white">
                  {avatarLabel}
                </span>
                <span className="hidden sm:block">
                  <div className="text-[12px] font-semibold leading-tight text-[var(--text-primary)]">
                    {user.name || user.email}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">{t('nav.signedIn')}</div>
                </span>
                <span className="text-[var(--text-muted)]" aria-hidden>
                  ▾
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-2 text-sm text-[var(--text-secondary)] shadow-panel">
                  <Link
                    href="/guide"
                    className="block rounded-xl px-3 py-2 transition hover:bg-[var(--surface-muted)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('nav.guide')}
                  </Link>
                  {canAdmin && (
                    <Link
                      href="/admin"
                      className="block rounded-xl px-3 py-2 transition hover:bg-[var(--surface-muted)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('nav.admin')}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                  >
                    {t('nav.logout')}
                    <span aria-hidden>↗</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
