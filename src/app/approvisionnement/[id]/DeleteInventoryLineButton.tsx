"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { deleteInventoryLine } from "../action";

type Props = {
  lotId: number;
  lineId: number;
};

export function DeleteInventoryLineButton({ lotId, lineId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    const ok = window.confirm(
      "Supprimer définitivement cette ligne de pièce du lot ?"
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteInventoryLine(lotId, lineId);

      if (!result.success) {
        window.alert(
          result.error ||
            "Impossible de supprimer cette ligne pour le moment."
        );
        return;
      }

      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      className="h-7 w-7 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
      aria-label="Supprimer la ligne"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}