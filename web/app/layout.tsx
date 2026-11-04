import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

// No Google Fonts (next/font/google): the system font stack keeps this fully off Google.

const TITLE = "KeysReady: booking and repair updates for auto shops";
const DESCRIPTION =
  "Book auto repair in under a minute and get a push notification the moment your car is ready. Free for shops, installable, no app store.";

export const metadata: Metadata = {
  // Absolute base so the share image (app/opengraph-image.tsx) resolves in unfurls.
  metadataBase: new URL("https://app.keysready.n8builds.dev"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "KeysReady", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  manifest: "/manifest.webmanifest",
  applicationName: "KeysReady",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "KeysReady" },
  // Icons come from the file conventions: app/favicon.ico, app/icon.svg and app/apple-icon.png.
};

export const viewport: Viewport = {
  themeColor: "#16171b",
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
