"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { updateSetInfo } from "@/app/actions/update-set-info";

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
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-[540px] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-[28px] border border-zinc-200 bg-white px-7 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.45)] focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle>Modifier la fiche set</DialogTitle>
            <DialogDescription>
              Modifiez les informations principales du set.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom du Set</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid gap-2">
              <Label htmlFor="theme">Thème</Label>
              <Input
                id="theme"
                value={formData.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-5 text-sm font-medium shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
              >
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="h-9 rounded-full px-6 text-sm font-semibold bg-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.55)] hover:bg-slate-900/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}