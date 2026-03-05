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
      },
      borderRadius: {
        'xl': '12px',
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

