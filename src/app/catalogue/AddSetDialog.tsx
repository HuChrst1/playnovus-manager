"use client";

import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 👇 On reçoit la Server Action en prop
type AddSetDialogProps = {
  createSetAction: (formData: FormData) => void;
};

export function AddSetDialog({ createSetAction }: AddSetDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" type="button">
          Ajouter un set
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau set</DialogTitle>
          <DialogDescription>
            Ajoute un set au catalogue PlayNovus. Tu pourras ensuite compléter sa fiche détaillée.
          </DialogDescription>
        </DialogHeader>

        {/* 👇 Ici on branche la Server Action */}
        <form action={createSetAction} className="space-y-4">
          {/* Ligne 1 : SetID + Nom */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1 space-y-1.5">
              <Label htmlFor="display_ref">SetID</Label>
              <Input
                id="display_ref"
                name="display_ref"
                placeholder="ex : 3666"
                required
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">Nom du set</Label>
              <Input
                id="name"
                name="name"
                placeholder="Nom du set"
                required
              />
            </div>
          </div>

          {/* Ligne 2 : Version + Thème */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                name="version"
                placeholder="Version unique, V1, V2..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="theme">Thème</Label>
              <Input
                id="theme"
                name="theme"
                placeholder="ex : Chevaliers"
              />
            </div>
          </div>

          {/* Ligne 3 : Début / fin de production */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="year_start">Début de production</Label>
              <Input
                id="year_start"
                name="year_start"
                type="number"
                min={1974}
                max={2100}
                placeholder="ex : 1998"
              />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="year_end">Fin de production</Label>
                <Input
                    id="year_end"
                    name="year_end"
                    type="text"
                    placeholder="ex : 2010 ou N/A si en cours"
                />
           </div>
          </div>

          {/* Ligne 4 : URL image */}
          <div className="space-y-1.5">
            <Label htmlFor="image_url">URL de la photo</Label>
            <Input
              id="image_url"
              name="image_url"
              placeholder="https://..."
            />
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Annuler
              </Button>
            </DialogClose>

            {/* Submit -> Server Action -> redirection */}
            <Button type="submit" size="sm">
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
