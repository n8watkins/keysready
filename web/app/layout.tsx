import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

// No Google Fonts (next/font/google) — system font stack keeps this fully off Google.

export const metadata: Metadata = {
  title: "KeysReady — Booking & repair updates for auto shops",
  description:
    "Book auto repair in under a minute and get a push notification the moment your car is ready. Free for shops — installable, no app store.",
  manifest: "/manifest.webmanifest",
  applicationName: "KeysReady",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "KeysReady" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#d40000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
