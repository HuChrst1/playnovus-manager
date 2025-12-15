"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SalesListRow } from "@/lib/sales";
import { ClickableRow } from "@/app/catalogue/ClickableRow";

export type SalesTableSortDir = "asc" | "desc";

export type SalesTableProps = {
  rows: SalesListRow[];
  activeSortKey: string;
  sortDir: SalesTableSortDir;

  /**
   * Query string SANS sort/dir (ex: "tab=sales&from=...&channel=...")
   * On va reconstruire sort/dir côté client.
   */
  baseQuery: string;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function SalesTable({
  rows,
  activeSortKey,
  sortDir,
  baseQuery,
}: SalesTableProps) {
  const makeSortHref = (columnKey: string) => {
    const params = new URLSearchParams(baseQuery);

    if (activeSortKey === columnKey) {
      const nextDir = sortDir === "asc" ? "desc" : "asc";
      params.set("sort", columnKey);
      params.set("dir", nextDir);
    } else {
      params.set("sort", columnKey);
      params.set("dir", "asc");
    }

    const qs = params.toString();
    return qs ? `/ventes?${qs}` : "/ventes";
  };

  const renderSortableHeader = (
    label: string,
    columnKey: string,
    align: "left" | "right" | "center" = "left"
  ) => {
    const isActive = activeSortKey === columnKey;
    const isAsc = sortDir === "asc";

    const alignClass =
      align === "right"
        ? "text-right"
        : align === "center"
        ? "text-center"
        : "text-left";

    return (
      <th key={columnKey} className={cn("px-4 py-3 font-medium", alignClass)}>
        <Link
          href={makeSortHref(columnKey)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-primary",
            isActive && "text-primary"
          )}
        >
          <span>{label}</span>
          <span className="text-[10px]">
            {isActive ? (isAsc ? "▲" : "▼") : "⇅"}
          </span>
        </Link>
      </th>
    );
  };

  return (
    <div className="app-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="app-table-head">
            <tr>
              {renderSortableHeader("ID", "sale_id", "left")}
              {renderSortableHeader("Date", "paid_at", "left")}
              {renderSortableHeader("Canal", "sales_channel", "left")}
              {renderSortableHeader("Type", "sale_type", "left")}
              {renderSortableHeader("CA net", "net_seller_amount", "right")}
              {renderSortableHeader("Coût total", "total_cost_amount", "right")}
              {renderSortableHeader("Marge", "total_margin_amount", "right")}
              {renderSortableHeader("Marge %", "margin_rate", "right")}
              {renderSortableHeader("Nb sets", "sets_count", "right")}
              {renderSortableHeader("Nb pièces", "pieces_qty_total", "right")}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-border">
                <td
                  colSpan={10}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Aucune commande à afficher.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const href = `/ventes/${r.sale_id}`;

                return (
                  <ClickableRow key={r.sale_id} href={href}>
                    <td className="px-4 py-3 font-mono text-xs">#{r.sale_id}</td>

                    <td className="px-4 py-3">{formatDate(r.paid_at)}</td>

                    <td className="px-4 py-3">{r.sales_channel}</td>

                    <td className="px-4 py-3">
                      {r.sale_type === "SET"
                        ? "SET"
                        : r.sale_type === "PIECE"
                        ? "PIECE"
                        : "MIXED"}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.net_seller_amount ?? 0))}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.total_cost_amount ?? 0))}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.total_margin_amount ?? 0))}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.margin_rate !== null && r.margin_rate !== undefined
                        ? `${(r.margin_rate * 100).toFixed(1)}%`
                        : "—"}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(r.sets_count ?? 0)}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(r.pieces_qty_total ?? 0)}
                    </td>
                  </ClickableRow>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}