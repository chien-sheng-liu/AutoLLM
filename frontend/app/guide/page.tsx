export const metadata = {
  title: "教學 | 零程式碼 RAG 聊天機器人",
  description: "完整教學：上傳、切分、向量化、檢索、聊天與引用、設定與執行方式。",
};

export default function GuidePage() {
  return (
    <div className="grid gap-8">
      <header className="rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] px-6 py-8 shadow-soft md:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" /> 教學總覽
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">從零開始：如何使用</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-[var(--text-secondary)]">
          本頁涵蓋快速開始、檔案上傳、RAG 設定、聊天與引用、執行方式與疑難排除。
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft">
          <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">1) 快速開始</div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
            <li>設定環境變數：後端需 <code className="rounded bg-[var(--surface-muted)] px-1 text-[var(--text-primary)]">OPENAI_API_KEY</code>。</li>
            <li>啟動後端：<code className="ml-1 rounded bg-[var(--surface-muted)] px-1 text-[var(--text-primary)]">uvicorn app.main:app --reload --port 8000</code></li>
            <li>啟動前端：<code className="ml-1 rounded bg-[var(--surface-muted)] px-1 text-[var(--text-primary)]">npm run dev</code>（需設定 <code className="rounded bg-[var(--surface-muted)] px-1 text-[var(--text-primary)]">NEXT_PUBLIC_API_BASE_URL</code>）。</li>
            <li>或使用 Docker + Make：<code className="ml-1 rounded bg-[var(--surface-muted)] px-1 text-[var(--text-primary)]">make up</code></li>
          </ol>
        </div>
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft">
          <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">2) 上傳與索引</div>
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
            <li>前往「資料」頁，上傳 <strong>.txt</strong> 或 <strong>.pdf</strong>。</li>
            <li>系統自動：切分 → 向量化（OpenAI） → 儲存（PostgreSQL + pgvector）。</li>
            <li>完成後會顯示於列表，並可被檢索。</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft">
          <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">3) 開始聊天</div>
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
            <li>前往「聊天」頁，輸入問題。</li>
            <li>系統會以 Top-K 檢索結果作為脈絡，生成答案。</li>
            <li>每則回答附上來源引用（文件、片段、分數）。</li>
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft">
        <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">RAG 參數</div>
        <div className="grid gap-4 text-sm text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">chunk_size</div>
            <p className="mt-1 text-[var(--text-muted)]">每個片段字元數（預設 1000）。內容分散時可適度放大。</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">chunk_overlap</div>
            <p className="mt-1 text-[var(--text-muted)]">相鄰片段重疊字元數（預設 200），避免上下文斷裂。</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">top_k</div>
            <p className="mt-1 text-[var(--text-muted)]">檢索回傳的片段數（預設 4），過高會稀釋脈絡。</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">chat_model</div>
            <p className="mt-1 text-[var(--text-muted)]">回覆所用的聊天模型（預設 gpt-4o-mini）。</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">embedding_model</div>
            <p className="mt-1 text-[var(--text-muted)]">嵌入向量模型（預設 text-embedding-3-small）。</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft">
        <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">執行方式與環境變數</div>
        <div className="grid gap-4 text-sm text-[var(--text-secondary)] md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">Backend</div>
            <ul className="mt-1 space-y-1">
              <li>OPENAI_API_KEY（必要）</li>
              <li>OPENAI_CHAT_MODEL（預設 gpt-4o-mini）</li>
              <li>OPENAI_EMBEDDING_MODEL（預設 text-embedding-3-small）</li>
              <li>DATA_DIR（預設 backend/data）</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <div className="font-medium text-[var(--text-primary)]">Frontend</div>
            <ul className="mt-1 space-y-1">
              <li>NEXT_PUBLIC_API_BASE_URL（例如 http://localhost:8000）</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-xs text-[var(--text-secondary)]">
{`# Docker + Make
cp .env.example .env
make up
make logs   # 檢視服務日誌
make down   # 停止
make clean  # 清除 volume

# Dev 模式
# Backend
cd backend
export OPENAI_API_KEY=sk-...
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
export NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm install && npm run dev`}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border-light)] bg-[var(--surface)] p-6 shadow-soft">
        <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">疑難排除</div>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>
            後端回報 500：請確認 <code className="rounded bg-[var(--surface-muted)] px-1 text-[var(--text-primary)]">OPENAI_API_KEY</code> 已設定，且可連線 OpenAI。
          </li>
          <li>
            上傳失敗：確認檔案格式（僅支援 .txt/.pdf）與大小是否過大。
          </li>
          <li>
            沒有引用：資料可能尚未完全索引，或 Top-K 設太低，請調整設定。
          </li>
        </ul>
      </section>
    </div>
  );
}
