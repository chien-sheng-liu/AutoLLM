"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/session";
import { fetchProfile } from "@/lib/api";
import {
  listDocuments,
  deleteDocument,
  uploadDocumentWithProgress,
  listPermissionUsers,
  getDocumentPermissions,
  setDocumentPermissions,
  type DocumentsList,
  type PermissionUser,
} from "@/lib/api";
import { showToast } from "@/app/components/Toaster";
import Button, { buttonClasses } from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import Card from "@/app/components/ui/Card";
import Modal from "@/app/components/ui/Modal";

type Doc = { document_id: string; name: string };

export default function DataPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // actions busy

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fileProgress, setFileProgress] = useState(0);

  // UI state
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargets, setConfirmTargets] = useState<string[]>([]);
  const [authRole, setAuthRole] = useState<'admin'|'manager'|'user'>('user');
  const [authLoaded, setAuthLoaded] = useState(false);
  const [authVerified, setAuthVerified] = useState(false);
  const [permissionUsers, setPermissionUsers] = useState<PermissionUser[]>([]);
  const [permissionUsersLoading, setPermissionUsersLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docUserIds, setDocUserIds] = useState<string[]>([]);
  const [permBusy, setPermBusy] = useState(false);
  const [docPermLoading, setDocPermLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const nameSearchRef = useRef<HTMLInputElement>(null);

  const normalizeAuth = (value?: string | null) => {
    const v = (value || 'user').toLowerCase();
    if (v === 'administrator' || v === 'admin') return 'admin' as const;
    if (v === 'manager') return 'manager' as const;
    return 'user' as const;
  };

  const canManage = authRole === 'admin' || authRole === 'manager';
  const isAdmin = authRole === 'admin';

  function isAllowed(f: File) {
    const ext = f.name.toLowerCase();
    return ext.endsWith(".txt") || ext.endsWith(".pdf");
  }

  function handlePick(files: FileList | File[]) {
    const arr = Array.from(files);
    const valid = arr.filter(isAllowed);
    const rejected = arr.filter((f) => !isAllowed(f));
    if (rejected.length) {
      showToast(`已忽略不支援的檔案：${rejected.map((f) => f.name).join(", ")}`, { kind: "info" });
    }
    const next = [...selectedFiles, ...valid].slice(0, 10); // 最多 10 個
    setSelectedFiles(next);
  }

  async function refresh() {
    setLoading(true);
    try {
      const res: DocumentsList = await listDocuments();
      setDocs(res.items || []);
      setSelectedIds([]);
    } catch (e: any) {
      showToast(e?.message || "載入文件清單失敗", { kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canManage) {
      setPermissionUsers([]);
      setPermissionUsersLoading(false);
      return;
    }
    setPermissionUsersLoading(true);
    listPermissionUsers()
      .then((res) => setPermissionUsers(res))
      .catch((e: any) => {
        setPermissionUsers([]);
        showToast(e?.message || '載入使用者失敗', { kind: 'error' });
      })
      .finally(() => setPermissionUsersLoading(false));
  }, [canManage]);

  useEffect(() => {
    if (!canManage) {
      setSelectedDocId(null);
      setDocUserIds([]);
      setDocPermLoading(false);
      return;
    }
    if (docs.length === 0) {
      setSelectedDocId(null);
      setDocUserIds([]);
      setDocPermLoading(false);
      return;
    }
    if (!selectedDocId || !docs.some((d) => d.document_id === selectedDocId)) {
      setSelectedDocId(docs[0].document_id);
    }
  }, [docs, selectedDocId, canManage]);

  useEffect(() => {
    if (!canManage || !selectedDocId) {
      setDocUserIds([]);
      setDocPermLoading(false);
      return;
    }
    setDocPermLoading(true);
    getDocumentPermissions(selectedDocId)
      .then((res) => setDocUserIds(res.user_ids || []))
      .catch(() => setDocUserIds([]))
      .finally(() => setDocPermLoading(false));
  }, [selectedDocId, canManage]);

  // No redirect: normal users can view read-only list
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => docs.some((d) => d.document_id === id)));
  }, [docs]);

  useEffect(() => {
    if (permissionUsers.length === 0) return;
    setDocUserIds((prev) => prev.filter((id) => permissionUsers.some((u) => u.user_id === id)));
  }, [permissionUsers]);
  useEffect(() => {
    const u = getStoredUser();
    setAuthRole(normalizeAuth(u?.auth));
    setAuthLoaded(true);
    fetchProfile()
      .then((profile) => {
        try { window.localStorage.setItem('autollm_user', JSON.stringify(profile)); } catch {}
        setAuthRole(normalizeAuth(profile?.auth));
        setAuthLoaded(true);
      })
      .catch(() => {})
      .finally(() => setAuthVerified(true));
  }, []);

  // content quick search removed per request

  const overallProgress = useMemo(() => {
    if (!uploading || selectedFiles.length === 0) return 0;
    const done = currentIndex;
    const total = selectedFiles.length;
    return Math.floor(((done * 100) + fileProgress) / total);
  }, [uploading, selectedFiles.length, currentIndex, fileProgress]);

  async function onUpload(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (uploading || selectedFiles.length === 0) return;
    setUploading(true);
    setCurrentIndex(0);
    setFileProgress(0);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        setCurrentIndex(i);
        setFileProgress(0);
        await uploadDocumentWithProgress(selectedFiles[i], (p) => setFileProgress(p));
      }
      setSelectedFiles([]);
      await refresh();
      showToast("上傳完成", { kind: "success" });
    } catch (e: any) {
      showToast(e?.message || "上傳失敗", { kind: "error" });
    } finally {
      setUploading(false);
      setCurrentIndex(0);
      setFileProgress(0);
    }
  }

  function askDelete(ids: string[]) {
    setConfirmTargets(ids);
    setConfirmOpen(true);
  }

  async function doDelete(ids: string[]) {
    setConfirmOpen(false);
    if (!ids.length) return;
    setBusy(true);
    try {
      let ok = 0, fail = 0;
      for (const id of ids) {
        try { await deleteDocument(id); ok++; }
        catch { fail++; }
      }
      await refresh();
      if (fail === 0) showToast(`刪除完成（${ok} 筆）`, { kind: "success" });
      else showToast(`部分刪除失敗：成功 ${ok}、失敗 ${fail}`, { kind: "info" });
    } catch (e: any) {
      showToast(e?.message || "刪除失敗", { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = docs;
    if (q) arr = arr.filter((d) => d.name.toLowerCase().includes(q) || d.document_id.toLowerCase().includes(q));
    arr = [...arr].sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return arr;
  }, [docs, query, sortAsc]);

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredDocs.map((d) => d.document_id));
  }

  const selectedDoc = useMemo(() => {
    return docs.find((d) => d.document_id === selectedDocId) || null;
  }, [docs, selectedDocId]);

  const sortedPermissionUsers = useMemo(() => {
    return [...permissionUsers].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [permissionUsers]);

  const allPermissionUserIds = useMemo(() => (
    permissionUsers
      .filter((u) => normalizeAuth(u.auth) !== 'admin')
      .map((u) => u.user_id)
  ), [permissionUsers]);

  function toggleUserAccess(userId: string, checked: boolean) {
    setDocUserIds((prev) => {
      const known = allPermissionUserIds;
      if (!known.includes(userId)) return prev;
      if (prev.length === 0) {
        if (checked) return prev;
        return known.filter((id) => id !== userId);
      }
      if (checked) {
        const next = Array.from(new Set([...prev, userId])).filter((id) => known.includes(id));
        if (known.length > 0 && next.length >= known.length) {
          return [];
        }
        return next;
      }
      return prev.filter((id) => id !== userId);
    });
  }

  async function saveDocPermissions() {
    if (!selectedDocId) {
      showToast('請先選擇檔案', { kind: 'info' });
      return;
    }
    setPermBusy(true);
    try {
      const normalized = docUserIds.length === 0
        ? []
        : docUserIds.filter((id) => allPermissionUserIds.includes(id));
      await setDocumentPermissions(selectedDocId, normalized);
      setDocUserIds(normalized.length ? normalized : []);
      showToast('檔案權限已更新', { kind: 'success' });
    } catch (e: any) {
      showToast(e?.message || '更新檔案權限失敗', { kind: 'error' });
    } finally {
      setPermBusy(false);
    }
  }

  function clearDocPermissions() {
    setDocUserIds([]);
  }

  // Keyboard shortcut to focus name/ID search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any)?.isContentEditable)) return;
      if (e.key === '/') {
        e.preventDefault();
        nameSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!authLoaded) {
    return <div className="text-sm text-gray-500">載入權限中…</div>;
  }

  if (!canManage) {
    // Read-only view for normal users: list accessible documents and allow copying IDs
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">所有文件（僅檢視）</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">您可以檢視所有文件並複製 ID，但不可變更。</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="rounded-full border border-gray-200 px-3 py-1 dark:border-neutral-700">{loading ? '—' : docs.length} 份文件</span>
            <button className="rounded-xl border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800" onClick={refresh}>重新整理</button>
          </div>
        </div>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-72"><Input ref={nameSearchRef} placeholder="搜尋名稱或 ID…（按 / 聚焦）" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <Button variant="outline" onClick={() => setSortAsc((s) => !s)}>名稱 {sortAsc ? 'A→Z' : 'Z→A'}</Button>
          </div>

          <div className="hidden grid-cols-[1fr_320px_120px] gap-3 px-4 py-2 text-xs text-gray-500 md:grid dark:text-gray-400">
            <div>名稱</div>
            <div>ID</div>
            <div>操作</div>
          </div>
          {filteredDocs.length === 0 ? (
            <div className="p-6 text-sm text-gray-600 dark:text-gray-400">{docs.length === 0 ? '目前尚未被授權使用任何文件。' : '沒有符合的文件。'}</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {filteredDocs.map((d) => (
                <div key={d.document_id} className="grid grid-cols-1 items-start gap-3 p-4 md:grid-cols-[1fr_320px_120px] md:items-center">
                  <div className="truncate font-medium">{d.name}</div>
                  <div className="break-all text-xs text-gray-500">{d.document_id}</div>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(d.document_id).then(() => showToast('已複製 ID', { kind: 'success' })).catch(() => showToast('複製失敗', { kind: 'error' }))}>複製 ID</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">資料管理</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">上傳、瀏覽、刪除文件。支援拖放上傳與批次刪除。</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="rounded-full border border-gray-200 px-3 py-1 dark:border-neutral-700">{loading ? '—' : docs.length} 份文件</span>
          <button className="rounded-xl border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800" onClick={refresh} disabled={uploading || busy}>重新整理</button>
        </div>
      </div>

      {/* Uploader */}
      <Card className="relative overflow-hidden p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">上傳檔案</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">支援 .txt 與 .pdf，單次最多 10 個</div>
          </div>
          <div className="flex gap-2">
            <label className={buttonClasses({ variant: 'outline', size: 'md' }) + ' cursor-pointer'}>
              選擇檔案
              <input
                type="file"
                accept=".txt,.pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handlePick(e.target.files)}
              />
            </label>
            <Button disabled={uploading || selectedFiles.length === 0} onClick={() => onUpload()}>
              {uploading ? `上傳中… ${overallProgress}%` : `上傳 ${selectedFiles.length} 個`}
            </Button>
            {selectedFiles.length > 0 && !uploading && (
              <Button variant="outline" onClick={() => setSelectedFiles([])}>清空</Button>
            )}
          </div>
        </div>

        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center text-sm transition ${dragOver ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20' : 'border-gray-200 dark:border-neutral-800'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            if (e.dataTransfer.files) handlePick(e.dataTransfer.files);
          }}
        >
          將檔案拖放到此處，或點擊「選擇檔案」挑選
          {uploading && (
            <div className="mx-auto mt-4 h-2 w-full max-w-lg overflow-hidden rounded bg-gray-200 dark:bg-neutral-800">
              <div className="h-full bg-indigo-600" style={{ width: `${overallProgress}%` }} />
            </div>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectedFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-800">
                <div className="min-w-0 truncate pr-3"><span className="truncate" title={f.name}>{f.name}</span></div>
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}>移除</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-72"><Input ref={nameSearchRef} placeholder="搜尋名稱或 ID…（按 / 聚焦）" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <Button variant="outline" onClick={() => setSortAsc((s) => !s)}>名稱 {sortAsc ? "A→Z" : "Z→A"}</Button>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="danger" disabled={busy || selectedIds.length === 0} onClick={() => askDelete(selectedIds)}>
              刪除已選（{selectedIds.length}）
            </Button>
          )}
        </div>
      </div>

      {/* Documents list */}
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[24px_1fr_320px_120px] items-center gap-3 border-b border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-neutral-800 md:grid">
          <div>
            <input
              aria-label="select all"
              type="checkbox"
              checked={filteredDocs.length > 0 && selectedIds.length === filteredDocs.length}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
          </div>
          <div>名稱</div>
          <div>ID</div>
          <div className="text-right">動作</div>
        </div>

        {loading ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-neutral-800" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-400">{docs.length === 0 ? '尚未上傳任何文件，請先於上方進行上傳。' : '沒有符合的文件。'}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-neutral-800">
            {filteredDocs.map((d) => (
              <div key={d.document_id} className="grid grid-cols-1 items-start gap-3 p-4 md:grid-cols-[24px_1fr_320px_120px] md:items-center">
                <div className="mt-0.5 md:mt-0">
                  <input
                    aria-label="select"
                    type="checkbox"
                    checked={selectedIds.includes(d.document_id)}
                    onChange={(e) => toggleSelect(d.document_id, e.target.checked)}
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium" title={d.name}>{d.name}</div>
                </div>
                <div className="truncate text-xs text-gray-500">
                  {d.document_id}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(d.document_id).then(() => showToast('已複製 ID', { kind: 'success' })).catch(() => showToast('複製失敗', { kind: 'error' }))}>複製 ID</Button>
                  {isAdmin && (
                    <Button variant="danger" size="sm" onClick={() => askDelete([d.document_id])} disabled={busy}>刪除</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Document-level permissions */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">檔案使用權限</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">指定哪些使用者可以使用特定資料於聊天。</p>
          </div>
          {selectedDoc && (
            <div className="text-xs text-gray-500 dark:text-gray-400">目前選擇：{selectedDoc.name}</div>
          )}
        </div>

        {docs.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-neutral-800 dark:text-gray-400">
            尚未上傳任何資料，請先於上方新增檔案後再設定權限。
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400" htmlFor="doc-select">選擇檔案</label>
                <select
                  id="doc-select"
                  className="mt-1 w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  value={selectedDocId || ''}
                  onChange={(e) => setSelectedDocId(e.target.value || null)}
                  disabled={docs.length === 0}
                >
                  {!selectedDocId && <option value="" disabled>請選擇檔案</option>}
                  {docs.map((d) => (
                    <option key={d.document_id} value={d.document_id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {selectedDoc && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
                  <div className="font-semibold">{selectedDoc.name}</div>
                  <div className="mt-1 break-all text-xs text-gray-500">{selectedDoc.document_id}</div>
                  <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    {docUserIds.length === 0
                      ? '目前所有登入者都可以使用此檔案。'
                      : `僅 ${docUserIds.length} 位使用者可使用此檔案。`}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-gray-300">
                預設所有帳號皆可引用此檔案，取消勾選即可限制不得使用的帳號；若後續又全數勾回，系統會恢復為「允許所有人」。Admin 角色始終擁有所有檔案，無法取消。
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={clearDocPermissions} disabled={!selectedDocId || permBusy || docPermLoading}>允許所有人</Button>
                <Button size="sm" onClick={saveDocPermissions} disabled={!selectedDocId || permBusy || docPermLoading}>{permBusy ? '儲存中…' : '儲存權限'}</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              {permissionUsersLoading || docPermLoading ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">載入使用者中…</div>
              ) : sortedPermissionUsers.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">目前僅有您一位使用者可用。</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {sortedPermissionUsers.map((user) => {
                    const authLabel = (user.auth || 'user').toLowerCase();
                    const normalizedAuth = authLabel === 'administrator' ? 'admin' : authLabel;
                    const isAdminUser = normalizedAuth === 'admin';
                    const badgeClass = normalizedAuth === 'admin'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100'
                      : normalizedAuth === 'manager'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100'
                        : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-200';
                    const badgeLabel = normalizedAuth === 'admin' ? 'Admin' : normalizedAuth === 'manager' ? 'Manager' : 'User';
                    return (
                      <label key={user.user_id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-800/60">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isAdminUser ? true : (docUserIds.length === 0 ? true : docUserIds.includes(user.user_id))}
                          onChange={(e) => toggleUserAccess(user.user_id, e.target.checked)}
                          disabled={permBusy || docPermLoading || isAdminUser}
                          title={isAdminUser ? 'Admin 角色一律擁有所有檔案' : undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium" title={user.name || user.email}>{user.name || user.email}</div>
                          <div className="truncate text-xs text-gray-500" title={user.email}>{user.email}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${badgeClass}`}>{badgeLabel}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Confirm dialog */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="確認刪除"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button variant="danger" onClick={() => doDelete(confirmTargets)}>刪除</Button>
          </>
        }
      >
        此動作無法復原，將從資料庫與索引中永久刪除選取的 {confirmTargets.length} 筆文件，確定要刪除？
      </Modal>
    </div>
  );
}
