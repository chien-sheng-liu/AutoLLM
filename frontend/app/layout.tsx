import "./globals.css";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import Nav from "@/app/components/Nav";
import Toaster from "@/app/components/Toaster";
import { LanguageProvider } from "@/app/providers/LanguageProvider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "AutoLLM RAG Copilot",
  description: "Upload data, configure retrieval, and chat with cited answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] antialiased font-body">
        <LanguageProvider>
          <div className="relative flex min-h-screen flex-col">
            {/* Atmospheric background */}
            <div aria-hidden className="pointer-events-none fixed inset-0 bg-tech" />
            <div aria-hidden className="pointer-events-none fixed grid-overlay" />
            <div aria-hidden className="pointer-events-none fixed noise-overlay" />
            {/* Content */}
            <div className="relative z-10 flex flex-1 flex-col">
              <Nav />
              <main className="relative flex-1 px-4 py-8 md:px-10 md:py-10">{children}</main>
            </div>
            <Toaster />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
