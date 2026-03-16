"use client";
import { createContext, useContext, useEffect, useState } from "react";

type FontSize = "small" | "medium" | "large";
type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  fontSize: "medium",
  setFontSize: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const fontScaleMap: Record<FontSize, string> = {
  small: "0.875",
  medium: "1",
  large: "1.125",
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem("autollm.theme") as Theme | null;
      const f = localStorage.getItem("autollm.fontSize") as FontSize | null;
      if (t === "light" || t === "dark") setThemeState(t);
      if (f === "small" || f === "medium" || f === "large") setFontSizeState(f);
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("autollm.theme", theme);
    } catch {}
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.style.setProperty(
      "--font-scale",
      fontScaleMap[fontSize],
    );
    try {
      localStorage.setItem("autollm.fontSize", fontSize);
    } catch {}
  }, [fontSize, mounted]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
        fontSize,
        setFontSize: setFontSizeState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
