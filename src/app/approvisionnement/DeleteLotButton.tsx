"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { deleteLot } from "./action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DeleteLotButtonProps = {
  lotId: number;
  /** Libellé affiché dans la boîte de dialogue de confirmation */
  lotLabel?: string;
  /** true si c'est le Lot 0 (stock initial) */
  isInitial?: boolean;
  /** true si le lot est confirmé */
  isConfirmed?: boolean;
};

export function DeleteLotButton({
  lotId,
  lotLabel,
  isInitial,
  isConfirmed,
}: DeleteLotButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();
  const label = lotLabel || `lot #${lotId}`;

  const handleConfirmDelete = () => {
    setLocalError(null);
    startTransition(async () => {
      const result = await deleteLot(lotId);

      if (!result.success) {
        const linkedSalesHint =
          result.reason === "LOT_USED_BY_SALES"
            ? result.linkedSaleIds && result.linkedSaleIds.length > 0
              ? `\n\nVentes liées détectées: #${result.linkedSaleIds.join(", #")}.\nAnnule/supprime d'abord ces ventes.`
              : "\n\nAnnule/supprime d'abord les ventes liées à ce lot."
            : "";
        const lotInitialHint =
          result.reason === "LOT_INITIAL_PROTECTED"
            ? "\n\nLe lot initial LOT_0 est protégé et ne peut pas être supprimé."
            : "";
        setLocalError(
          "Impossible de supprimer ce lot pour le moment.\n\n" +
            (result.error || "") +
            linkedSalesHint +
            lotInitialHint
        );
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setLocalError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          disabled={isPending}
          aria-label="Supprimer le lot"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer définitivement {label} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible.
            {isConfirmed
              ? " Ce lot est confirmé: ses mouvements d'achat seront retirés du stock et de l'historique si la suppression est autorisée."
              : ""}
            {isInitial ? " Note: il s'agit du Lot 0 (stock initial)." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {localError ? (
          <p className="whitespace-pre-line text-sm text-red-600">{localError}</p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              if (!isPending) {
                handleConfirmDelete();
              }
            }}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              "Supprimer le lot"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
