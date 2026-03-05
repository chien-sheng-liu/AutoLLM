"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { login, registerAccount } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { showToast } from "@/app/components/Toaster";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      showToast("請填寫必填欄位", { kind: "info" });
      return;
    }
    setBusy(true);
    try {
      await registerAccount({ email, password, name });
      const loggedIn = await login({ email, password });
      saveSession(loggedIn.access_token, loggedIn.user);
      showToast("註冊並登入成功", { kind: "success" });
      router.replace("/");
    } catch (err: any) {
      showToast(err?.message || "註冊失敗", { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
      <Card className="p-8">
        <div className="mb-6 space-y-2 text-center">
          <div className="text-sm font-semibold text-indigo-600">建立帳號</div>
          <h1 className="text-2xl font-bold">註冊新使用者</h1>
          <p className="text-sm text-gray-500">建立帳號後即可開始上傳資料與進行聊天。</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm">顯示名稱（選填）</label>
            <Input placeholder="王小明" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Email</label>
            <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">密碼</label>
            <Input type="password" autoComplete="new-password" placeholder="至少 6 碼" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button disabled={busy}>{busy ? "註冊中…" : "建立帳號"}</Button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500">
          已有帳號？ <Link href="/login" className="text-indigo-600 hover:underline">前往登入</Link>
        </div>
      </Card>
    </div>
  );
}
