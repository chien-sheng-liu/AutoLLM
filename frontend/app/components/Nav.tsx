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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  useEffect(() => {
    fetchProfile()
      .then((u) => {
        setUser(u);
      })
      .catch(() => {});
  }, []);

  if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
    return null;
  }

  async function handleLogout() {
    try {
      await apiLogout();
    } catch (err) {
      console.warn("logout failed", err);
    } finally {
      clearSession();
      setUser(null);
      router.replace("/login");
    }
  }

  const role = ((user?.auth || "") as string).toLowerCase();
  const canAdmin = role === "admin" || role === "administrator";
  const canManage = canAdmin || role === "manager";
  const avatarLabel = (user?.name || user?.email || "A")
    .slice(0, 1)
    .toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const navLinks = [
    { href: "/dashboard", label: t("nav.home"), show: true },
    { href: "/chat", label: t("nav.chat"), show: true },
    { href: "/data", label: t("nav.data"), show: canManage },
    { href: "/settings", label: t("nav.settings"), show: true },
  ].filter((item) => item.show);

  return (
    <div className="relative sticky top-0 z-50 px-4 pb-2 pt-3 md:px-8">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/80 px-4 py-2.5 shadow-soft backdrop-blur-md">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] text-base font-bold text-[var(--brand-primary)] transition-all group-hover:shadow-amber-sm"
            aria-hidden
          >
            ⚡
          </span>
          <div>
            <div className="font-display text-[13px] font-bold tracking-tight text-[var(--text-primary)] leading-none">
              {t("nav.brand")}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.35em] text-[var(--text-muted)] leading-none mt-0.5">
              AI 助理
            </div>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 text-sm md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-xl px-4 py-2 font-display text-[13px] font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)] ${
                  active
                    ? "text-[var(--brand-primary)] bg-[var(--soft-brand-background)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[var(--brand-primary)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileNavOpen((o) => !o)}
          aria-label="開啟導航選單"
          aria-expanded={mobileNavOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] md:hidden"
        >
          {mobileNavOpen ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-left transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-primary)] font-display text-xs font-bold text-[var(--text-inverse)]">
                  {avatarLabel}
                </span>
                <span className="hidden sm:block">
                  <div className="font-display text-[12px] font-semibold leading-none text-[var(--text-primary)]">
                    {user.name || user.email}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-muted)] mt-0.5">
                    {t("nav.signedIn")}
                  </div>
                </span>
                <svg
                  className="h-3 w-3 text-[var(--text-muted)]"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path
                    d="M2 4l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-panel">
                  <div className="p-1.5">
                    <Link
                      href="/guide"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 font-body text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="text-base">📖</span> {t("nav.guide")}
                    </Link>
                    {canAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 font-body text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="text-base">⚙️</span> {t("nav.admin")}
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-[var(--border-light)] p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-body text-sm text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                    >
                      <span className="text-base">↗</span> {t("nav.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 font-display text-[13px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]"
            >
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-soft-md md:hidden">
          <nav className="flex flex-col p-2">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`rounded-xl px-4 py-3 font-display text-[14px] font-semibold tracking-wide transition ${
                    active
                      ? "bg-[var(--soft-brand-background)] text-[var(--brand-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
