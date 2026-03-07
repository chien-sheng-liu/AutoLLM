"use client";
import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/Button";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Tech background: gradients + subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        {/* soft spotlights */}
        <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-indigo-500/25 via-fuchsia-500/15 to-cyan-400/10 blur-3xl" />
        <div className="absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-indigo-500/10 blur-3xl" />
        {/* grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,120,120,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,120,120,0.08)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto flex max-w-screen-xl flex-col items-center px-6 py-16 text-center md:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
          AI 助手 · 商用等級
        </span>
        <h1 className="mt-4 bg-gradient-to-br from-gray-900 via-indigo-800 to-fuchsia-700 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent dark:from-white dark:via-indigo-200 dark:to-fuchsia-300 sm:text-4xl md:text-5xl">
          專注對話，快速獲得可追溯的答案
        </h1>
        <p className="mx-auto mt-3 max-w-[60ch] text-sm text-gray-600 dark:text-gray-400">
          最必要的入口，一步到位。上傳資料、開始聊天、隨時調整設定。
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/chat" className={buttonClasses({ variant: "primary", size: "md" })}>開始聊天</Link>
          <Link href="/data" className={buttonClasses({ variant: "outline", size: "md" })}>上傳資料</Link>
          <Link href="/settings" className={buttonClasses({ variant: "outline", size: "md" })}>設定</Link>
        </div>

        {/* subtle hint */}
        <div className="mt-3 text-center text-[11px] text-gray-500 dark:text-gray-400">
          需要登入使用。
        </div>
      </section>
    </div>
  );
}
