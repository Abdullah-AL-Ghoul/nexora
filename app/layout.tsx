import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
