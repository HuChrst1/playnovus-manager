"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addPieceToLot } from "../action";

type QuickAddPieceFormProps = {
  lotId: number;
  isDraft: boolean;
};

export function QuickAddPieceForm({ lotId, isDraft }: QuickAddPieceFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!isDraft) {
    // Lot confirmé : pas de formulaire, petit message soft
    return (
      <p className="text-[11px] text-slate-400 italic">
        Lot confirmé – saisie des pièces verrouillée.
      </p>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    const pieceRef = (fd.get("piece_ref") as string | null)?.trim() ?? "";
    const quantityRaw = (fd.get("quantity") as string | null)?.trim() ?? "";

    const quantity = Number(quantityRaw);

    if (!pieceRef) {
      setError("La référence de pièce est obligatoire.");
      return;
    }

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      setError("La quantité doit être un entier strictement positif.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await addPieceToLot(lotId, {
        pieceRef,
        quantity,
      });

      if (!result.success) {
        setError(
          result.error ||
            "Impossible d'ajouter la pièce pour le moment. Merci de réessayer."
        );
        return;
      }

      // Succès : on reset les champs + on rafraîchit la page
      form.reset();
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2"
    >
      <Input
        name="piece_ref"
        placeholder="Réf. pièce"
        className="h-9 w-32 rounded-full text-xs shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
        autoComplete="off"
        disabled={isPending}
      />
      <Input
        name="quantity"
        placeholder="Qté"
        inputMode="numeric"
        className="h-9 w-20 rounded-full text-xs text-right shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
        disabled={isPending}
      />

      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="h-9 rounded-full px-4 text-xs shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
      >
        {isPending ? "Ajout…" : "Ajouter"}
      </Button>

      {error && (
        <p className="ml-2 text-[11px] text-red-500 max-w-[220px]">
          {error}
        </p>
      )}
    </form>
  );
}