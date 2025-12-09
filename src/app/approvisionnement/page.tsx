import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type LotRow = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string; // renvoyé en string ISO par Supabase
  supplier: string | null;
  total_pieces: number;
  total_cost: string; // numeric => string côté JS
  status: string;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

export default async function ApprovisionnementPage() {
  const { data, error } = await supabase
    .from("lots")
    .select(
      "id, lot_code, label, purchase_date, supplier, total_pieces, total_cost, status"
    )
    .order("purchase_date", { ascending: false });

  if (error) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Approvisionnements
          </h1>
          <p className="text-sm text-muted-foreground">
            Erreur lors du chargement des lots : {error.message}
          </p>
        </div>
      </main>
    );
  }

  const lots = (data ?? []) as LotRow[];

  return (
    <main className="space-y-6">
      {/* HEADER PAGE */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Approvisionnements
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestion des lots d&apos;achat et du stock initial.
          </p>
        </div>

        {/* Bouton sera branché à un dialog dans un prochain snippet */}
        <Button
          type="button"
          size="sm"
          className="rounded-full px-4 shadow-[0_10px_25px_rgba(15,23,42,0.35)]"
        >
          Nouveau lot
        </Button>
      </div>

      {/* TABLE DES LOTS */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-4 py-3 text-left font-medium">LotID</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Libellé</th>
                <th className="px-4 py-3 text-left font-medium">Fournisseur</th>
                <th className="px-4 py-3 text-right font-medium">
                  Nb pièces
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Coût total
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Coût / pièce
                </th>
                <th className="px-4 py-3 text-center font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {lots.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucun lot d&apos;approvisionnement pour le moment.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => {
                  const totalCostNumber = Number(lot.total_cost ?? 0);
                  const costPerPiece =
                    lot.total_pieces > 0
                      ? totalCostNumber / lot.total_pieces
                      : 0;

                  return (
                    <tr
                      key={lot.id}
                      className="border-t border-border hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {lot.lot_code || `LOT_${lot.id}`}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(lot.purchase_date)}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {lot.label || "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {lot.supplier || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {lot.total_pieces}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {euro.format(totalCostNumber)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {lot.total_pieces > 0
                          ? euro.format(costPerPiece)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            lot.status === "confirmed"
                              ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600"
                          }
                        >
                          {lot.status === "confirmed"
                            ? "Confirmé"
                            : "Brouillon"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Voir détail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
