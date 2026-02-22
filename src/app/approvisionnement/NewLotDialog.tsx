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
import { Loader2, Plus } from "lucide-react";
import { createLotFromDialog } from "./action";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Une erreur inattendue est survenue lors de l'enregistrement.";
};

export function NewLotDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    const purchaseDate = (fd.get("purchase_date") as string) ?? "";
    const label = (fd.get("label") as string) ?? "";
    const supplier = (fd.get("supplier") as string) ?? "";
    const totalCostRaw = (fd.get("total_cost") as string) ?? "";
    const notes = (fd.get("notes") as string) ?? "";

    const totalCost = Number(totalCostRaw.toString().replace(",", "."));

    setError(null);

    startTransition(async () => {
      try {
        const result = await createLotFromDialog({
          purchaseDate,
          label: label || undefined,
          supplier: supplier || undefined,
          totalCost,
          notes: notes || undefined,
        });

        if (!result.success) {
          setError(
            result.error ||
              "Impossible d'enregistrer le lot. Merci de réessayer."
          );
          return;
        }

        // Succès : on reset le formulaire et on ferme la modale
        form.reset();
        setOpen(false);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Bouton dans la barre d’actions */}
      <DialogTrigger asChild>
        <Button className="h-9 px-5 text-sm font-medium gap-2">
          <Plus className="h-4 w-4" />
          Nouveau lot
        </Button>
      </DialogTrigger>

      {/* Fenêtre modale */}
      <DialogContent className="max-w-3xl p-8 sm:p-10">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Nouveau lot
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Crée un lot d&apos;approvisionnement. Tu pourras ensuite
            renseigner le détail des pièces pour ce lot.
            Le LotID est attribué automatiquement.
            Le lot est créé en brouillon. Tu pourras le confirmer après
            avoir renseigné les pièces.
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
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Libellé</Label>
              <Input
                id="label"
                name="label"
                placeholder="ex : Stock initial, Brocante du 12/09…"
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Fournisseur</Label>
              <Input
                id="supplier"
                name="supplier"
                placeholder="ex : Vendeur Vinted, Brocante…"
                className="rounded-full"
              />
            </div>
          </div>

          {/* Ligne 2 : coût total */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_cost">Coût total du lot (€)</Label>
              <Input
                id="total_cost"
                name="total_cost"
                placeholder="ex : 120"
                inputMode="decimal"
                required
                className="rounded-full"
              />
            </div>
          </div>

          {/* Ligne 3 : notes */}
          <div className="grid grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Input
                id="notes"
                name="notes"
                placeholder="ex : Lot 0 = stock initial estimé…"
                className="rounded-full"
              />
            </div>
          </div>

          {error && (
            <p className="mt-1 text-sm text-red-500">
              {error}
            </p>
          )}

          {/* Footer cohérent avec “Ajouter un set” */}
          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="h-10 px-6 text-sm"
              >
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="submit"
              disabled={isPending}
              className="h-10 px-8 text-sm font-medium"
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
