"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { deleteInventoryLine } from "../action";
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

type DeleteInventoryLineResult = Awaited<
  ReturnType<typeof deleteInventoryLine>
>;

type Props = {
  lotId: number;
  lineId: number;
  disabled?: boolean;
  onCompleted?: (result: DeleteInventoryLineResult) => void;
};

export function DeleteInventoryLineButton({
  lotId,
  lineId,
  disabled = false,
  onCompleted,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirmDelete = () => {
    setLocalError(null);
    startTransition(async () => {
      const result = await deleteInventoryLine(lotId, lineId);
      onCompleted?.(result);

      if (!result.success) {
        setLocalError(
          result.error || "Impossible de supprimer cette ligne pour le moment."
        );
        return;
      }

      setOpen(false);
      if (!onCompleted) {
        router.refresh();
      }
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
          disabled={isPending || disabled}
          className="h-7 w-7 rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Supprimer la ligne"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer cette ligne de pièce ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {localError ? (
          <p className="text-sm text-red-600">{localError}</p>
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
              "Supprimer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
