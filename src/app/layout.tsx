import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";

export const metadata: Metadata = {
  title: "PlayNovus Manager",
  description: "Gestion de stock Playmobil",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="app-shell font-sans antialiased">
        {/* Layout plein écran : sidebar collée à gauche, contenu qui s'étire jusqu'à droite */}
        <div className="min-h-screen flex px-3 sm:px-6 py-6 md:py-8 gap-4 sm:gap-6">
          {/* Sidebar verticale gauche */}
          <AppSidebar />

          {/* Contenu principal : grosse card qui va jusqu'à la droite de l'écran */}
          <div className="flex-1">
            <div className="app-card w-full h-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}