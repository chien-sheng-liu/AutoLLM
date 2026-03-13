/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./app/**/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-syne)", "Syne", "system-ui", "sans-serif"],
        body:    ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        mono:    ["var(--font-jetbrains-mono)", "JetBrains Mono", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          DEFAULT: "var(--brand-primary)",
          hover:   "var(--brand-hover)",
          active:  "var(--brand-active)",
          fg:      "#0E0E13",
          soft:    "var(--brand-100)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          panel:   "var(--surface-panel)",
          card:    "var(--surface-card)",
          muted:   "var(--surface-muted)",
          soft:    "var(--surface-soft)",
        },
        app: {
          background: "var(--bg-app)",
          subtle:     "var(--bg-subtle)",
        },
        border: {
          light:  "var(--border-light)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
          inverse:   "var(--text-inverse)",
        },
        state: {
          success: "var(--success)",
          warning: "var(--warning)",
          danger:  "var(--danger)",
          info:    "var(--info)",
        },
      },
      borderRadius: {
        xl:  "10px",
        "2xl": "14px",
        "3xl": "1.25rem",
        "4xl": "1.75rem",
      },
      boxShadow: {
        soft:    "var(--shadow-soft-md)",
        surface: "var(--shadow-soft-sm)",
        panel:   "var(--shadow-soft-lg)",
        brand:   "var(--shadow-brand)",
        glow:    "0 0 32px rgba(232, 164, 59, 0.20)",
        "amber-sm": "0 0 12px rgba(232, 164, 59, 0.18)",
      },
      backgroundImage: {
        "brand-gradient":      "var(--gradient-brand)",
        "brand-gradient-soft": "var(--gradient-brand-soft)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232,164,59,0.15)" },
          "50%":       { boxShadow: "0 0 0 8px rgba(232,164,59,0.06)" },
        },
        "fade-up": {
          "from": { opacity: "0", transform: "translateY(8px)" },
          "to":   { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.6s ease-in-out infinite",
        "fade-up":    "fade-up 0.45s ease both",
        "shimmer":    "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};
