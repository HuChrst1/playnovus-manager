"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type DeleteSetButtonProps = {
  setId: string;
  setName?: string | null;
  // Server Action qui sera fournie depuis page.tsx
  deleteSetAction: (formData: FormData) => void;
};

export function DeleteSetButton({
  setId,
  setName,
  deleteSetAction,
}: DeleteSetButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const label = setName || setId;
    const ok = window.confirm(
      `Supprimer le set "${label}" ?\nCette action est irréversible.`
    );

    if (!ok) {
      // On annule la soumission du formulaire => pas d’appel à la Server Action
      e.preventDefault();
    }
  };

  return (
    <form action={deleteSetAction} className="inline-block">
      {/* id du set à supprimer, lu par la Server Action */}
      <input type="hidden" name="id" value={setId} />

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={handleClick}
        data-row-action="true" // évite de déclencher le clic sur la ligne
        aria-label="Supprimer le set"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}
