"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
            quantity: parseInt(formData.qty),
            piece_name: formData.name
          });
        } else {
          result = await addSetPiece(setId, formData.ref, formData.name, parseInt(formData.qty));
        }

        if (result.success) {
          setOpen(false);
          // RECHARGEMENT FORCÉ POUR VOIR LE RÉSULTAT
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-blue-600 hover:bg-blue-50">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
            <Plus className="h-4 w-4" /> Ajouter Pièce
          </Button>
        )}
      </DialogTrigger>
      
      {/* Z-Index très élevé pour passer au-dessus de tout */}
      <DialogContent className="sm:max-w-[400px] z-[9999] bg-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier la pièce" : "Ajouter une pièce"}</DialogTitle>
          <DialogDescription>
            Modifiez les informations ci-dessous.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 grid gap-2">
              <Label>Référence</Label>
              <Input
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                className="font-bold text-center"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}