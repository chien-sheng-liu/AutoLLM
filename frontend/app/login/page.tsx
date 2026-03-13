"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { showToast } from "@/app/components/Toaster";
import { useLanguage } from "@/app/providers/LanguageProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [flash, setFlash] = useState<{
    type: "success" | "error";
    title: string;
    message?: string;
  } | null>(null);
  const { t } = useLanguage();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      showToast(t("auth.loginEmpty"), { kind: "info" });
      return;
    }
    setBusy(true);
    try {
      const res = await login({ email, password });
      saveSession(res.access_token, res.user);
      setFlash({ type: "success", title: t("auth.loginFlashSuccess") });
      setTimeout(() => {
        setFlash(null);
        window.location.replace("/dashboard");
      }, 1000);
    } catch (err: any) {
      setFlash({
        type: "error",
        title: t("auth.loginFlashError"),
        message: err?.message || t("auth.loginFlashMessage"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[85vh] max-w-sm flex-col justify-center">
      {/* Flash modal */}
      {flash && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 text-center shadow-panel animate-fade-up"
          >
            <div
              className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${
                flash.type === "success"
                  ? "bg-[var(--success-soft)] text-[var(--success)]"
                  : "bg-[var(--danger-soft)] text-[var(--danger)]"
              }`}
            >
              {flash.type === "success" ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.89a.75.75 0 1 0-1.22-.87l-3.173 4.463-1.663-1.663a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.17-.09l3.756-5.15Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                  <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM10.72 8.47a.75.75 0 1 0-1.06 1.06L10.94 11l-1.28 1.47a.75.75 0 1 0 1.12 1l1.22-1.4 1.22 1.4a.75.75 0 0 0 1.12-1L13.06 11l1.28-1.47a.75.75 0 1 0-1.12-1L12 9.94l-1.28-1.47Z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {flash.title}
            </h3>
            {flash.message && (
              <p className="mt-2 font-body text-sm text-[var(--text-secondary)]">{flash.message}</p>
            )}
            {flash.type === "error" && (
              <div className="mt-6">
                <Button variant="outline" onClick={() => setFlash(null)}>
                  {t("common.confirm")}
                </Button>
              </div>
            )}
            {flash.type === "success" && (
              <div className="mt-2 font-body text-sm text-[var(--text-secondary)]">
                {t("auth.loginWelcome")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 shadow-soft animate-fade-up">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] text-2xl">
            ⚡
          </span>
          <div>
            <div className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--brand-primary)]">
              {t("common.appName")}
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {t("auth.loginHeading")}
            </h1>
            <p className="mt-1 font-body text-sm text-[var(--text-muted)]">
              {t("auth.loginSubheading")}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {t("auth.emailLabel")}
            </label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {t("auth.passwordLabel")}
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button disabled={busy} className="mt-2 w-full">
            {busy ? t("auth.loginBusy") : t("auth.loginAction")}
          </Button>
        </form>

        <div className="mt-5 text-center font-body text-sm text-[var(--text-muted)]">
          {t("auth.loginLinkRegister")}{" "}
          <Link href="/register" className="text-[var(--brand-primary)] hover:text-[var(--brand-hover)] transition-colors">
            {t("auth.loginLinkRegisterCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
