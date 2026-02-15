"use client";

import * as React from "react";
import { useTransition } from "react";

import { deleteSaleAction } from "@/app/actions/sales";

export function DeleteSaleDialog({
  saleId,
  trigger,
}: {
  saleId: number;
  trigger: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const ok = window.confirm(
      `Supprimer définitivement la vente #${saleId} ?\n\n` +
        "Cette action est irréversible. Elle supprime définitivement la vente et ses mouvements associés (SALE / SALE_CANCEL / SALE_EDIT)."
    );

    if (!ok) return;

    startTransition(async () => {
      const result = await deleteSaleAction(Number(saleId));

      if (!result?.success) {
        console.error("Erreur suppression vente:", result?.error);
        window.alert(
          "Impossible de supprimer cette vente pour le moment.\n\n" +
            (result?.error || "")
        );
        return;
      }

      // Identique à Appro : on recharge la page pour que la ligne disparaisse
      window.location.reload();

      // (optionnel) si tu préfères : router.refresh();
      // router.refresh();
    });
  };

  // On injecte onClick sur le trigger (ton bouton poubelle)
  type TriggerElementProps = {
    disabled?: boolean;
    onClick?: (e: React.MouseEvent<Element>) => void;
    onMouseDown?: (e: React.MouseEvent<Element>) => void;
  };

  if (React.isValidElement<TriggerElementProps>(trigger)) {
    const el = trigger;
    return React.cloneElement(el, {
      disabled: isPending || el.props?.disabled,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      },
      onMouseDown: (e: React.MouseEvent) => {
        e.stopPropagation();
        el.props?.onMouseDown?.(e);
      },
    });
  }

  // Fallback si trigger n’est pas un élément React clonable
  return (
    <span
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isPending) handleDelete();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {trigger}
    </span>
  );
}
