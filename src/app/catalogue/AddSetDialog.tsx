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
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type AddSetDialogProps = {
  // Le server action que tu passes depuis page.tsx : createSet
  createSetAction: (formData: FormData) => void | Promise<void>;
  triggerClassName?: string;
};

export function AddSetDialog({ createSetAction, triggerClassName }: AddSetDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 gap-2 px-5 text-sm font-medium", triggerClassName)}
        >
          <Plus className="h-4 w-4" />
          Ajouter un set
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl p-8 sm:p-10">
        <DialogHeader className="mb-6 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Nouveau set
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Ajoute un set au catalogue PlayNovus. Tu pourras ensuite compléter
            sa fiche détaillée.
          </DialogDescription>
        </DialogHeader>

        <form action={createSetAction} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="app-control-label block">
                SetID
              </label>
              <Input
                name="display_ref"
                placeholder="ex : 3666"
                required
                className="h-10 rounded-full"
              />
            </div>

            <div className="space-y-2">
              <label className="app-control-label block">
                Nom du set
              </label>
              <Input
                name="name"
                placeholder="Nom du set"
                required
                className="h-10 rounded-full"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="app-control-label block">
                Version
              </label>
              <Input
                name="version"
                placeholder="Version unique, V1, V2…"
                className="h-10 rounded-full"
              />
            </div>

            <div className="space-y-2">
              <label className="app-control-label block">
                Thème
              </label>
              <Input
                name="theme"
                placeholder="ex : Chevaliers"
                className="h-10 rounded-full"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="app-control-label block">
                Début de production
              </label>
              <Input
                name="year_start"
                type="number"
                placeholder="ex : 1998"
                className="h-10 rounded-full"
              />
            </div>

            <div className="space-y-2">
              <label className="app-control-label block">
                Fin de production
              </label>
              <Input
                name="year_end"
                type="number"
                placeholder="ex : 2010 ou N/A si en cours"
                className="h-10 rounded-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="app-control-label block">
              URL de la photo
            </label>
            <Input
              name="image_url"
              type="url"
              placeholder="https://…"
              className="h-10 rounded-full"
            />
          </div>

          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 px-6 text-sm"
              >
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="submit"
              className="h-10 px-8 text-sm font-medium"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
