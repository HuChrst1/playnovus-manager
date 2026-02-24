import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import { AppBackButton } from "@/components/AppBackButton";

export const metadata: Metadata = {
  title: "PlayNovus Manager",
  description: "Gestion de stock Playmobil",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-playnovus-v1.ico", sizes: "any" },
      { url: "/icon-192-v1.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512-v1.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon-playnovus-v1.ico",
    apple: [
      {
        url: "/apple-touch-icon-v1.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="app-shell font-sans antialiased">
        <div className="app-layout-wrap">
          <div className="app-topbar-layout">
            <AppBackButton />
            <AppSidebar />
          </div>
          <div className="app-main">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
