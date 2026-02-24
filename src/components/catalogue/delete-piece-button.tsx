"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteSetPiece } from "@/app/actions/update-bom";
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

interface DeletePieceButtonProps {
  id: number;
  setId: string;
  refName: string;
}

export function DeletePieceButton({ id, setId, refName }: DeletePieceButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirmDelete = () => {
    setLocalError(null);
    startTransition(async () => {
      const result = await deleteSetPiece(id, setId);
      if (!result.success) {
        setLocalError(result.error || "Impossible de supprimer cette pièce.");
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
          variant="ghost"
          size="icon"
          disabled={isPending}
          className="app-icon-action"
          aria-label="Supprimer cette pièce"
          title="Supprimer cette pièce"
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
          <AlertDialogTitle>Supprimer la pièce {refName} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action retire définitivement la pièce de la recette du set.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {localError ? <p className="text-sm text-red-600">{localError}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              if (!isPending) {
                handleConfirmDelete();
              }
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              "Supprimer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
