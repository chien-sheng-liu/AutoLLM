import "./globals.css";
import Nav from "@/app/components/Nav";
import Toaster from "@/app/components/Toaster";
import { LanguageProvider } from "@/app/providers/LanguageProvider";

export const metadata = {
  title: "AutoLLM RAG Copilot",
  description: "Upload data, configure retrieval, and chat with cited answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen bg-[#03030b] text-slate-100">
        <LanguageProvider>
          <div className="pointer-events-none absolute inset-0 bg-tech" />
          <div className="pointer-events-none grid-overlay" />
          <Nav />
          <main className="relative px-4 py-8 md:px-10 md:py-12">{children}</main>
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
