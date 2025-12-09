import type { Metadata } from "next";
import Link from "next/link";
import { Home, Truck, ShoppingCart, Boxes, BookOpen } from "lucide-react";
import "./globals.css";
import Image from "next/image";

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
          <aside className="hidden md:flex app-sidebar">
            {/* Haut : logo + icônes principales */}
            <div className="flex flex-col items-center gap-4">
              {/* Logo PlayNovus minimal */}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_25px_rgba(15,23,42,0.25)]">
                <Image
                  src="/playnovus-logo.svg"
                  alt="PlayNovus"
                  width={50}
                  height={50}
                  className="object-contain"
                  priority
                />
              </div>

              {/* Navigation principale (icônes seulement pour l’instant) */}
              <nav className="mt-6 flex flex-col items-center gap-3">
                {/* 1. Home */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Accueil"
                >
                  <Home className="h-4 w-4" />
                </button>

                {/* 2. Approvisionnements */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Approvisionnements"
                >
                  <Truck className="h-4 w-4" />
                </button>

                {/* 3. Ventes */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Ventes"
                >
                  <ShoppingCart className="h-4 w-4" />
                </button>

                {/* 4. Stock */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Stock"
                >
                  <Boxes className="h-4 w-4" />
                </button>

                {/* 5. Catalogue → route /catalogue (actif) */}
                <Link
                  href="/catalogue"
                  className="app-sidebar-item app-sidebar-item--active"
                  aria-label="Catalogue"
                >
                  <BookOpen className="h-4 w-4" />
                </Link>
              </nav>
            </div>

            {/* Bas : paramètres / aide */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                className="app-sidebar-item"
                aria-label="Paramètres"
              >
                <span className="text-[16px]">⚙️</span>
              </button>
              <button
                type="button"
                className="app-sidebar-item"
                aria-label="Aide"
              >
                <span className="text-[16px]">?</span>
              </button>
            </div>
          </aside>

          {/* Contenu principal : grosse card qui va jusqu'à la droite de l'écran */}
          <div className="flex-1">
            <div className="app-card w-full h-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
              {/* Chaque page gère maintenant son propre titre / header */}
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}