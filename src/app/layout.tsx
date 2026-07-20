import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SkipLink } from "@/components/skip-link";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InOrdo · Project change under control",
  description:
    "InOrdo turns project updates into evidence-backed, reviewable changes with deterministic impact paths and human approval.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
