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
import { Loader2, Pencil } from "lucide-react";
import { updateLotFromDialog } from "./action";

type LotStatus = "draft" | "confirmed";

export type LotForEdit = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string; // ISO string
  supplier: string | null;
  total_pieces: number | null;
  total_cost: string; // numeric => string côté JS
  status: string;
  notes: string | null;
};

interface EditLotDialogProps {
  lot: LotForEdit;
  /**
   * - "table" : petit bouton discret pour la colonne Actions du tableau
   * - "card"  : petit bouton rond blanc avec ombre, pour l’en-tête de la card
   */
  variant?: "table" | "card";
}

export function EditLotDialog({ lot, variant = "table" }: EditLotDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // l’input date attend YYYY-MM-DD
  const defaultDate = lot.purchase_date
    ? lot.purchase_date.slice(0, 10)
    : "";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    const purchaseDate = (fd.get("purchase_date") as string) ?? "";
    const label = (fd.get("label") as string) ?? "";
    const supplier = (fd.get("supplier") as string) ?? "";
    const lotCode = (fd.get("lot_code") as string) ?? "";
    const totalCostRaw = (fd.get("total_cost") as string) ?? "";
    const totalPiecesRaw = (fd.get("total_pieces") as string) ?? "";
    const notes = (fd.get("notes") as string) ?? "";
    const statusRaw = (fd.get("status") as string) ?? "draft";

    const totalCost = Number(totalCostRaw.toString().replace(",", "."));
    const totalPieces =
      totalPiecesRaw.trim() === "" ? undefined : Number(totalPiecesRaw);
    const status: LotStatus =
      statusRaw === "confirmed" ? "confirmed" : "draft";

    setError(null);

    startTransition(async () => {
      const result = await updateLotFromDialog(lot.id, {
        purchaseDate,
        label: label || undefined,
        supplier: supplier || undefined,
        lotCode: lotCode || undefined,
        totalCost,
        totalPieces,
        status,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError(
          result.error ||
            "Impossible de mettre à jour le lot. Merci de réessayer."
        );
        return;
      }

      // succès -> on ferme la modale
      setOpen(false);
    });
  };

  const triggerButton = (
    <Button
      type="button"
      variant={variant === "card" ? "outline" : "ghost"}
      size="icon"
      className={
        variant === "card"
          ? "h-9 w-9 rounded-full border border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          : "h-8 w-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      }
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Bouton crayon (style dépend du variant) */}
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>

      <DialogContent className="max-w-3xl rounded-[32px] bg-white p-8 sm:p-10 shadow-[0_28px_80px_rgba(15,23,42,0.45)]">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Modifier le lot
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Mets à jour les informations principales de ce lot
            d&apos;approvisionnement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Ligne 1 : date / libellé / fournisseur */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Date du lot</Label>
              <Input
                id="purchase_date"
                name="purchase_date"
                type="date"
                required
                defaultValue={defaultDate}
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Libellé</Label>
              <Input
                id="label"
                name="label"
                defaultValue={lot.label ?? ""}
                placeholder="ex : Stock initial, Brocante du 12/09…"
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Fournisseur</Label>
              <Input
                id="supplier"
                name="supplier"
                defaultValue={lot.supplier ?? ""}
                placeholder="ex : Vendeur Vinted, Brocante…"
                className="rounded-full"
              />
            </div>
          </div>

          {/* Ligne 2 : LotID / coût total / nb pièces */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lot_code">LotID (optionnel)</Label>
              <Input
                id="lot_code"
                name="lot_code"
                defaultValue={lot.lot_code ?? ""}
                placeholder="ex : LOT_0, LOT_1…"
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_cost">Coût total du lot (€)</Label>
              <Input
                id="total_cost"
                name="total_cost"
                defaultValue={lot.total_cost?.toString() ?? ""}
                placeholder="ex : 120"
                inputMode="decimal"
                required
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_pieces">
                Nb de pièces (optionnel)
              </Label>
              <Input
                id="total_pieces"
                name="total_pieces"
                defaultValue={
                  typeof lot.total_pieces === "number"
                    ? lot.total_pieces.toString()
                    : ""
                }
                placeholder="ex : 480"
                inputMode="numeric"
                className="rounded-full"
              />
            </div>
          </div>

          {/* Ligne 3 : statut + notes */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[190px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                name="status"
                defaultValue={
                  lot.status === "confirmed" ? "confirmed" : "draft"
                }
                className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="draft">
                  Brouillon (ne compte pas encore dans le stock)
                </option>
                <option value="confirmed">
                  Confirmé (intégré au stock actuel)
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Input
                id="notes"
                name="notes"
                defaultValue={lot.notes ?? ""}
                placeholder="ex : Lot 0 = stock initial estimé…"
                className="rounded-full"
              />
            </div>
          </div>

          {error && (
            <p className="mt-1 text-sm text-red-500">{error}</p>
          )}

          {/* Footer cohérent avec “Ajouter un set” */}
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