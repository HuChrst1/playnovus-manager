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

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setDraft(null);
    setLoading(true);

    (async () => {
      const res = await getSaleDraftForEditAction(saleId);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setDraft(res.draft);
      setLoading(false);
    })();
  }, [open, saleId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Éditer la vente">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl sm:max-w-3xl rounded-[32px] bg-white p-8 sm:p-10">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Modifier la vente #{saleId}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Même formulaire que “Nouvelle vente”, mais sauvegarde sur la même vente (même ID).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {loading || !draft ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : (
          <NewSaleForm
            mode="edit"
            saleId={saleId}
            initialDraft={draft}
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