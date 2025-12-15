import Link from "next/link";

export type SoldPiecesRow = {
  piece_ref: string;
  source: "SET" | "PIECE" | string;
  sale_id: string;
  sale_item_id: string;
  paid_at: string | null;
  sales_channel: string | null;
  sale_type: "SET" | "PIECE" | string | null;
  status: string | null;
  quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  lot_id: string | null;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function SoldPiecesTable({
  rows,
}: {
  rows: SoldPiecesRow[];
}) {
  return (
    <section className="space-y-3">
      {/* Titre / sous-titre en dehors de la card (comme les autres pages) */}
      <div className="px-1">
        <h2 className="text-base font-semibold">Pièces vendues</h2>
        <p className="text-xs text-muted-foreground">
          Journal basé sur <code>sale_item_pieces</code> (pièces réellement consommées).
        </p>
      </div>

      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-4 py-3 font-medium">Pièce</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium text-right">Qté</th>
                <th className="px-4 py-3 font-medium text-right">Coût unit.</th>
                <th className="px-4 py-3 font-medium text-right">Coût total</th>
                <th className="px-4 py-3 font-medium">Lot</th>
                <th className="px-4 py-3 font-medium text-right">Vente</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                    colSpan={9}
                  >
                    Aucune ligne à afficher (vérifie qu’il existe des ventes CONFIRMED).
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.sale_item_id}-${r.piece_ref}-${r.lot_id ?? "no-lot"}`}
                    className="app-table-row"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.piece_ref}</td>
                    <td className="px-4 py-3">{r.source}</td>
                    <td className="px-4 py-3">
                      {r.paid_at
                        ? new Date(r.paid_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{r.sales_channel ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(r.quantity ?? 0).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.unit_cost ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.total_cost ?? 0))}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.lot_id ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="text-xs font-medium text-primary hover:underline"
                        href={`/ventes/${r.sale_id}`}
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}