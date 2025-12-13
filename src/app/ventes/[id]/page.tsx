import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { SaleRow, SaleItemRow } from "@/lib/sales-types";

export const dynamic = "force-dynamic";

type VentesDetailPageProps = {
  params: {
    id: string;
  };
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function VenteDetailPage({ params }: VentesDetailPageProps) {
  const saleId = Number(params.id);
  if (!Number.isFinite(saleId) || saleId <= 0) {
    notFound();
  }

  // 1) Charger la vente
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .single();

  if (saleError || !sale) {
    // On peut soit afficher un message, soit renvoyer un 404
    // Ici, on choisit un 404 pour rester cohérent avec les autres pages de détail.
    notFound();
  }

  // 2) Charger les lignes de vente
  const { data: items, error: itemsError } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId)
    .order("line_index", { ascending: true });

  if (itemsError) {
    console.error("VenteDetailPage - erreur lors du chargement des lignes:", itemsError);
  }

  const saleRow = sale as SaleRow;
  const saleItems = (items ?? []) as SaleItemRow[];

  const net = Number(saleRow.net_seller_amount ?? 0);
  const totalCost = Number(saleRow.total_cost_amount ?? 0);
  const totalMargin = Number(saleRow.total_margin_amount ?? 0);
  const marginRate =
    saleRow.margin_rate !== null && saleRow.margin_rate !== undefined
      ? saleRow.margin_rate
      : net > 0
      ? totalMargin / net
      : null;

  const isCancelled = saleRow.status === "CANCELLED";

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vente #{saleRow.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {saleRow.sale_type === "SET"
              ? "Vente de set(s)"
              : "Vente de pièces au détail"}
            {" · "}
            {saleRow.sales_channel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Payée le {formatDate(saleRow.paid_at)} · Statut :{" "}
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                isCancelled
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              {isCancelled ? "Annulée" : "Confirmée"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/ventes"
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            ← Retour aux ventes
          </Link>
          {/* Les boutons d'annulation / édition seront ajoutés plus tard */}
        </div>
      </div>

      {/* STATS DE LA VENTE */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
        <div className="app-card p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Net vendeur
          </p>
          <p className="text-2xl font-semibold">{euro.format(net)}</p>
        </div>

        <div className="app-card p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Coût total (FIFO)
          </p>
          <p className="text-2xl font-semibold">
            {euro.format(totalCost)}
          </p>
        </div>

        <div className="app-card p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Marge totale
          </p>
          <p className="text-2xl font-semibold">
            {euro.format(totalMargin)}
          </p>
        </div>

        <div className="app-card p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Taux de marge
          </p>
          <p className="text-2xl font-semibold">
            {marginRate !== null ? `${(marginRate * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
      </section>

      {/* COMMENTAIRE GLOBAL */}
      {saleRow.comment && (
        <section className="app-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Commentaire
          </p>
          <p className="text-sm whitespace-pre-line">{saleRow.comment}</p>
        </section>
      )}

      {/* LIGNES DE VENTE */}
      <section className="app-card overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Lignes de vente</h2>
          <p className="text-xs text-muted-foreground">
            {saleItems.length} ligne(s)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Ligne</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">
                  Réf. set / pièce
                </th>
                <th className="px-4 py-3 text-right font-medium">Qté</th>
                <th className="px-4 py-3 text-right font-medium">
                  Net ligne
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Coût (FIFO)
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Marge
                </th>
              </tr>
            </thead>

            <tbody>
              {saleItems.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucune ligne de vente pour cette vente.
                  </td>
                </tr>
              ) : (
                saleItems.map((item) => {
                  const netLine = Number(item.net_amount ?? 0);
                  const costLine = Number(item.cost_amount ?? 0);
                  const marginLine =
                    item.margin_amount !== null &&
                    item.margin_amount !== undefined
                      ? Number(item.margin_amount)
                      : netLine - costLine;

                  const labelType =
                    item.item_kind === "SET" ? "Set" : "Pièce";

                  const refValue =
                    item.item_kind === "SET"
                      ? item.set_id ?? "—"
                      : item.piece_ref ?? "—";

                  return (
                    <tr key={item.id} className="app-table-row">
                      <td className="px-4 py-3 font-mono text-xs">
                        #{item.line_index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {labelType}
                        {item.item_kind === "SET" && item.is_partial_set && (
                          <span className="ml-1 text-[11px] rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                            Set partiel
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{refValue}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {netLine > 0 ? euro.format(netLine) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {costLine > 0 ? euro.format(costLine) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {marginLine !== 0
                          ? euro.format(marginLine)
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}