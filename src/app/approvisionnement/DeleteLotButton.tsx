"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
    // Protection : on ne supprime pas le Lot 0 une fois confirmé
    if (isInitial && isConfirmed) {
      window.alert(
        "Ce lot est le Lot 0 (stock initial) confirmé. Tu ne peux pas le supprimer."
      );
      return;
    }

    const label = lotLabel || `lot #${lotId}`;
    const ok = window.confirm(
      `Supprimer définitivement ${label} ?\n\n` +
        "Cette action est irréversible. Les mouvements de stock liés devront être recréés si besoin."
    );

    if (!ok) return;

    startTransition(async () => {
      const { error } = await supabase
        .from("lots")
        .delete()
        .eq("id", lotId);

      if (error) {
        console.error("Erreur suppression lot:", error);
        window.alert(
          "Impossible de supprimer ce lot pour le moment.\n\n" +
            (error.message || "")
        );
        return;
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