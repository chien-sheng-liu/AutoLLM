"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClasses } from "@/app/components/ui/Button";

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  return (
    <div className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/70 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 shadow" aria-hidden />
          <span>零程式碼 RAG 聊天機器人</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/">首頁</Link>
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/chat") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/chat">聊天</Link>
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/data") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/data">資料</Link>
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/settings") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/settings">設定</Link>
          <Link className={`${buttonClasses({ variant: 'outline', size: 'sm' })} ${isActive("/guide") ? 'bg-gray-100 dark:bg-neutral-800' : ''}`} href="/guide">教學</Link>
        </nav>
      </div>
    </div>
  );
}
