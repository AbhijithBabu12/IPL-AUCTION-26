import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import dynamic from "next/dynamic";

import "./globals.css";

const displayFont = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

// Loaded client-side only — avoids SSR / hydration mismatch
const IntroSplash = dynamic(() => import("@/components/intro-splash"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "SFL Auction Platform",
  description: "Real-time SFL fantasy auction simulator with bidding, trades, and scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}

