"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Loader2, Save } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { updateSetInfo } from "@/app/actions/update-set-info";

// Type des données actuelles du set
interface SetData {
  id: string;
  name: string;
  display_ref: string;
  version: string | null;
  year_start: number | null;
  year_end: number | null;
  theme: string | null;
}

export function EditSetDialog({ set }: { set: SetData }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // États du formulaire (pré-remplis avec les infos du set)
  const [formData, setFormData] = useState({
    name: set.name,
    display_ref: set.display_ref,
    version: set.version || "Unique",
    year_start: set.year_start?.toString() || "",
    year_end: set.year_end?.toString() || "",
    theme: set.theme || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateSetInfo(set.id, {
        name: formData.name,
        display_ref: formData.display_ref,
        version: formData.version,
        year_start: formData.year_start
          ? parseInt(formData.year_start)
          : null,
        year_end: formData.year_end ? parseInt(formData.year_end) : null,
        theme: formData.theme,
      });
      setOpen(false);
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* Bouton qui ouvre la modale */}
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        >
          <Edit className="h-4 w-4" /> Modifier Fiche
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 gap-4 border bg-white p-6 shadow-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Modifier la fiche set</DialogTitle>
            <DialogDescription>
              Modifiez les informations principales du set.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Nom du Set */}
            <div className="grid gap-2">
              <Label htmlFor="name">Nom du Set</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Référence */}
              <div className="grid gap-2">
                <Label htmlFor="ref">Référence</Label>
                <Input
                  id="ref"
                  value={formData.display_ref}
                  onChange={(e) =>
                    handleChange("display_ref", e.target.value)
                  }
                />
              </div>
              {/* Version */}
              <div className="grid gap-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) =>
                    handleChange("version", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Année Début */}
              <div className="grid gap-2">
                <Label htmlFor="start">Année Début</Label>
                <Input
                  id="start"
                  type="number"
                  placeholder="1974"
                  value={formData.year_start}
                  onChange={(e) =>
                    handleChange("year_start", e.target.value)
                  }
                />
              </div>
              {/* Année Fin */}
              <div className="grid gap-2">
                <Label htmlFor="end">Année Fin</Label>
                <Input
                  id="end"
                  type="number"
                  placeholder="-"
                  value={formData.year_end}
                  onChange={(e) =>
                    handleChange("year_end", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Thème */}
            <div className="grid gap-2">
              <Label htmlFor="theme">Thème</Label>
              <Input
                id="theme"
                value={formData.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
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
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
