"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NewSaleForm } from "@/app/ventes/nouvelle/NewSaleForm";

/**
 * NewSaleDialog
 *
 * Bouton + modale pleine largeur, dans le même style que NewLotDialog.
 * Cette modale encapsule le formulaire NewSaleForm.
 */
type NewSaleDialogProps = {
  openFromIntent?: boolean;
  triggerClassName?: string;
};

export function NewSaleDialog({
  openFromIntent = false,
  triggerClassName,
}: NewSaleDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(openFromIntent);

  useEffect(() => {
    if (!openFromIntent) return;
    setOpen(true);
  }, [openFromIntent]);

  const clearNewIntentFromUrl = useCallback(() => {
    if (searchParams.get("new") !== "1") return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearNewIntentFromUrl();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Bouton dans la barre d’actions */}
      <DialogTrigger asChild>
        <Button className={cn("h-9 gap-2 px-5 text-sm font-medium", triggerClassName)}>
          <Plus className="h-4 w-4" />
          Nouvelle vente
        </Button>
      </DialogTrigger>

      {/* Fenêtre modale */}
      <DialogContent className="max-w-4xl sm:max-w-3xl p-8 sm:p-10">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Nouvelle vente
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enregistrer une vente de set ou de pièces au détail.
          </DialogDescription>
        </DialogHeader>

        {/* Contenu : formulaire de création de vente */}
        <NewSaleForm
          onDone={() => {
            setOpen(false);
            clearNewIntentFromUrl();
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
