"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { showToast } from "@/app/components/Toaster";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      showToast("請輸入 Email 與密碼", { kind: "info" });
      return;
    }
    setBusy(true);
    try {
      const res = await login({ email, password });
      saveSession(res.access_token, res.user);
      showToast("登入成功", { kind: "success" });
      router.replace("/");
    } catch (err: any) {
      showToast(err?.message || "登入失敗", { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
      <Card className="p-8">
        <div className="mb-6 space-y-2 text-center">
          <div className="text-sm font-semibold text-indigo-600">登入系統</div>
          <h1 className="text-2xl font-bold">歡迎回來</h1>
          <p className="text-sm text-gray-500">請輸入帳號密碼以繼續使用 RAG 控制台。</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm">Email</label>
            <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">密碼</label>
            <Input type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button disabled={busy}>{busy ? "登入中…" : "登入"}</Button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500">
          還沒有帳號？ <Link href="/register" className="text-indigo-600 hover:underline">立即註冊</Link>
        </div>
      </Card>
    </div>
  );
}
