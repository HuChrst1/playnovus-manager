"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Loader2 } from "lucide-react";
import { updateInventoryLine } from "../action";
import { useRouter } from "next/navigation";

type Props = {
  lotId: number;
  lineId: number;
  initialPieceRef: string | null;
  initialQuantity: number;
};

export function EditInventoryLineDialog({
  lotId,
  lineId,
  initialPieceRef,
  initialQuantity,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pieceRef, setPieceRef] = useState(initialPieceRef ?? "");
  const [quantity, setQuantity] = useState<string>(
    initialQuantity.toString()
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedRef = pieceRef.trim();
    const qtyNumber = Number(quantity);

    if (!trimmedRef) {
      setError("La référence de pièce est obligatoire.");
      return;
    }

    if (
      !Number.isFinite(qtyNumber) ||
      !Number.isInteger(qtyNumber) ||
      qtyNumber <= 0
    ) {
      setError("La quantité doit être un entier strictement positif.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await updateInventoryLine(lotId, lineId, {
        pieceRef: trimmedRef,
        quantity: qtyNumber,
      });

      if (!result.success) {
        setError(
          result.error ||
            "Impossible de mettre à jour cette ligne pour le moment."
        );
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  const pieceRefId = `piece_ref-${lineId}`;
  const quantityId = `quantity-${lineId}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Petit bouton crayon “inline” dans la table */}
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-[32px] bg-white p-8 sm:p-10 shadow-[0_28px_80px_rgba(15,23,42,0.45)]">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Modifier la pièce du lot
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Mets à jour la référence et la quantité pour cette ligne
            d&apos;inventaire.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Réf. pièce */}
            <div className="space-y-2">
              <Label htmlFor={pieceRefId}>Réf. pièce</Label>
              <Input
                id={pieceRefId}
                value={pieceRef}
                onChange={(e) => setPieceRef(e.target.value)}
                placeholder="ex : 30000000"
                className="rounded-full"
                autoFocus
              />
            </div>

            {/* Quantité */}
            <div className="space-y-2">
              <Label htmlFor={quantityId}>Quantité</Label>
              <Input
                id={quantityId}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                type="number"
                min={1}
                inputMode="numeric"
                className="rounded-full"
              />
            </div>
          </div>

          {error && (
            <p className="mt-1 text-sm text-red-500">
              {error}
            </p>
          )}

          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="h-10 rounded-full px-6 bg-white border-slate-200 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
              >
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="submit"
              disabled={isPending}
              className="h-10 rounded-full px-8 bg-slate-900 text-white text-sm font-medium shadow-[0_12px_26px_rgba(15,23,42,0.45)] hover:bg-slate-900/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}