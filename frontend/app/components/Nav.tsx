"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buttonClasses } from "@/app/components/ui/Button";
import { clearSession, getStoredUser, type AuthUser } from "@/lib/session";
import { logout as apiLogout, fetchProfile } from "@/lib/api";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => pathname === href;
  const [user, setUser] = useState<AuthUser | null>(null);

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

  return (
    <div className="sticky top-0 z-50 border-b border-white/20 bg-white/50 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-glow" aria-hidden>⚡</span>
          <span className="bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">零程式碼 RAG 聊天機器人</span>
        </div>
        <nav className="flex flex-1 items-center justify-center gap-2 text-sm">
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/">首頁</Link>
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/chat") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/chat">聊天</Link>
          {canManage && (
            <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/data") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/data">資料</Link>
          )}
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/settings") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/settings">設定</Link>
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/guide") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/guide">教學</Link>
          {canAdmin && (
            <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/admin") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/admin">管理</Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <div className="text-[13px] font-semibold text-gray-900 dark:text-white">{user.name || user.email}</div>
                <div className="text-[11px] text-gray-500">已登入</div>
              </div>
              <button className={buttonClasses({ variant: 'outline', size: 'sm' })} onClick={handleLogout}>登出</button>
            </>
          ) : (
            <Link className={buttonClasses({ variant: 'outline', size: 'sm' })} href="/login">
              登入
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
