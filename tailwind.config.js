/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3A281C',
        background: '#F6F2EB',
        accent: '#B08A4A',
        customText: '#111111',
        secondary: '#ECE8E1',
        // Dark theme analogs
        darkBg: '#121110',
        darkCard: '#1C1A19',
        darkText: '#F5F5F5',
        darkSecondary: '#2C2A29',
        darkBorder: '#3C3A39',
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
