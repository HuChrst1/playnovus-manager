"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { updateSetImage } from "@/app/actions/update-set";

interface EditPhotoButtonProps {
  setId: string;
  currentUrl: string | null;
}

export function EditPhotoButton({ setId, currentUrl }: EditPhotoButtonProps) {
  const [open, setOpen] = useState(false);
  const [newUrl, setNewUrl] = useState(currentUrl || "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateSetImage(setId, newUrl);
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
          className="gap-2"
        >
          <ImagePlus className="h-4 w-4" />
          Modifier Photo
        </Button>
      </DialogPrimitive.Trigger>

      {/* Portal + Overlay + Content */}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="app-dialog-overlay z-40" />
        <DialogPrimitive.Content className="app-dialog-surface fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-6 px-7 py-6 focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle>Modifier la photo</DialogTitle>
            <DialogDescription>
              Entrez l&apos;URL de la nouvelle image.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="url">URL de l&apos;image</Label>
              <Input
                id="url"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>

            {newUrl && (
              <div className="aspect-video w-full rounded-xl border border-border bg-slate-50 flex items-center justify-center overflow-hidden p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newUrl}
                  alt="Aperçu"
                  className="h-full object-contain"
                />
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-5 text-sm font-medium"
              >
                Annuler
              </Button>
            </DialogClose>

              <Button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="h-9 px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
              {isPending ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
