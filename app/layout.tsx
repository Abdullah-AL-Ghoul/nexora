import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { Toaster } from "@/components/ui/sonner";
import { getPublicEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "NEXORA — Modern Commerce Platform",
    template: "%s | NEXORA",
  },
  description:
    "NEXORA is a modern, premium e-commerce platform built with Next.js, TypeScript, and PostgreSQL.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NEXORA",
    url: appUrl,
    title: "NEXORA — Modern Commerce Platform",
    description:
      "Premium essentials, honest prices, delivered fast — a modern commerce platform.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXORA — Modern Commerce Platform",
    description:
      "Premium essentials, honest prices, delivered fast — a modern commerce platform.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
