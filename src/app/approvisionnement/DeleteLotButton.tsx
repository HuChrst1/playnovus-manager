"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { deleteLot } from "./action";

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

  const handleDelete = () => {
    const label = lotLabel || `lot #${lotId}`;
    const confirmedWarning = isConfirmed
      ? "\n\nCe lot est confirmé : ses mouvements d'achat seront retirés du stock et de l'historique si la suppression est autorisée."
      : "";
    const lot0Hint = isInitial
      ? "\n\nNote: il s'agit du Lot 0 (stock initial)."
      : "";

    const ok = window.confirm(
      `Supprimer définitivement ${label} ?\n\n` +
        "Cette action est irréversible." +
        confirmedWarning +
        lot0Hint
    );

    if (!ok) return;

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

        window.alert(
          "Impossible de supprimer ce lot pour le moment.\n\n" +
            (result.error || "") +
            linkedSalesHint +
            lotInitialHint
        );
        return;
      }

      if (result.warning) {
        window.alert(
          "Le lot a été supprimé, mais une action complémentaire a échoué.\n\n" +
            result.warning
        );
      }

      // On recharge simplement la page pour rafraîchir la liste
      window.location.reload();
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Supprimer le lot"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
