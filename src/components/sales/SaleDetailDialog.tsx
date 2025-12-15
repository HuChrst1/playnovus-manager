"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SaleRow, SaleItemRow } from "@/lib/sales-types";
import { updateSaleMetaAction } from "@/app/actions/sales";
import { Pencil } from "lucide-react";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type SaleDetailDialogProps = {
  sale: SaleRow;
  items?: SaleItemRow[];
  trigger?: React.ReactNode;
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
      <button type="button" className="text-xs font-medium text-primary hover:underline">
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
                isCancelled ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
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
            <p className="text-lg font-semibold">{euro.format(totalMargin)}</p>
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

        {/* LIGNES DE VENTE */}
        <section className="app-card mt-4 overflow-hidden">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lignes de vente</h2>
            <p className="text-xs text-muted-foreground">{saleItems.length} ligne(s)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="app-table-head">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Ligne</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Réf. set / pièce</th>
                  <th className="px-3 py-2 text-right font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">Net ligne</th>
                  <th className="px-3 py-2 text-right font-medium">Coût (FIFO)</th>
                  <th className="px-3 py-2 text-right font-medium">Marge</th>
                </tr>
              </thead>

              <tbody>
                {saleItems.length === 0 ? (
                  <tr className="border-t border-border">
                    <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Aucune ligne de vente fournie à ce stade (squelette).
                    </td>
                  </tr>
                ) : (
                  saleItems.map((item) => {
                    const netLine = Number(item.net_amount ?? 0);
                    const costLine = Number(item.cost_amount ?? 0);
                    const marginLine =
                      item.margin_amount !== null && item.margin_amount !== undefined
                        ? Number(item.margin_amount)
                        : netLine - costLine;

                    const labelType = item.item_kind === "SET" ? "Set" : "Pièce";
                    const refValue = item.item_kind === "SET" ? item.set_id ?? "—" : item.piece_ref ?? "—";

                    return (
                      <tr key={item.id} className="app-table-row">
                        <td className="px-3 py-2 font-mono text-[11px]">#{(item.line_index ?? 0) + 1}</td>
                        <td className="px-3 py-2">
                          {labelType}
                          {item.item_kind === "SET" && item.is_partial_set && (
                            <span className="ml-1 text-[10px] rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                              Set partiel
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{refValue}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{netLine > 0 ? euro.format(netLine) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{costLine > 0 ? euro.format(costLine) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{marginLine !== 0 ? euro.format(marginLine) : "—"}</td>
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

export type SaleEditDialogProps = {
  sale: SaleRow;
  trigger?: React.ReactNode;
};

export function SaleEditDialog({ sale, trigger }: SaleEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const toDateInputValue = (v: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const [salesChannel, setSalesChannel] = React.useState<string>(String(sale.sales_channel ?? ""));
  const [paidAt, setPaidAt] = React.useState<string>(toDateInputValue(sale.paid_at));
  const [netSellerAmount, setNetSellerAmount] = React.useState<string>(String(sale.net_seller_amount ?? ""));
  const [buyerPaidTotal, setBuyerPaidTotal] = React.useState<string>(
    sale.buyer_paid_total === null || sale.buyer_paid_total === undefined ? "" : String(sale.buyer_paid_total)
  );
  const [vatRate, setVatRate] = React.useState<string>(
    sale.vat_rate === null || sale.vat_rate === undefined ? "" : String(sale.vat_rate)
  );
  const [saleNumber, setSaleNumber] = React.useState<string>(
    sale.sale_number === null || sale.sale_number === undefined ? "" : String(sale.sale_number)
  );
  const [comment, setComment] = React.useState<string>(sale.comment ?? "");

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSalesChannel(String(sale.sales_channel ?? ""));
    setPaidAt(toDateInputValue(sale.paid_at));
    setNetSellerAmount(String(sale.net_seller_amount ?? ""));
    setBuyerPaidTotal(
      sale.buyer_paid_total === null || sale.buyer_paid_total === undefined ? "" : String(sale.buyer_paid_total)
    );
    setVatRate(sale.vat_rate === null || sale.vat_rate === undefined ? "" : String(sale.vat_rate));
    setSaleNumber(sale.sale_number === null || sale.sale_number === undefined ? "" : String(sale.sale_number));
    setComment(sale.comment ?? "");
  }, [open, sale]);

  const defaultTrigger = (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background/60 text-muted-foreground hover:bg-background"
      aria-label={`Éditer la vente #${sale.id}`}
    >
      <Pencil className="h-4 w-4" />
    </button>
  );

  const onSubmit = () => {
    setError(null);

    startTransition(async () => {
      const net = Number(netSellerAmount);
      if (!Number.isFinite(net) || net < 0) {
        setError("Le net vendeur doit être un nombre positif.");
        return;
      }

      const buyer = buyerPaidTotal.trim() === "" ? null : Number(buyerPaidTotal);
      if (buyer !== null && !Number.isFinite(buyer)) {
        setError("Le total payé par l'acheteur doit être un nombre.");
        return;
      }

      const vat = vatRate.trim() === "" ? null : Number(vatRate);
      if (vat !== null && !Number.isFinite(vat)) {
        setError("Le taux de TVA doit être un nombre.");
        return;
      }

      const payload = {
        sales_channel: salesChannel,
        paid_at: paidAt ? new Date(`${paidAt}T00:00:00.000Z`).toISOString() : undefined,
        net_seller_amount: net,
        buyer_paid_total: buyer,
        vat_rate: vat,
        sale_number: saleNumber.trim() === "" ? null : saleNumber,
        comment: comment.trim() === "" ? null : comment,
      };

      const res = await updateSaleMetaAction(Number(sale.id), payload);
      if (!res?.ok) {
        const msg = res?.errors?.[0]?.message ?? "Impossible de mettre à jour la vente.";
        setError(msg);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle>Modifier la vente #{sale.id}</DialogTitle>
          <DialogDescription>Mets à jour les métadonnées (canal, date, montants, etc.).</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Canal</label>
            <Input value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)} className="h-9" />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Date de paiement</label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-9" />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Net vendeur</label>
            <Input inputMode="decimal" value={netSellerAmount} onChange={(e) => setNetSellerAmount(e.target.value)} className="h-9" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Total payé (optionnel)</label>
              <Input inputMode="decimal" value={buyerPaidTotal} onChange={(e) => setBuyerPaidTotal(e.target.value)} className="h-9" />
            </div>

            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">TVA % (optionnel)</label>
              <Input inputMode="decimal" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Numéro de vente (optionnel)</label>
            <Input value={saleNumber} onChange={(e) => setSaleNumber(e.target.value)} className="h-9" />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Commentaire (optionnel)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[90px] rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button type="button" variant="secondary" onClick={onSubmit} disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
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