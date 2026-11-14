"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const mode = localStorage.getItem("tw_theme_mode") || "light";
    const root = document.documentElement;
    root.classList.remove("dark");

    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemDark) root.classList.add("dark");
    }
  }, [pathname]);

  return null;
}