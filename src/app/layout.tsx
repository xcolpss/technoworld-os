import type { Metadata } from "next";
import "./globals.css";
import { ThemeSync } from "@/components/theme-sync";

export const metadata: Metadata = {
  title: "TechnoWorld OS — POS & Business Intelligence",
  description: "Retail management platform for TechnoWorld Rawalpindi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const mode = localStorage.getItem('tw_theme_mode') || 'light';
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (mode === 'dark' || (mode === 'system' && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-[var(--background)] text-[var(--foreground)] antialiased selection:bg-[var(--primary)]/20 selection:text-[var(--foreground)] transition-colors duration-200">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}