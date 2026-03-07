"use client";
import { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import { adminListUsers, adminSetUserAuth, adminGetUserPermissions, adminSetUserPermissions, adminListAllDocuments, type DocumentItem } from "@/lib/api";
import { showToast } from "@/app/components/Toaster";

type User = { id: string; email: string; name?: string | null; role?: 'user'|'admin'; auth?: 'admin'|'administrator'|'manager'|'user'; created_at: string };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const [us, dl] = await Promise.all([adminListUsers(), adminListAllDocuments()]);
      setUsers(us);
      setDocs(dl.items || []);
    } catch (e: any) {
      showToast(e?.message || '載入失敗', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.email.toLowerCase().includes(q) || (u.name||'').toLowerCase().includes(q));
  }, [users, query]);

  async function openPerms(u: User) {
    setSelectedUser(u);
    try {
      const res = await adminGetUserPermissions(u.id);
      setSelectedDocs(res.document_ids || []);
    } catch (e: any) {
      setSelectedDocs([]);
    }
  }

  async function savePerms() {
    if (!selectedUser) return;
    setBusy('perms');
    try {
      await adminSetUserPermissions(selectedUser.id, selectedDocs);
      showToast('權限已更新', { kind: 'success' });
    } catch (e: any) {
      showToast(e?.message || '更新失敗', { kind: 'error' });
    } finally { setBusy(null); }
  }

  async function setAuth(u: User, auth: 'admin'|'administrator'|'manager'|'user') {
    setBusy(`auth:${u.id}`);
    try {
      await adminSetUserAuth(u.id, auth);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, auth, role: auth==='administrator'?'admin':'user' } : x));
    } catch (e: any) {
      showToast(e?.message || '更新權限失敗', { kind: 'error' });
    } finally { setBusy(null); }
  }

  function toggleDoc(id: string, checked: boolean) {
    setSelectedDocs(prev => checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">系統管理</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">管理使用者角色與檔案存取權限。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-72"><Input placeholder="搜尋姓名或 Email…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div>
          <Button variant="outline" onClick={refresh}>重新整理</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_140px_160px_140px] items-center gap-3 border-b border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-neutral-800 md:grid">
          <div>使用者</div>
          <div>角色</div>
          <div>建立時間</div>
          <div className="text-right">操作</div>
        </div>
        {loading ? (
          <div className="grid gap-2 p-4">{Array.from({length:6}).map((_,i)=>(<div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-neutral-800" />))}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-neutral-800">
            {filteredUsers.map(u => (
              <div key={u.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_140px_160px_140px] md:items-center">
                <div className="min-w-0">
                  <div className="truncate font-medium" title={u.email}>{u.name || '未命名'} <span className="text-gray-500">· {u.email}</span></div>
                </div>
                <div className="text-sm">
                  <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
                    {(['user','manager','admin'] as const).map(a => (
                      <button key={a} type="button" onClick={()=> setAuth(u, a)}
                        className={`h-7 px-2.5 text-[12px] leading-none rounded-md ${u.auth===a || (u.auth==='administrator' && a==='admin') ?'bg-indigo-600 text-white dark:bg-indigo-500':'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-700'}`}
                        disabled={busy===`auth:${u.id}`}
                      >{a==='admin'?'Admin': a==='manager'?'Manager':'User'}</button>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-gray-500">{new Date(u.created_at).toLocaleString()}</div>
                <div className="text-right">
                  <Button variant="outline" size="sm" onClick={()=>openPerms(u)}>設定權限</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedUser && (
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">檔案權限（{selectedUser.email}）</div>
            <div className="text-xs text-gray-500">未選任何檔案 = 可使用全部檔案</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map(d => (
              <label key={d.document_id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-neutral-800">
                <input type="checkbox" checked={selectedDocs.includes(d.document_id)} onChange={(e)=>toggleDoc(d.document_id, e.target.checked)} />
                <span className="truncate" title={d.name}>{d.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 text-right">
            <Button size="sm" onClick={savePerms} disabled={busy==='perms'}>{busy==='perms'?'儲存中…':'儲存權限'}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
