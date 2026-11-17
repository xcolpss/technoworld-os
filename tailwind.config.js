/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Inter"',
          '"Segoe UI"',
          "system-ui",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Plus Jakarta Sans"',
          '"Inter"',
          '"Segoe UI"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        brand: "var(--primary)",
        "brand-dark": "var(--primary-hover)",
        "brand-soft": "var(--brand-soft)",
        surface: "var(--surface)",
        "surface-solid": "var(--surface-solid)",
        "surface-secondary": "var(--surface-secondary)",
        "surface-elevated": "var(--surface-elevated)",
        warm: "var(--warm)",
        ink: "var(--ink)",
        foreground: "var(--foreground)",
        "foreground-secondary": "var(--foreground-secondary)",
        muted: "var(--muted)",
        border: "var(--border)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        info: "var(--info)",
      },
      boxShadow: {
        glass:
          "inset 0 1px 0 var(--glass-highlight), 0 4px 24px -4px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)",
        "glass-hover":
          "inset 0 1px 0 var(--glass-highlight), 0 14px 34px -8px rgba(15, 23, 42, 0.10), 0 4px 12px -2px rgba(255, 106, 0, 0.08)",
        "glass-modal":
          "inset 0 1px 0 var(--glass-highlight), 0 24px 60px -12px rgba(0, 0, 0, 0.25), 0 8px 20px -4px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
