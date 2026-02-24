import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import { AppBackButton } from "@/components/AppBackButton";

export const metadata: Metadata = {
  title: "PlayNovus Manager",
  description: "Gestion de stock Playmobil",
  icons: {
    icon: "/playnovus-logo.svg",
    shortcut: "/playnovus-logo.svg",
    apple: "/playnovus-logo.svg",
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
