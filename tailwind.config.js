/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px",
      "3xl": "1920px",
    },
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        border: "var(--border)",
        text: "var(--txt)",
        muted: "var(--txt2)",
        muted2: "var(--txt3)",
        tech: "var(--tec)",
        pac: "var(--pac)",
        gasto: "var(--gasto)",
        servicios: "var(--serv)",
        pactec: "var(--pactec)",
        nocat: "var(--nocat)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        panel: "0 18px 42px rgba(0, 0, 0, 0.28)",
      },
      borderRadius: {
        xl2: "10px",
      },
    },
  },
  plugins: [],
};
