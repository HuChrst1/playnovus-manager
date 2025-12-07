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
      {/* Outfit est déclarée dans globals.css comme font-sans */}
      <body className="app-shell font-sans antialiased">
        {children}
      </body>
    </html>
  );
}