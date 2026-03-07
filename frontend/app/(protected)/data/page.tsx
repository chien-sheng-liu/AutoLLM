"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredUser } from "@/lib/session";
import { fetchProfile } from "@/lib/api";
import { listDocuments, deleteDocument, uploadDocumentWithProgress, type DocumentsList } from "@/lib/api";
import { showToast } from "@/app/components/Toaster";
import Button, { buttonClasses } from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import Card from "@/app/components/ui/Card";
import Modal from "@/app/components/ui/Modal";

type Doc = { document_id: string; name: string };

export default function DataPage() {
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargets, setConfirmTargets] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  // content quick search removed per request
  const nameSearchRef = useRef<HTMLInputElement>(null);

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
    } catch (e: any) {
      showToast(e?.message || "載入文件清單失敗", { kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    const u = getStoredUser();
    const auth = (u?.auth || 'user').toLowerCase();
    setIsAdmin(auth === 'admin' || auth === 'administrator');
    fetchProfile().then((u)=>{
      try { window.localStorage.setItem('autollm_user', JSON.stringify(u)); } catch {}
      const auth = (u?.auth || 'user').toLowerCase();
      setIsAdmin(auth === 'admin' || auth === 'administrator');
    }).catch(()=>{});
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

  function toggleSelectAll(checked: boolean) {
    if (checked) setSelectedIds(filteredDocs.map((d) => d.document_id));
    else setSelectedIds([]);
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
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
      setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
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
