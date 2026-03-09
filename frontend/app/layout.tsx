import "./globals.css";
import Nav from "@/app/components/Nav";
import Toaster from "@/app/components/Toaster";

export const metadata = {
  title: "零程式碼 RAG 聊天機器人",
  description: "上傳資料、設定 RAG、以引用佐證的答案進行對話",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen bg-[#03030b] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-tech" />
        <div className="pointer-events-none grid-overlay" />
        <Nav />
        <main className="relative px-4 py-8 md:px-10 md:py-12">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
