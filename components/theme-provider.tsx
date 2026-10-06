"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light-first editorial identity with a full dark mode. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
