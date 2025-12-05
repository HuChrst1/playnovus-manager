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
  id?: number; // Si présent = Modification, sinon = Ajout
  piece_ref: string;
  piece_name: string | null;
  quantity: number;
}

interface EditPieceDialogProps {
  setId: string;
  piece?: PieceData; // Optionnel : si absent, on est en mode "Ajout"
}

export function EditPieceDialog({ setId, piece }: EditPieceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  const isEditing = !!piece;

  // États du formulaire
  const [formData, setFormData] = useState({
    ref: piece?.piece_ref || "",
    name: piece?.piece_name || "",
    qty: piece?.quantity?.toString() || "1",
  });

  const handleSave = () => {
    if (!formData.ref || !formData.qty) return;

    startTransition(async () => {
      if (isEditing && piece?.id) {
        // MODE MODIFICATION
        await updateSetPiece(piece.id, setId, {
            quantity: parseInt(formData.qty),
            piece_name: formData.name
        });
      } else {
        // MODE AJOUT
        await addSetPiece(setId, formData.ref, formData.name, parseInt(formData.qty));
        // Reset pour le prochain ajout
        setFormData({ ref: "", name: "", qty: "1" });
      }
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          // Bouton Crayon (Petit, pour la ligne)
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-blue-600 hover:bg-blue-50">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          // Bouton Ajouter (Gros, pour le header)
          <Button variant="outline" size="sm" className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
            <Plus className="h-4 w-4" /> Ajouter Pièce
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[400px] z-[100] bg-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier la pièce" : "Ajouter une pièce"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Ajustez la quantité ou le nom." : "Entrez la référence et la quantité nécessaire."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="ref">Référence</Label>
              <Input
                id="ref"
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                disabled={isEditing}
                className={isEditing ? "bg-zinc-100 font-mono" : "font-mono"}
                placeholder="30 00 ..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="qty">Qté</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={formData.qty}
                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                className="text-center font-bold"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Description (Nom)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Roue rouge"
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}