import type { Metadata } from "next";
import "./globals.css";

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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-[11px] font-semibold tracking-tight text-white shadow-[0_10px_25px_rgba(15,23,42,0.35)]">
                PN
              </div>

              {/* Navigation principale (icônes seulement pour l’instant) */}
              <nav className="mt-6 flex flex-col items-center gap-3">
                {/* Dashboard (actif “fake” pour l’instant) */}
                <button
                  type="button"
                  className="app-sidebar-item app-sidebar-item--active"
                  aria-label="Dashboard"
                >
                  <span className="text-[15px]">🏠</span>
                </button>

                {/* Catalogue */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Catalogue"
                >
                  <span className="text-[15px]">📚</span>
                </button>

                {/* Approvisionnement */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Approvisionnement"
                >
                  <span className="text-[15px]">📥</span>
                </button>

                {/* Ventes */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Ventes"
                >
                  <span className="text-[15px]">💸</span>
                </button>

                {/* Dashboard KPI (pour plus tard) */}
                <button
                  type="button"
                  className="app-sidebar-item"
                  aria-label="Dashboard KPIs"
                >
                  <span className="text-[15px]">📊</span>
                </button>
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

