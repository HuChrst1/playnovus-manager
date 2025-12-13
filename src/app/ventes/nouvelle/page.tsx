import Link from "next/link";
import { NewSaleForm } from "./NewSaleForm";

export default function NouvelleVentePage() {
  return (
    <main className="space-y-6">
      {/* HEADER PAGE */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nouvelle vente
          </h1>
          <p className="text-sm text-muted-foreground">
            Enregistrer une vente de set ou de pièces au détail.
          </p>
        </div>

        <Link
          href="/ventes"
          className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          ← Retour aux ventes
        </Link>
      </div>

      {/* FORMULAIRE DANS UNE CARD */}
      <div className="app-card p-4 sm:p-6 lg:p-7">
        <NewSaleForm />
      </div>
    </main>
  );
}