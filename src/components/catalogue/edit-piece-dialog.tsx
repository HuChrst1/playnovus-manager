"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Loader2, Save } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { addSetPiece, updateSetPiece } from "@/app/actions/update-bom";

interface PieceData {
  id?: number;
  piece_ref: string;
  piece_name: string | null;
  quantity: number;
}

interface EditPieceDialogProps {
  setId: string;
  piece?: PieceData;
}

export function EditPieceDialog({ setId, piece }: EditPieceDialogProps) {
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
          alert("Erreur : " + result.error);
        }
      } catch (e) {
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
            className="h-8 w-8 text-zinc-400 hover:text-blue-600 hover:bg-blue-50"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" /> Ajouter Pièce
          </Button>
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-[400px] -translate-x-1/2 -translate-y-1/2 gap-4 border bg-white p-6 shadow-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Modifier la pièce" : "Ajouter une pièce"}
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations ci-dessous.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 grid gap-2">
                <Label>Référence</Label>
                <Input
                  value={formData.ref}
                  onChange={(e) =>
                    setFormData({ ...formData, ref: e.target.value })
                  }
                  disabled={isEditing}
                  className="font-mono bg-zinc-50"
                />
              </div>
              <div className="grid gap-2">
                <Label>Qté Req.</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.qty}
                  onChange={(e) =>
                    setFormData({ ...formData, qty: e.target.value })
                  }
                  className="font-bold text-center"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>

            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
