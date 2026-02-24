"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Loader2, Trash2 } from "lucide-react";
import { EditInventoryLineDialog } from "./EditInventoryLineDialog";
import { DeleteInventoryLineButton } from "./DeleteInventoryLineButton";
import { deleteInventoryLinesBulk } from "../action";

type InventoryLine = {
  id: number;
  piece_ref: string | null;
  quantity: number;
  location: string | null;
  created_at: string;
};

type InventoryTableFeedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

type Props = {
  lotId: number;
  isDraft: boolean;
  lines: InventoryLine[];
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function LotInventoryLinesTableClient({ lotId, isDraft, lines }: Props) {
  const [feedback, setFeedback] = useState<InventoryTableFeedback | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [isPendingBulk, startBulkTransition] = useTransition();
  const router = useRouter();

  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const availableLineIds = useMemo(() => lines.map((line) => line.id), [lines]);
  const selectedCount = selectedLineIds.length;
  const allSelected = isDraft && lines.length > 0 && selectedCount === lines.length;
  const someSelected = isDraft && selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (!isDraft) {
      setSelectedLineIds([]);
      setBulkDialogOpen(false);
      return;
    }

    const available = new Set(availableLineIds);
    setSelectedLineIds((previous) => previous.filter((lineId) => available.has(lineId)));
  }, [isDraft, availableLineIds]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleLineSelection = (lineId: number) => {
    setSelectedLineIds((previous) => {
      if (previous.includes(lineId)) {
        return previous.filter((id) => id !== lineId);
      }
      return [...previous, lineId];
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLineIds([]);
      return;
    }
    setSelectedLineIds(availableLineIds);
  };

  const handleSingleDeleteCompleted = (
    lineId: number,
    result: { success: boolean; error?: string; warning?: string }
  ) => {
    if (!result.success) {
      setFeedback({
        tone: "error",
        message: result.error || "Impossible de supprimer cette ligne pour le moment.",
      });
      return;
    }

    setSelectedLineIds((previous) => previous.filter((id) => id !== lineId));
    if (result.warning) {
      setFeedback({ tone: "warning", message: result.warning });
    } else {
      setFeedback({ tone: "success", message: "Ligne supprimée." });
    }
    router.refresh();
  };

  const handleConfirmBulkDelete = () => {
    if (selectedLineIds.length === 0) {
      return;
    }

    const idsToDelete = [...selectedLineIds];
    startBulkTransition(async () => {
      const result = await deleteInventoryLinesBulk(lotId, idsToDelete);

      if (!result.success) {
        setFeedback({
          tone: "error",
          message:
            result.error ||
            "Impossible de supprimer la sélection pour le moment.",
        });
        setBulkDialogOpen(false);
        return;
      }

      setSelectedLineIds([]);
      setBulkDialogOpen(false);

      if (result.warning) {
        setFeedback({
          tone: "warning",
          message: result.warning,
        });
      } else {
        const deletedCount = Number(result.deletedCount ?? idsToDelete.length);
        setFeedback({
          tone: "success",
          message:
            deletedCount > 1
              ? `${deletedCount} lignes supprimées.`
              : "Ligne supprimée.",
        });
      }

      router.refresh();
    });
  };

  return (
    <>
      {isDraft ? (
        <div className="mb-3 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
            disabled={selectedCount === 0 || isPendingBulk}
            onClick={() => setBulkDialogOpen(true)}
          >
            {isPendingBulk ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Supprimer la sélection ({selectedCount})
          </Button>
        </div>
      ) : null}

      {feedback ? (
        <p
          className={
            feedback.tone === "error"
              ? "mb-3 text-sm text-red-600"
              : feedback.tone === "warning"
              ? "mb-3 text-sm text-amber-700"
              : "mb-3 text-sm text-emerald-700"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="appro-table-scroll">
        <table className="appro-table min-w-full text-sm">
          <thead className="appro-table-header">
            <tr>
              {isDraft ? (
                <th className="px-4 py-3 text-left font-medium">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={lines.length === 0 || isPendingBulk}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-sky-500"
                    aria-label="Sélectionner toutes les lignes"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 text-left font-medium">Réf. pièce</th>
              <th className="px-4 py-3 text-left font-medium">Quantité</th>
              <th className="px-4 py-3 text-left font-medium">Créé le</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={isDraft ? 5 : 4}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Aucune pièce enregistrée pour ce lot pour le moment.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id} className="appro-table-row transition-colors">
                  {isDraft ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLineIds.includes(line.id)}
                        onChange={() => toggleLineSelection(line.id)}
                        disabled={isPendingBulk}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-sky-500"
                        aria-label={`Sélectionner la ligne ${line.piece_ref || line.id}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-mono text-xs">
                    {line.piece_ref || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{line.quantity}</td>
                  <td className="px-4 py-3">{formatDateTime(line.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <EditInventoryLineDialog
                        lotId={lotId}
                        lineId={line.id}
                        initialPieceRef={line.piece_ref}
                        initialQuantity={line.quantity}
                      />
                      {isDraft ? (
                        <DeleteInventoryLineButton
                          lotId={lotId}
                          lineId={line.id}
                          disabled={isPendingBulk}
                          onCompleted={(result) =>
                            handleSingleDeleteCompleted(line.id, result)
                          }
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {selectedCount > 1 ? "ces lignes" : "cette ligne"} de
              pièce ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible et supprimera la sélection en une
              seule opération.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPendingBulk}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (!isPendingBulk) {
                  handleConfirmBulkDelete();
                }
              }}
              disabled={isPendingBulk || selectedCount === 0}
            >
              {isPendingBulk ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer la sélection"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
