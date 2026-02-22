"use client";

import Link from "next/link";
import type { SalesListRow } from "@/lib/sales";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteSaleDialog } from "@/components/sales/DeleteSaleDialog";
import { EditSaleDialog } from "@/components/sales/EditSaleDialog";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import {
  SortableTableHeader,
  TableCard,
  TableOverflow,
  TablePagination,
  TableStatusBadge,
} from "@/components/ui/data-table";

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
  variant?: "default" | "appro";
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
  variant = "default",
}: SalesTableProps) {
  const isApproVariant = variant === "appro";

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

  const renderStatusBadge = (status: string | null | undefined) => {
    const s = String(status ?? "CONFIRMED").toUpperCase();
    const isCancelled = s === "CANCELLED";
    return (
      <TableStatusBadge
        label={isCancelled ? "Annulée" : "Confirmée"}
        tone={isCancelled ? "danger" : "success"}
      />
    );
  };

  return (
    <TableCard className={isApproVariant ? "appro-table-shell" : undefined}>
      <TableOverflow className={isApproVariant ? "appro-table-scroll" : undefined}>
        <table className={cn("min-w-full text-sm", isApproVariant && "appro-table")}>
          <thead className={isApproVariant ? "appro-table-header" : "app-table-head"}>
            <tr>
              <SortableTableHeader
                label="N° commande"
                columnKey="sale_id"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("sale_id")}
              />
              <SortableTableHeader
                label="Date"
                columnKey="paid_at"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("paid_at")}
              />
              <SortableTableHeader
                label="Canal"
                columnKey="sales_channel"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("sales_channel")}
              />
              <SortableTableHeader
                label="Type"
                columnKey="sale_type"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("sale_type")}
              />
              <SortableTableHeader
                label="CA net"
                columnKey="net_seller_amount"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("net_seller_amount")}
                align="right"
              />
              <SortableTableHeader
                label="Coût total"
                columnKey="total_cost_amount"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("total_cost_amount")}
                align="right"
              />
              <SortableTableHeader
                label="Marge net"
                columnKey="total_margin_amount"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("total_margin_amount")}
                align="right"
              />
              <SortableTableHeader
                label="Statut"
                columnKey="status"
                activeSortKey={activeSortKey}
                sortDir={sortDir}
                href={makeSortHref("status")}
              />

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
                  <ClickableTableRow
                    key={r.sale_id}
                    href={href}
                    className={
                      isApproVariant
                        ? "appro-table-row cursor-pointer focus-visible:outline-none"
                        : undefined
                    }
                  >
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

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.net_seller_amount ?? 0))}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.total_cost_amount ?? 0))}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(Number(r.total_margin_amount ?? 0))}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(r.status)}
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
                              className="h-8 w-8 rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                              aria-label="Supprimer la vente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </ClickableTableRow>
                );
              })
            )}
          </tbody>
        </table>
      </TableOverflow>
      {pagination ? (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageNumbers={pagination.pageNumbers}
          summary={
            <>
              Affichage {pagination.pageFrom}–{pagination.pageTo} sur{" "}
              {pagination.totalCount.toLocaleString("fr-FR")} commandes
            </>
          }
          makePageHref={makePageHref}
        />
      ) : null}
    </TableCard>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}
