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
        {/* Fond global clair + app centrée horizontalement, alignée en haut */}
        <div className="min-h-screen flex justify-center px-3 sm:px-6 py-6 md:py-8">
          <div className="flex w-full max-w-7xl gap-4 sm:gap-6">
            {/* Sidebar verticale façon maquette (menu gauche) */}
            <aside className="hidden md:flex app-sidebar">
              {/* Haut : logo + icônes principales */}
              <div className="flex flex-col items-center gap-4">
                {/* Logo PlayNovus minimal */}
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-[11px] font-semibold tracking-tight text-white shadow-[0_10px_25px_rgba(15,23,42,0.35)]">
                  PN
                </div>

                {/* Navigation principale (icônes seulement pour l’instant) */}
                <nav className="mt-6 flex flex-col items-center gap-3">
                  {/* Dashboard (actif) */}
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

            {/* Carte principale de contenu (le gros bloc blanc arrondi) */}
            <div className="flex-1">
              <div className="app-card px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7 flex flex-col gap-6">
                {/* Topbar façon maquette : titre, sous-titre, actions à droite */}
                <header className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight">
                      PlayNovus Manager
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Suivi de stock &amp; rentabilité de tes sets Playmobil.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Bouton notifications */}
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-border"
                      aria-label="Notifications"
                    >
                      <span className="text-[18px]">🔔</span>
                    </button>

                    {/* Avatar utilisateur rond avec dégradé */}
                    <div className="h-10 w-10 rounded-full bg-linear-to-tr from-primary to-[#6366f1] shadow-[0_10px_25px_rgba(15,23,42,0.25)]" />
                  </div>
                </header>

                {/* Zone de contenu des pages (catalogue, approvisionnement, etc.) */}
                <main className="flex-1 space-y-6">{children}</main>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
