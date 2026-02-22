import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { Banknote, Calculator, ChartColumnIncreasing, Wallet } from "lucide-react";
import type { SaleRow, SaleItemRow } from "@/lib/sales-types";
import type { ReactNode } from "react";
import {
  formatBusinessSaleNumberDisplay,
  formatSetReferenceDisplay,
} from "@/lib/sale-number";

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
    notFound();
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
  const setIds = Array.from(
    new Set(
      saleItems
        .filter((item) => item.item_kind === "SET")
        .map((item) => String(item.set_id ?? "").trim())
        .filter((setId) => setId.length > 0)
    )
  );
  const setDisplayRefById: Record<string, string> = {};

  if (setIds.length > 0) {
    const { data: setRefs, error: setRefsError } = await supabaseServer
      .from("sets_catalog")
      .select("id, display_ref")
      .in("id", setIds);

    if (setRefsError) {
      console.error("VenteDetailPage - erreur chargement display_ref sets:", setRefsError);
    } else {
      for (const row of setRefs ?? []) {
        const setId = String(row.id ?? "").trim();
        const displayRef = String(row.display_ref ?? "").trim();
        if (setId.length > 0 && displayRef.length > 0) {
          setDisplayRefById[setId] = displayRef;
        }
      }
    }
  }

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
  const saleNumberDisplay = formatBusinessSaleNumberDisplay(
    saleRow.sale_number,
    saleRow.id
  );
  const saleTypeLabel =
    saleRow.sale_type === "SET"
      ? "SETS"
      : saleRow.sale_type === "PIECE"
      ? "PIECES"
      : "MIXED";

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
      <header className="flex flex-wrap items-start justify-between gap-3 px-1 md:px-2">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Commande n°{saleNumberDisplay}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {saleTypeLabel}
            {" · "}
            {saleRow.sales_channel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Payée le {formatDate(saleRow.paid_at)} · Statut :{" "}
            <span
              className={cn(
                "app-status-pill px-2.5 py-0.5 text-[11px]",
                isCancelled ? "app-status-pill--bad" : "app-status-pill--good"
              )}
            >
              {isCancelled ? "Annulée" : "Confirmée"}
            </span>
          </p>
        </div>
      </header>

      {/* STATS DE LA VENTE */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
        <SalesStatCard
          title="Net vendeur"
          mainValue={euro.format(net)}
          color="indigo"
          variant="neutral"
          icon={<Wallet className="h-4 w-4" />}
          iconGradientClassName="from-sky-700 to-blue-500"
        />

        <SalesStatCard
          title="Coût total (FIFO)"
          mainValue={euro.format(totalCost)}
          color="azure"
          variant="neutral"
          icon={<Banknote className="h-4 w-4" />}
          iconGradientClassName="from-cyan-600 to-sky-400"
        />

        <SalesStatCard
          title="Marge totale"
          mainValue={euro.format(totalMargin)}
          color="sky"
          variant="neutral"
          icon={<ChartColumnIncreasing className="h-4 w-4" />}
          iconGradientClassName="from-blue-700 to-indigo-500"
        />

        <SalesStatCard
          title="Taux de marge"
          mainValue={
            marginRate !== null
              ? `${(marginRate * 100).toFixed(1)}%`
              : "—"
          }
          color="emerald"
          variant="neutral"
          icon={<Calculator className="h-4 w-4" />}
          iconGradientClassName="from-sky-600 to-blue-400"
        />
      </section>

      {/* COMMENTAIRE GLOBAL */}
      {saleRow.comment && (
        <section className="app-surface-muted p-4 sm:p-5">
          <p className="app-section-label mb-1.5">
            Commentaire
          </p>
          <p className="text-sm whitespace-pre-line">{saleRow.comment}</p>
        </section>
      )}

      {/* LIGNES DE VENTE */}
      <section className="appro-table-shell">
        <div className="appro-table-scroll overflow-x-auto">
          <table className="appro-table min-w-full text-sm">
            <thead className="appro-table-header">
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
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
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
                      ? formatSetReferenceDisplay(
                          item.set_id,
                          setDisplayRefById[String(item.set_id ?? "").trim()] ?? null
                        ) || "—"
                      : item.piece_ref ?? "—";

                  const isSetRow = item.item_kind === "SET" && Boolean(item.set_id);
                  const href = isSetRow ? `/ventes/${saleId}/${item.id}` : null;

                  const Cell = ({
                    children,
                    className,
                    title,
                  }: {
                    children: ReactNode;
                    className?: string;
                    title?: string;
                  }) =>
                    href ? (
                      <td className="p-0">
                        <Link
                          href={href}
                          className={cn("block px-4 py-3", className)}
                          title={title}
                        >
                          {children}
                        </Link>
                      </td>
                    ) : (
                      <td className={cn("px-4 py-3", className)}>{children}</td>
                    );

                  return (
                    <tr key={item.id} className={cn("appro-table-row", href && "cursor-pointer")}>
                      <Cell title={href ? "Voir les pièces réellement vendues pour ce set" : undefined}>
                        {labelType}
                        {item.item_kind === "SET" && item.is_partial_set && (
                          <span className="ml-1 text-[11px] rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                            Set partiel
                          </span>
                        )}
                      </Cell>

                      <Cell
                        className="text-slate-900"
                        title={href ? "Voir les pièces réellement vendues pour ce set" : undefined}
                      >
                        {refValue}
                      </Cell>

                      <Cell className="text-right tabular-nums">{item.quantity}</Cell>
                      <Cell className="text-right tabular-nums">
                        {netLine > 0 ? euro.format(netLine) : "—"}
                      </Cell>
                      <Cell className="text-right tabular-nums">
                        {costLine > 0 ? euro.format(costLine) : "—"}
                      </Cell>
                      <Cell className="text-right tabular-nums">
                        {marginLine !== 0 ? euro.format(marginLine) : "—"}
                      </Cell>
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
