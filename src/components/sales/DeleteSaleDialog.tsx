"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteSaleAction } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteSaleDialog({
    saleId,
    triggerLabel = "Supprimer",
    trigger,
  }: {
    saleId: number;
    triggerLabel?: string;
    trigger?: React.ReactNode;
  }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteSaleAction(saleId);
      if (!res?.success) {
        setError(res?.error ?? "Erreur inconnue");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
            <Button variant="destructive" size="sm">
            {triggerLabel}
            </Button>
        )}
        </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer la vente ?</DialogTitle>
          <DialogDescription>
            Cette action supprime la vente et ses mouvements associés (SALE / SALE_CANCEL).
            À utiliser pour nettoyer des ventes de test.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}