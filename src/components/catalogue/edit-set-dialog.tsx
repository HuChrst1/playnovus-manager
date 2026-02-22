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
import { SetImage } from "@/components/catalogue/set-image";

interface SetData {
  id: string;
  name: string;
  display_ref: string;
  image_url: string | null;
  version: string | null;
  year_start: number | null;
  year_end: number | null;
  theme: string | null;
}

type EditSetDialogProps = {
  set: SetData;
  variant?: "default" | "card";
};

export function EditSetDialog({ set, variant = "default" }: EditSetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: set.name,
    display_ref: set.display_ref,
    image_url: set.image_url || "",
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
        year_start: formData.year_start ? parseInt(formData.year_start, 10) : null,
        year_end: formData.year_end ? parseInt(formData.year_end, 10) : null,
        theme: formData.theme,
        image_url: formData.image_url.trim() || null,
      });
      setOpen(false);
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {variant === "card" ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full text-slate-600"
            aria-label="Modifier fiche"
          >
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 px-4 text-xs font-medium"
          >
            <Edit className="h-4 w-4" />
            Modifier fiche
          </Button>
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="app-dialog-overlay z-40" />
        <DialogPrimitive.Content className="app-dialog-surface fixed left-1/2 top-1/2 z-50 grid w-full max-w-[min(680px,92vw)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto px-6 py-5 sm:px-7 sm:py-6 focus-visible:outline-none">
          <DialogHeader className="space-y-1">
            <DialogTitle>Modifier la fiche set</DialogTitle>
            <DialogDescription>
              Modifiez les informations principales du set.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="set-name" className="app-control-label">
                Nom du set
              </Label>
              <Input
                id="set-name"
                value={formData.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className="app-control app-control--md"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="set-ref" className="app-control-label">
                  Référence
                </Label>
                <Input
                  id="set-ref"
                  value={formData.display_ref}
                  onChange={(event) => handleChange("display_ref", event.target.value)}
                  className="app-control app-control--md"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="set-version" className="app-control-label">
                  Version
                </Label>
                <Input
                  id="set-version"
                  value={formData.version}
                  onChange={(event) => handleChange("version", event.target.value)}
                  className="app-control app-control--md"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="set-year-start" className="app-control-label">
                  Année début
                </Label>
                <Input
                  id="set-year-start"
                  type="number"
                  placeholder="1974"
                  value={formData.year_start}
                  onChange={(event) => handleChange("year_start", event.target.value)}
                  className="app-control app-control--md"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="set-year-end" className="app-control-label">
                  Année fin
                </Label>
                <Input
                  id="set-year-end"
                  type="number"
                  placeholder="-"
                  value={formData.year_end}
                  onChange={(event) => handleChange("year_end", event.target.value)}
                  className="app-control app-control--md"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-theme" className="app-control-label">
                Thème
              </Label>
              <Input
                id="set-theme"
                value={formData.theme}
                onChange={(event) => handleChange("theme", event.target.value)}
                className="app-control app-control--md"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-image-url" className="app-control-label">
                Image (URL)
              </Label>
              <Input
                id="set-image-url"
                placeholder="https://..."
                value={formData.image_url}
                onChange={(event) => handleChange("image_url", event.target.value)}
                className="app-control app-control--md"
              />

              <div className="app-surface-muted p-3">
                <SetImage
                  url={formData.image_url.trim() || null}
                  name={formData.name.trim() || set.name}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-1 flex justify-end gap-2">
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
