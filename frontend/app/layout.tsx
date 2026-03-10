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
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] antialiased">
        <LanguageProvider>
          <div className="relative flex min-h-screen flex-col">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech" />
            <div aria-hidden className="pointer-events-none grid-overlay" />
            <div className="relative z-10 flex flex-1 flex-col">
              <Nav />
              <main className="relative flex-1 px-4 py-8 md:px-10 md:py-12">{children}</main>
            </div>
            <Toaster />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
