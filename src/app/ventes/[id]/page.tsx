import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import type { SaleRow, SaleItemRow } from "@/lib/sales-types";

export const dynamic = "force-dynamic";

type VentesDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function VenteDetailPage({ params }: VentesDetailPageProps) {
  const { id } = await params;
  const saleId = Number(id);

  if (!Number.isFinite(saleId) || saleId <= 0) {
    notFound();
  }

  // 1) Charger la vente
  const { data: sale, error: saleError } = await supabaseServer
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .single();

    if (saleError || !sale) {
      return (
        <main className="p-6 space-y-3">
          <h1 className="text-xl font-semibold">Erreur chargement vente</h1>
          <pre className="text-xs bg-black/5 p-3 rounded">
            {JSON.stringify({ saleId, saleError, sale }, null, 2)}
          </pre>
          <Link className="underline" href="/ventes">← Retour aux ventes</Link>
        </main>
      );
    }

  // 2) Charger les lignes de vente
  const { data: items, error: itemsError } = await supabaseServer
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

  const renderHeader = (
    label: string,
    align: "left" | "right" | "center" = "left"
  ) => {
    const alignClass =
      align === "right"
        ? "text-right"
        : align === "center"
        ? "text-center"
        : "text-left";

    return (
      <th className={cn("px-4 py-3 font-medium", alignClass)}>{label}</th>
    );
  };

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
        <SalesStatCard
          title="Net vendeur"
          mainValue={euro.format(net)}
          color="indigo"
        />

        <SalesStatCard
          title="Coût total (FIFO)"
          mainValue={euro.format(totalCost)}
          color="orange"
        />

        <SalesStatCard
          title="Marge totale"
          mainValue={euro.format(totalMargin)}
          color="amber"
        />

        <SalesStatCard
          title="Taux de marge"
          mainValue={
            marginRate !== null
              ? `${(marginRate * 100).toFixed(1)}%`
              : "—"
          }
          color="emerald"
        />
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                {renderHeader("Type", "left")}
                {renderHeader("Réf. set / pièce", "left")}
                {renderHeader("Qté", "right")}
                {renderHeader("Net ligne", "right")}
                {renderHeader("Coût (FIFO)", "right")}
                {renderHeader("Marge", "right")}
              </tr>
            </thead>

            <tbody>
              {saleItems.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={6}
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
                      <td className="px-4 py-3">
                        {labelType}
                        {item.item_kind === "SET" && item.is_partial_set && (
                          <span className="ml-1 text-[11px] rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                            Set partiel
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.item_kind === "SET" && item.set_id ? (
                          <Link
                            href={`/ventes/${saleId}/${item.id}`}
                            className="underline-offset-2 hover:underline text-slate-900"
                            title="Voir les pièces réellement vendues pour ce set"
                          >
                            {refValue}
                          </Link>
                        ) : (
                          refValue
                        )}
                      </td>
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