/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0c0c14",
        surface: "#13131f",
        border: "#2d2b55",
        "text-primary": "#e2e8f0",
        "text-muted": "#6b7280",
        "accent-from": "#a855f7",
        "accent-to": "#3b82f6",
        live: "#ef4444",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
