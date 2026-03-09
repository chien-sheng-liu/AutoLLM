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
          DEFAULT: '#4f46e5',
          fg: '#ffffff',
        },
        neon: {
          blue: '#00C2FF',
          violet: '#7C4DFF',
          pink: '#FF4D9D',
          cyan: '#3CF2E3',
        },
      },
      borderRadius: {
        'xl': '12px',
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(0,0,0,0.08)',
        'glow': '0 0 0 1px rgba(124,77,255,0.25), 0 10px 30px rgba(124,77,255,0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,77,255,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(124,77,255,0.08)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
