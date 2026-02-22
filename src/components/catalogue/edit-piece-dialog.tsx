"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { addSetPiece, updateSetPiece } from "@/app/actions/update-bom";
import { cn } from "@/lib/utils";

interface PieceData {
  id?: number;
  piece_ref: string;
  piece_name: string | null;
  quantity: number;
}

interface EditPieceDialogProps {
  setId: string;
  piece?: PieceData;
  triggerClassName?: string;
}

export function EditPieceDialog({ setId, piece, triggerClassName }: EditPieceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEditing = !!piece;

  const [formData, setFormData] = useState({
    ref: piece?.piece_ref || "",
    name: piece?.piece_name || "",
    qty: piece?.quantity?.toString() || "1",
  });

  const handleSave = () => {
    if (!formData.ref || !formData.qty) {
      alert("Merci de remplir la référence et la quantité.");
      return;
    }

    startTransition(async () => {
      try {
        let result;

        if (isEditing && piece?.id) {
          result = await updateSetPiece(piece.id, setId, {
            quantity: parseInt(formData.qty, 10),
            piece_name: formData.name,
          });
        } else {
          result = await addSetPiece(
            setId,
            formData.ref,
            formData.name,
            parseInt(formData.qty, 10)
          );
        }

        if (result.success) {
          setOpen(false);
          window.location.reload();
        } else {
          alert(`Erreur : ${result.error}`);
        }
      } catch {
        alert("Une erreur est survenue");
      }
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Éditer la pièce"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 gap-2 px-4 text-xs font-medium", triggerClassName)}
          >
            <Plus className="h-4 w-4" />
            Ajouter une pièce
          </Button>
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="app-dialog-overlay z-40" />
        <DialogPrimitive.Content className="app-dialog-surface fixed left-1/2 top-1/2 z-50 grid w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 gap-6 px-7 py-6 focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier la pièce" : "Ajouter une pièce"}</DialogTitle>
            <DialogDescription>
              Modifiez les informations ci-dessous.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
              <div className="grid gap-1.5">
                <Label htmlFor="piece-ref" className="app-control-label">
                  Référence
                </Label>
                <Input
                  id="piece-ref"
                  value={formData.ref}
                  onChange={(event) =>
                    setFormData({ ...formData, ref: event.target.value })
                  }
                  disabled={isEditing}
                  className="app-control app-control--md font-mono disabled:bg-slate-100"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="piece-qty" className="app-control-label">
                  Qté req.
                </Label>
                <Input
                  id="piece-qty"
                  type="number"
                  min="0"
                  value={formData.qty}
                  onChange={(event) =>
                    setFormData({ ...formData, qty: event.target.value })
                  }
                  className="app-control app-control--md text-center font-semibold"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="piece-name" className="app-control-label">
                Description
              </Label>
              <Input
                id="piece-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                className="app-control app-control--md"
              />
            </div>
          </div>

          <DialogFooter className="mt-2 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-9 px-4 text-xs font-medium">
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="h-9 px-5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
