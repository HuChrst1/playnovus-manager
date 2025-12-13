// src/components/sales/SalesTable.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SaleRow } from "@/lib/sales-types";

export type SalesTableSortDir = "asc" | "desc";

export type SalesTableProps = {
  /**
   * Liste des ventes à afficher.
   */
  sales: SaleRow[];

  /**
   * Colonne actuellement utilisée pour le tri (ex: "paid_at").
   */
  activeSortKey: string;

  /**
   * Sens de tri actuel.
   */
  sortDir: SalesTableSortDir;

  /**
   * Fonction utilitaire fournie par la page pour construire les URLs
   * de tri. On garde la logique des query params dans la page.
   */
  makeSortHref: (columnKey: string) => string;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function SalesTable({
  sales,
  activeSortKey,
  sortDir,
  makeSortHref,
}: SalesTableProps) {
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
              {renderSortableHeader("ID", "id", "left")}
              {renderSortableHeader("Date paiement", "paid_at", "left")}
              {renderSortableHeader("Type", "sale_type", "left")}
              {renderSortableHeader("Canal", "sales_channel", "left")}
              {renderSortableHeader(
                "Net vendeur",
                "net_seller_amount",
                "right"
              )}
              {renderSortableHeader(
                "Marge",
                "total_margin_amount",
                "right"
              )}
              {renderSortableHeader("Statut", "status", "center")}
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {sales.length === 0 ? (
              <tr className="border-t border-border">
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Aucune vente enregistrée pour le moment.
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const netAmount = Number(sale.net_seller_amount ?? 0);
                const marginAmount = Number(sale.total_margin_amount ?? 0);

                const isCancelled = sale.status === "CANCELLED";

                return (
                  <tr key={sale.id} className="app-table-row">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/ventes/${sale.id}`}
                        className="underline-offset-2 hover:underline text-slate-900"
                      >
                        #{sale.id}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      {formatDate(sale.paid_at)}
                    </td>

                    <td className="px-4 py-3">
                      {sale.sale_type === "SET" ? "Set" : "Pièces"}
                    </td>

                    <td className="px-4 py-3">{sale.sales_channel}</td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(netAmount)}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {euro.format(marginAmount)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-[11px] font-medium",
                          isCancelled
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {isCancelled ? "Annulée" : "Confirmée"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/ventes/${sale.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Voir le détail
                      </Link>
                    </td>
                  </tr>
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