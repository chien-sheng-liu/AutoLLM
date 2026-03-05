import "./globals.css";
import Nav from "@/app/components/Nav";
import Toaster from "@/app/components/Toaster";

export const metadata = {
  title: "零程式碼 RAG 聊天機器人",
  description: "上傳資料、設定 RAG、以引用佐證的答案進行對話",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-950 dark:from-neutral-950 dark:to-neutral-900 dark:text-gray-100">
        <Nav />
        <main className="mx-auto max-w-screen-2xl px-6 md:px-10 py-8 md:py-12">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
