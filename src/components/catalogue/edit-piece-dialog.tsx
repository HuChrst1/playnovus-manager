"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  line_comment?: string | null;
}

interface EditPieceDialogProps {
  setId: string;
  piece?: PieceData;
  triggerClassName?: string;
}

export function EditPieceDialog({ setId, piece, triggerClassName }: EditPieceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!piece;

  const [formData, setFormData] = useState({
    ref: piece?.piece_ref || "",
    name: piece?.piece_name || "",
    qty: piece?.quantity?.toString() || "1",
    comment: piece?.line_comment || "",
  });

  const handleSave = () => {
    if (!formData.ref || !formData.qty) {
      setFormError("Merci de remplir la référence et la quantité.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      try {
        let result;

        if (isEditing && piece?.id) {
          result = await updateSetPiece(piece.id, setId, {
            quantity: parseInt(formData.qty, 10),
            piece_name: formData.name,
            line_comment: formData.comment,
          });
        } else {
          result = await addSetPiece(
            setId,
            formData.ref,
            formData.name,
            parseInt(formData.qty, 10),
            formData.comment
          );
        }

        if (result.success) {
          setOpen(false);
          setFormError(null);
          window.location.reload();
        } else {
          setFormError(`Erreur : ${result.error}`);
        }
      } catch {
        setFormError("Une erreur est survenue");
      }
    });
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setFormError(null);
        }
      }}
    >
      <DialogPrimitive.Trigger asChild>
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="app-icon-action"
            aria-label="Éditer la pièce"
            title="Éditer la pièce"
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
        <DialogPrimitive.Content className="app-dialog-surface app-modal-standard fixed left-1/2 top-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 focus-visible:outline-none">
          <DialogHeader className="app-modal-header">
            <DialogTitle className="app-modal-title">
              {isEditing ? "Modifier la pièce" : "Ajouter une pièce"}
            </DialogTitle>
            <DialogDescription className="app-modal-description">
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

            <div className="grid gap-1.5">
              <Label htmlFor="piece-line-comment" className="app-control-label">
                Commentaire
              </Label>
              <Textarea
                id="piece-line-comment"
                value={formData.comment}
                maxLength={240}
                rows={3}
                onChange={(event) =>
                  setFormData({ ...formData, comment: event.target.value })
                }
                className="min-h-20 resize-y text-sm"
              />
            </div>
          </div>

          {formError ? (
            <p className="rounded-2xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="app-modal-footer">
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
