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
    <div className="sticky top-0 z-50 bg-transparent">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 rounded-2xl border border-white/5 bg-black/40 px-6 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-600 to-fuchsia-500 text-lg font-semibold text-white shadow-glow" aria-hidden>⚡</span>
          <div className="text-sm">
            <div className="font-semibold tracking-tight text-white">{t('nav.brand')}</div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">AI Copilot</div>
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 text-sm md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isActive(link.href)
                  ? 'text-white before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-indigo-500/60 before:to-fuchsia-500/50 before:blur' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="relative z-10">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-white/80 shadow-inner backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-fuchsia-500 text-sm font-semibold text-white">
                  {avatarLabel}
                </span>
                <span className="hidden sm:block">
                  <div className="text-[12px] font-semibold leading-tight text-white">
                    {user.name || user.email}
                  </div>
                  <div className="text-[10px] text-white/60">{t('nav.signedIn')}</div>
                </span>
                <span className="text-white/60" aria-hidden>▾</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-black/80 p-2 text-sm text-white shadow-2xl backdrop-blur">
                  <Link href="/guide" className="block rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10" onClick={() => setMenuOpen(false)}>
                    {t('nav.guide')}
                  </Link>
                  {canAdmin && (
                    <Link href="/admin" className="block rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10" onClick={() => setMenuOpen(false)}>
                      {t('nav.admin')}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-rose-500/10"
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
              className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/20"
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
