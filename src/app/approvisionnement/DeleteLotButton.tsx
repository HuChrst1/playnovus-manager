"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { deleteLot } from "./action";

type DeleteLotButtonProps = {
  lotId: number;
  /** Libellé affiché dans la boîte de dialogue de confirmation */
  lotLabel?: string;
};

export function DeleteLotButton({ lotId, lotLabel }: DeleteLotButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const label = lotLabel || `lot #${lotId}`;
    const ok = window.confirm(
      `Supprimer définitivement ${label} ?\n\n` +
        "Cette action est irréversible. Les mouvements de stock liés devront être recréés si besoin."
    );

    if (!ok) return;

    startTransition(async () => {
      const result = await deleteLot(lotId);

      if (!result.success) {
        console.error("Erreur suppression lot:", result.error);
        window.alert(
          "Impossible de supprimer ce lot pour le moment.\n\n" +
            (result.error || "")
        );
        return;
      }

      // Succès : on rafraîchit la page pour mettre à jour la liste
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