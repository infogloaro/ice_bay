import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientRoot from "@/components/ClientRoot";

export const metadata: Metadata = {
  title: "ICE BAY POS",
  description: "ICE BAY — ice cream shop POS billing, customer display and admin (demo prototype).",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#FFC629", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
        />
      </head>
      <body>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
