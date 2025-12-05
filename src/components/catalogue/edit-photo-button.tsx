"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-zinc-700 border-zinc-300 hover:bg-zinc-50">
          <ImagePlus className="h-4 w-4" />
          Modifier Photo
        </Button>
      </DialogTrigger>
      
      {/* AJOUT DE z-[100] ICI */}
      <DialogContent className="sm:max-w-md z-[100] bg-white">
        <DialogHeader>
          <DialogTitle>Modifier la photo</DialogTitle>
          <DialogDescription>
            Entrez l&apos;URL de la nouvelle image.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
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
                  <img src={newUrl} alt="Aperçu" className="h-full object-contain" />
              </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
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
      </DialogContent>
    </Dialog>
  );
}