/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./app/**/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-hover)',
          active: 'var(--brand-active)',
          fg: '#ffffff',
          soft: 'var(--brand-100)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          panel: 'var(--surface-panel)',
          card: 'var(--surface-card)',
          muted: 'var(--surface-muted)',
          soft: 'var(--surface-soft)',
        },
        app: {
          background: 'var(--bg-app)',
          subtle: 'var(--bg-subtle)',
        },
        border: {
          light: 'var(--border-light)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        state: {
          success: 'var(--success)',
          warning: 'var(--warning)',
          danger: 'var(--danger)',
          info: 'var(--info)',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        soft: 'var(--shadow-soft-md)',
        surface: 'var(--shadow-soft-sm)',
        panel: 'var(--shadow-soft-lg)',
        brand: 'var(--shadow-brand)',
        glow: '0 12px 32px rgba(124, 92, 255, 0.22)',
      },
      backgroundImage: {
        'brand-gradient': 'var(--gradient-brand)',
        'brand-gradient-soft': 'var(--gradient-brand-soft)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,92,255,0.22)' },
          '50%': { boxShadow: '0 0 0 8px rgba(124,92,255,0.1)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
