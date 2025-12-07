"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, Save } from "lucide-react";
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
      // ferme la modale quand la sauvegarde est terminée
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
          className="gap-2 text-zinc-700 border-zinc-300 hover:bg-zinc-50"
        >
          <ImagePlus className="h-4 w-4" />
          Modifier Photo
        </Button>
      </DialogPrimitive.Trigger>

      {/* Portal + Overlay + Content */}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border bg-white p-6 shadow-lg sm:rounded-lg">
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
              <div className="aspect-video w-full rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newUrl}
                  alt="Aperçu"
                  className="h-full object-contain"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>

            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
