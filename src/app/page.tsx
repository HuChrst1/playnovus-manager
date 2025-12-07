import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="px-4 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* En-tête simple */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              PlayNovus Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              Pilote ton stock Playmobil dans une interface claire et moderne.
            </p>
          </div>
        </header>

        {/* Card principale façon dashboard */}
        <section className="app-card p-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
              Bienvenue
            </p>
            <h2 className="text-2xl font-semibold leading-tight text-foreground">
              Commence par explorer le catalogue des sets.
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Ajoute des sets, renseigne leurs pièces et suis le niveau de
              complétion grâce aux jauges de stock.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <Button asChild size="lg" className="rounded-full px-6 shadow-md">
              <Link href="/catalogue">Ouvrir le catalogue</Link>
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Tu pourras ensuite accéder aux pages Appro, Ventes et Dashboard.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}