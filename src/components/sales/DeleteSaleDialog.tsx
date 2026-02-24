"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { deleteSaleAction } from "@/app/actions/sales";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteSaleDialog({
  saleId,
  trigger,
}: {
  saleId: number;
  trigger: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const router = useRouter();

  const handleConfirmDelete = () => {
    setLocalError(null);
    startTransition(async () => {
      const result = await deleteSaleAction(Number(saleId));

      if (!result?.success) {
        console.error("Erreur suppression vente:", result?.error);
        setLocalError(
          "Impossible de supprimer cette vente pour le moment.\n\n" +
            (result?.error || "")
        );
        return;
      }

      setOpen(false);
      router.refresh();
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
    const triggerElement = React.cloneElement(el, {
      disabled: isPending || el.props?.disabled,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      },
      onMouseDown: (e: React.MouseEvent) => {
        e.stopPropagation();
        el.props?.onMouseDown?.(e);
      },
    });

    return (
      <>
        {triggerElement}
        <AlertDialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setLocalError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer définitivement la vente #{saleId} ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Elle supprime définitivement la vente
                et ses mouvements associés (SALE / SALE_CANCEL / SALE_EDIT).
              </AlertDialogDescription>
            </AlertDialogHeader>

            {localError ? (
              <p className="whitespace-pre-line text-sm text-red-600">{localError}</p>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault();
                  if (!isPending) {
                    handleConfirmDelete();
                  }
                }}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  "Supprimer la vente"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Fallback si trigger n’est pas un élément React clonable
  return (
    <>
      <span
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isPending) {
            setOpen(true);
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {trigger}
      </span>
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setLocalError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer définitivement la vente #{saleId} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Elle supprime définitivement la vente
              et ses mouvements associés (SALE / SALE_CANCEL / SALE_EDIT).
            </AlertDialogDescription>
          </AlertDialogHeader>

          {localError ? (
            <p className="whitespace-pre-line text-sm text-red-600">{localError}</p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (!isPending) {
                  handleConfirmDelete();
                }
              }}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer la vente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
