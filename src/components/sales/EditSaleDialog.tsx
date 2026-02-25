"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import type { SaleDraft } from "@/lib/sales-types";
import { getSaleDraftForEditAction } from "@/app/actions/sales";
import { NewSaleForm } from "@/app/ventes/nouvelle/NewSaleForm";

export function EditSaleDialog({ saleId }: { saleId: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<SaleDraft | null>(null);
  const [stockCreditByPieceRef, setStockCreditByPieceRef] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setError(null);
    setDraft(null);
    setStockCreditByPieceRef({});
    setLoading(true);

    (async () => {
      try {
        const res = await getSaleDraftForEditAction(saleId);
        if (cancelled) return;

        if (!res.ok) {
          setError(res.error);
          return;
        }

        setDraft(res.draft);
        setStockCreditByPieceRef(res.stockCreditByPieceRef ?? {});
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur chargement édition.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, saleId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="app-icon-action"
          aria-label="Éditer la vente"
          title="Éditer la vente"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="app-modal-sales app-modal-scroll overflow-x-hidden overscroll-contain">
        <DialogHeader className="app-modal-header">
          <DialogTitle className="app-modal-title">
            Modifier la vente #{saleId}
          </DialogTitle>
          <DialogDescription className="app-modal-description">
            Même formulaire que “Nouvelle vente”, mais sauvegarde sur la même vente (même ID).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading || !draft ? (
          <div className="app-surface-muted px-4 py-3 text-sm text-slate-500">Chargement…</div>
        ) : (
          <NewSaleForm
            mode="edit"
            saleId={saleId}
            initialDraft={draft}
            editStockCreditByPieceRef={stockCreditByPieceRef}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
