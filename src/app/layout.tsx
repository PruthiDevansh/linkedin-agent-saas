import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { NavProgress } from "@/components/nav-progress";
import { Toaster } from "@/components/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kalam";

export const metadata: Metadata = {
  title: { default: `${appName}: your AI LinkedIn growth agent`, template: `%s · ${appName}` },
  description: "Daily LinkedIn posts from trending news, images and carousels, scheduling and analytics. Approve from Telegram, WhatsApp or the web.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e16" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">
        {children}
        <Suspense>
          <NavProgress />
          <Toaster />
        </Suspense>
      </body>
    </html>
  );
}
