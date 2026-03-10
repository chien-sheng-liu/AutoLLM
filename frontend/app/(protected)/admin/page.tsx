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
  const selectedUserAuth = (selectedUser?.auth || 'user').toLowerCase();
  const selectedUserIsAdmin = selectedUserAuth === 'admin' || selectedUserAuth === 'administrator';

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

  const summary = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => (u.auth || '').toLowerCase() === 'admin').length;
    const managerCount = users.filter((u) => (u.auth || '').toLowerCase() === 'manager').length;
    const regularCount = Math.max(0, total - adminCount - managerCount);
    return { total, adminCount, managerCount, regularCount };
  }, [users]);

  const allDocIds = useMemo(() => docs.map((d) => d.document_id), [docs]);

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
      const normalized = (selectedDocs.length === 0 || selectedDocs.length >= allDocIds.length)
        ? []
        : selectedDocs.filter((id) => allDocIds.includes(id));
      await adminSetUserPermissions(selectedUser.id, normalized);
      setSelectedDocs(normalized.length ? normalized : []);
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
      setSelectedUser(prev => prev && prev.id === u.id ? { ...prev, auth } : prev);
      if (u.id === selectedUser?.id && (auth === 'admin' || auth === 'administrator')) {
        setSelectedDocs([]);
      }
    } catch (e: any) {
      showToast(e?.message || '更新權限失敗', { kind: 'error' });
    } finally { setBusy(null); }
  }

  function toggleDoc(id: string, checked: boolean) {
    setSelectedDocs(prev => {
      const knownDocs = allDocIds;
      if (!knownDocs.includes(id)) return prev;
      if (prev.length === 0) {
        if (checked) {
          return prev;
        }
        return knownDocs.filter(docId => docId !== id);
      }
      if (checked) {
        const next = Array.from(new Set([...prev, id])).filter(docId => knownDocs.includes(docId));
        if (next.length >= knownDocs.length && knownDocs.length > 0) {
          return [];
        }
        return next;
      }
      const next = prev.filter(docId => docId !== id);
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">系統管理</h2>
          <p className="text-sm text-[var(--text-secondary)]">管理角色、權限與文件使用範圍。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-72"><Input placeholder="搜尋姓名或 Email…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div>
          <Button variant="outline" onClick={refresh}>重新整理</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="使用者" value={summary.total} hint="總數" />
        <StatCard label="Admin" value={summary.adminCount} hint="擁有完整權限" />
        <StatCard label="Manager" value={summary.managerCount} hint="協助管理" subHint={`${summary.regularCount} 一般用戶`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="p-0">
          <div className="border-b border-[var(--border-light)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">使用者清單</div>
          {loading ? (
            <div className="grid gap-2 p-4">{Array.from({length:6}).map((_,i)=>(<div key={i} className="h-12 rounded-xl bg-[var(--surface-muted)]" />))}</div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {filteredUsers.map((u) => {
                const authLabel = (u.auth || 'user').toLowerCase();
                const selected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openPerms(u)}
                    className={`flex w-full items-center gap-3 border-b border-[var(--border-light)] px-4 py-3 text-left transition hover:bg-[var(--surface-muted)] ${selected ? 'bg-[var(--soft-brand-background)]' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium" title={u.email}>{u.name || '未命名'} <span className="text-[var(--text-muted)]">· {u.email}</span></div>
                      <div className="text-xs text-[var(--text-muted)]">建立於 {new Date(u.created_at).toLocaleString()}</div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] ${authLabel==='admin' ? 'bg-[var(--soft-brand-background)] text-[var(--brand-primary)]' : authLabel==='manager' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'}`}>
                      {authLabel==='admin' ? 'Admin' : authLabel==='manager' ? 'Manager' : 'User'}
                    </span>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">找不到符合的使用者</div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          {selectedUser ? (
            <div className="grid gap-4">
              <div>
                <div className="text-sm font-semibold">{selectedUser.name || '未命名'}</div>
                <div className="text-xs text-[var(--text-muted)]">{selectedUser.email}</div>
                <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] p-0.5 text-xs">
                  {(['user','manager','admin'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAuth(selectedUser, a)}
                      className={`h-8 px-3 ${ (selectedUser.auth===a || (selectedUser.auth==='administrator' && a==='admin')) ? 'rounded-md bg-[var(--brand-primary)] text-white' : 'rounded-md text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'}`}
                      disabled={busy===`auth:${selectedUser.id}`}
                    >
                      {a==='admin' ? 'Admin' : a==='manager' ? 'Manager' : 'User'}
                    </button>
                  ))}
                </div>
              </div>

              {selectedUserIsAdmin ? (
                <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--text-secondary)] ">
                  Admin 角色預設擁有所有檔案，無需設定或調整權限。
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--text-secondary)] ">
                    預設全部勾選代表可使用所有檔案；想要限制時，取消勾選不允許的檔案即可。
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {docs.map((d) => (
                      <label key={d.document_id} className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-3 text-sm ">
                        <input
                          type="checkbox"
                          checked={selectedDocs.length === 0 ? true : selectedDocs.includes(d.document_id)}
                          onChange={(e)=>toggleDoc(d.document_id, e.target.checked)}
                        />
                        <span className="truncate" title={d.name}>{d.name}</span>
                      </label>
                    ))}
                    {docs.length === 0 && <div className="text-sm text-[var(--text-muted)]">尚無檔案。</div>}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={()=> setSelectedDocs([])} disabled={selectedDocs.length === 0}>全部勾選</Button>
                    <Button size="sm" onClick={savePerms} disabled={busy==='perms'}>{busy==='perms'?'儲存中…':'儲存權限'}</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-[var(--text-muted)]">
              <div className="text-base font-semibold text-[var(--text-primary)]">請先選擇左側的使用者</div>
              <p>選取後可以檢視檔案存取範圍並調整權限。</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, subHint }: { label: string; value: number; hint: string; subHint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{hint}</div>
      {subHint && <div className="text-[11px] text-[var(--text-muted)]">{subHint}</div>}
    </Card>
  );
}
