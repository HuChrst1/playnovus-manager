"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteSetPiece } from "@/app/actions/update-bom";

interface DeletePieceButtonProps {
  id: number;
  setId: string;
  refName: string;
}

export function DeletePieceButton({ id, setId, refName }: DeletePieceButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm(`Êtes-vous sûr de vouloir retirer la pièce ${refName} de la recette de ce set ?`)) {
      startTransition(async () => {
        await deleteSetPiece(id, setId);
      });
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleDelete} 
      disabled={isPending}
      className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50"
      title="Supprimer cette pièce"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}