"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SalesListRow } from "@/lib/sales";
import { ClickableRow } from "@/app/catalogue/ClickableRow";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { DeleteSaleDialog } from "@/components/sales/DeleteSaleDialog";
import { EditSaleDialog } from "@/components/sales/EditSaleDialog";

export type SalesTableSortDir = "asc" | "desc";

type SalesPagination = {
  currentPage: number;
  totalPages: number;
  pageNumbers: (number | "dots")[];
  pageFrom: number;
  pageTo: number;
  totalCount: number;
};

export type SalesTableProps = {
  rows: SalesListRow[];
  activeSortKey: string;
  sortDir: SalesTableSortDir;

  /**
   * Query string SANS sort/dir (ex: "tab=sales&from=...&channel=...")
   * On va reconstruire sort/dir côté client.
   */
  baseQuery: string;
  pagination?: SalesPagination;
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
  pagination,
}: SalesTableProps) {

  const makeSortHref = (columnKey: string) => {
    const params = new URLSearchParams(baseQuery);

    params.set("page", "1");

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

  const makePageHref = (page: number) => {
    const params = new URLSearchParams(baseQuery);

    // on conserve le tri actuel pendant la pagination
    params.set("sort", activeSortKey);
    params.set("dir", sortDir);

    params.set("page", String(page));

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

  const renderStatusBadge = (status: string | null | undefined) => {
    const s = String(status ?? "CONFIRMED").toUpperCase();

    const isCancelled = s === "CANCELLED";

    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
          isCancelled
            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        )}
      >
        {isCancelled ? "Annulée" : "Confirmée"}
      </span>
    );
  };

  return (
    <div className="app-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="app-table-head">
          <tr>
            {renderSortableHeader("N° vente", "sale_id", "left")}
            {renderSortableHeader("Date", "paid_at", "left")}
            {renderSortableHeader("Canal", "sales_channel", "left")}
            {renderSortableHeader("Type", "sale_type", "left")}
            {renderSortableHeader("Statut", "status", "left")}
            {renderSortableHeader("CA net", "net_seller_amount", "right")}
            {renderSortableHeader("Coût total", "total_cost_amount", "right")}
            {renderSortableHeader("Marge net", "total_margin_amount", "right")}

            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-border">
                <td
                  colSpan={9}
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
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold">{r.sale_number_display}</div>
                    </td>

                    <td className="px-4 py-3">{formatDate(r.paid_at)}</td>

                    <td className="px-4 py-3">{r.sales_channel}</td>

                    <td className="px-4 py-3">
                      {r.sale_type === "SET"
                        ? "SET"
                        : r.sale_type === "PIECE"
                        ? "PIECE"
                        : "MIXED"}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(r.status)}
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

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {/* Empêche le click de la ligne (ClickableRow) */}
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* EDIT (crayon) */}
                        <EditSaleDialog saleId={r.sale_id} />

                        {/* DELETE (poubelle) — TODO action serveur */}
                        <DeleteSaleDialog
                          saleId={r.sale_id}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              aria-label="Supprimer la vente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </ClickableRow>
                );
              })
            )}
          </tbody>
        </table>
      </div>
                {/* Pagination — même design que /catalogue */}
                {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Affichage {pagination.pageFrom}–{pagination.pageTo} sur{" "}
            {pagination.totalCount.toLocaleString("fr-FR")} commandes
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-background px-2 py-1 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                asChild
                disabled={pagination.currentPage === 1}
                className="h-7 w-7 rounded-full"
              >
                <Link href={makePageHref(pagination.currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>

              {pagination.pageNumbers.map((item, index) =>
                item === "dots" ? (
                  <span
                    key={`dots-${index}`}
                    className="h-7 px-2 flex items-center justify-center text-xs text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={makePageHref(item)}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-full text-xs transition-colors",
                      item === pagination.currentPage
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {item}
                  </Link>
                )
              )}

              <Button
                variant="ghost"
                size="icon"
                asChild
                disabled={pagination.currentPage === pagination.totalPages}
                className="h-7 w-7 rounded-full"
              >
                <Link href={makePageHref(pagination.currentPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}
