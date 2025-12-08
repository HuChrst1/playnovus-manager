// src/app/catalogue/AddSetDialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AddSetDialogProps = {
  // Le server action que tu passes depuis page.tsx : createSet
  createSetAction: (formData: FormData) => void | Promise<void>;
};

export function AddSetDialog({ createSetAction }: AddSetDialogProps) {
  return (
    <Dialog>
      {/* Bouton bleu foncé "Ajouter un set" dans le header du catalogue */}
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="lg"
          className="h-10 rounded-full px-5 text-sm font-medium shadow-[0_10px_30px_rgba(15,23,42,0.35)]"
        >
          Ajouter un set
        </Button>
      </DialogTrigger>

      {/* Fenêtre modale : même esprit que "Ajouter une pièce" */}
      <DialogContent className="max-w-4xl rounded-[32px] border border-black/5 bg-white px-8 py-7 sm:px-10 sm:py-8 shadow-[0_24px_70px_rgba(15,23,42,0.25)]">
        <DialogHeader className="mb-4 space-y-1 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Nouveau set
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Ajoute un set au catalogue PlayNovus. Tu pourras ensuite compléter
            sa fiche détaillée.
          </DialogDescription>
        </DialogHeader>

        {/* Formulaire principal */}
        <form action={createSetAction} className="space-y-6">
          {/* Ligne 1 : SetID + Nom */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                SetID
              </label>
              <Input
                name="display_ref"
                placeholder="ex : 3666"
                required
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Nom du set
              </label>
              <Input
                name="name"
                placeholder="Nom du set"
                required
                className="h-10"
              />
            </div>
          </div>

          {/* Ligne 2 : Version + Thème */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Version
              </label>
              <Input
                name="version"
                placeholder="Version unique, V1, V2…"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Thème
              </label>
              <Input
                name="theme"
                placeholder="ex : Chevaliers"
                className="h-10"
              />
            </div>
          </div>

          {/* Ligne 3 : Début / Fin de production */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Début de production
              </label>
              <Input
                name="year_start"
                type="number"
                placeholder="ex : 1998"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Fin de production
              </label>
              <Input
                name="year_end"
                type="number"
                placeholder="ex : 2010 ou N/A si en cours"
                className="h-10"
              />
            </div>
          </div>

          {/* Ligne 4 : URL photo */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              URL de la photo
            </label>
            <Input
              name="image_url"
              type="url"
              placeholder="https://…"
              className="h-10"
            />
          </div>

          {/* Boutons d’action en bas */}
          <DialogFooter className="mt-2 gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-4 text-xs font-medium"
              >
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="submit"
              variant="default"
              className="h-9 rounded-full px-5 text-xs font-medium shadow-[0_10px_30px_rgba(15,23,42,0.4)]"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}