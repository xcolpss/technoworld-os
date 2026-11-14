/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#FF6A00",
        "brand-dark": "#E65300",
        "brand-soft": "#FF8533",
        surface: "var(--surface)",
        warm: "var(--warm)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        border: "var(--border)",
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
}