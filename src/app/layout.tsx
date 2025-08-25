import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "../components/Providers";
import Navigation from "../components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Testapp - Calendar & Events",
  description: "A calendar and events management Progressive Web App",
  manifest: "/manifest.json",
  themeColor: "#8DD3C7",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Testapp",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    shortcut: "/favicon.svg",
    apple: [
      { url: "/icons/icon-192x192.svg", sizes: "192x192" },
      { url: "/icons/icon-512x512.svg", sizes: "512x512" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bodyClassName = [
    geistSans.variable,
    geistMono.variable,
    "antialiased"
  ].join(" ");

  return (
    <html lang="en">
      <body className={bodyClassName} suppressHydrationWarning={true}>
        <Providers>
          <Navigation />
          <main className="pb-20">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
