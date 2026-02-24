"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const label = setName || setId;

  const handleConfirmDelete = () => {
    if (!formRef.current || isSubmitting) return;
    setIsSubmitting(true);
    formRef.current.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action={deleteSetAction}
      className="inline-block"
      onSubmit={() => setIsSubmitting(true)}
    >
      {/* id du set à supprimer, lu par la Server Action */}
      <input type="hidden" name="id" value={setId} />

      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setIsSubmitting(false);
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="app-icon-action"
            data-row-action="true"
            aria-label="Supprimer le set"
            title="Supprimer le set"
            disabled={isSubmitting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le set "{label}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
            >
              Supprimer le set
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
