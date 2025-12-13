"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SaleRow, SaleItemRow } from "@/lib/sales-types";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type SaleDetailDialogProps = {
  /**
   * Vente à afficher dans le détail.
   */
  sale: SaleRow;

  /**
   * Lignes de vente associées (optionnel pour le squelette).
   * On pourra plus tard appeler une API / server action pour les charger.
   */
  items?: SaleItemRow[];

  /**
   * Contenu personnalisé pour le déclencheur.
   * Si non fourni, on utilise un bouton texte "Voir le détail".
   */
  trigger?: React.ReactNode;

  /**
   * Optionnel : taille / variante du bouton par défaut.
   */
  triggerVariant?: "link" | "button";
};

export function SaleDetailDialog({
  sale,
  items,
  trigger,
  triggerVariant = "link",
}: SaleDetailDialogProps) {
  const isCancelled = sale.status === "CANCELLED";

  const net = Number(sale.net_seller_amount ?? 0);
  const totalCost = Number(sale.total_cost_amount ?? 0);
  const totalMargin = Number(sale.total_margin_amount ?? 0);
  const marginRate =
    sale.margin_rate !== null && sale.margin_rate !== undefined
      ? sale.margin_rate
      : net > 0
      ? totalMargin / net
      : null;

  const saleItems = items ?? [];

  const defaultTrigger =
    triggerVariant === "button" ? (
      <button
        type="button"
        className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Voir le détail
      </button>
    ) : (
      <button
        type="button"
        className="text-xs font-medium text-primary hover:underline"
      >
        Voir le détail
      </button>
    );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>
              Vente #{sale.id}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {sale.sale_type === "SET" ? "Set(s)" : "Pièce(s) au détail"}
              </span>
            </span>

            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
                isCancelled
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              {isCancelled ? "Annulée" : "Confirmée"}
            </span>
          </DialogTitle>

          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>Canal : {sale.sales_channel}</span>
            <span className="text-slate-300">•</span>
            <span>Date paiement : {formatDate(sale.paid_at)}</span>
            {sale.currency && (
              <>
                <span className="text-slate-300">•</span>
                <span>Devise : {sale.currency}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* STATS VENTE */}
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mt-2">
          <div className="app-card p-3 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Net vendeur
            </p>
            <p className="text-lg font-semibold">{euro.format(net)}</p>
          </div>

          <div className="app-card p-3 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Coût total (FIFO)
            </p>
            <p className="text-lg font-semibold">{euro.format(totalCost)}</p>
          </div>

          <div className="app-card p-3 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Marge totale
            </p>
            <p className="text-lg font-semibold">
              {euro.format(totalMargin)}
            </p>
          </div>

          <div className="app-card p-3 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Taux de marge
            </p>
            <p className="text-lg font-semibold">
              {marginRate !== null ? `${(marginRate * 100).toFixed(1)}%` : "—"}
            </p>
          </div>
        </section>

        {/* COMMENTAIRE GLOBAL */}
        {sale.comment && (
          <section className="mt-3 app-card p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Commentaire
            </p>
            <p className="text-xs whitespace-pre-line">{sale.comment}</p>
          </section>
        )}

        {/* LIGNES DE VENTE (SQUELETTE) */}
        <section className="app-card mt-4 overflow-hidden">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lignes de vente</h2>
            <p className="text-xs text-muted-foreground">
              {saleItems.length} ligne(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="app-table-head">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Ligne</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Réf. set / pièce
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Net ligne
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Coût (FIFO)
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Marge</th>
                </tr>
              </thead>
              <tbody>
                {saleItems.length === 0 ? (
                  <tr className="border-t border-border">
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-xs text-muted-foreground"
                    >
                      Aucune ligne de vente fournie à ce stade (squelette).
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
                        <td className="px-3 py-2 font-mono text-[11px]">
                          #{item.line_index + 1}
                        </td>
                        <td className="px-3 py-2">
                          {labelType}
                          {item.item_kind === "SET" &&
                            item.is_partial_set && (
                              <span className="ml-1 text-[10px] rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                Set partiel
                              </span>
                            )}
                        </td>
                        <td className="px-3 py-2">{refValue}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {netLine > 0 ? euro.format(netLine) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {costLine > 0 ? euro.format(costLine) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {marginLine !== 0 ? euro.format(marginLine) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}