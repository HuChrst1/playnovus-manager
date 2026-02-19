"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
};

export function NewSaleDialog({ openFromIntent = false }: NewSaleDialogProps) {
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
        <Button className="h-9 rounded-full px-5 bg-slate-900 text-white text-sm font-medium shadow-[0_10px_25px_rgba(15,23,42,0.35)] hover:bg-slate-900/90 gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle vente
        </Button>
      </DialogTrigger>

      {/* Fenêtre modale */}
      <DialogContent className="max-w-4xl sm:max-w-3xl rounded-[32px] bg-white p-8 sm:p-10 shadow-[0_28px_80px_rgba(15,23,42,0.45)]">
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
