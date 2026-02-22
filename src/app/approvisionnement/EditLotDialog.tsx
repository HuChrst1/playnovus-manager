"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown, Loader2, Pencil, Plus } from "lucide-react";
import { updateLotFromDialog } from "./action";
import {
  dedupeSupplierOptions,
  isSupplierOptionBlocked,
  supplierOptionKey,
} from "./supplier-options";

type LotStatus = "draft" | "confirmed";
const EMPTY_LOT_CONFIRMATION_ERROR =
  "Impossible de confirmer un lot vide. Ajoute au moins une pièce avant de confirmer.";

export type LotForEdit = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string; // ISO string
  supplier: string | null;
  total_pieces: number | null;
  total_cost: number; // numeric => string côté JS
  status: string;
  notes: string | null;
};

interface EditLotDialogProps {
  lot: LotForEdit;
  supplierOptions?: string[];
  /**
   * - "table" : petit bouton discret pour la colonne Actions du tableau
   * - "card"  : petit bouton rond blanc avec ombre, pour l’en-tête de la card
   */
  variant?: "table" | "card";
}

export function EditLotDialog({
  lot,
  supplierOptions = [],
  variant = "table",
}: EditLotDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const supplierDrawerId = useId();
  const initialSupplierValue = useMemo(() => (lot.supplier ?? "").trim(), [lot.supplier]);
  const initialSupplierOptions = useMemo(
    () => dedupeSupplierOptions(supplierOptions),
    [supplierOptions]
  );
  const [localSupplierOptions, setLocalSupplierOptions] = useState<string[]>(
    initialSupplierOptions
  );
  const [selectedSupplier, setSelectedSupplier] = useState(initialSupplierValue);
  const [isSupplierDrawerOpen, setIsSupplierDrawerOpen] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierLabel, setNewSupplierLabel] = useState("");
  const [supplierError, setSupplierError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;

    setLocalSupplierOptions(initialSupplierOptions);
    setSelectedSupplier(initialSupplierValue);
    setIsSupplierDrawerOpen(false);
    setShowAddSupplier(false);
    setNewSupplierLabel("");
    setSupplierError(null);

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, [open, initialSupplierOptions, initialSupplierValue]);

  // l’input date attend YYYY-MM-DD
  const defaultDate = lot.purchase_date
    ? lot.purchase_date.slice(0, 10)
    : "";

  const closeSupplierDrawer = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setIsSupplierDrawerOpen(false);
    setShowAddSupplier(false);
    setNewSupplierLabel("");
    setSupplierError(null);
  };

  const handleSelectSupplier = (supplier: string) => {
    setSelectedSupplier(supplier);
    closeSupplierDrawer();
  };

  const handleAddSupplier = () => {
    const nextSupplier = newSupplierLabel.trim();
    if (!nextSupplier) {
      setSupplierError("Saisissez un fournisseur.");
      return;
    }

    if (isSupplierOptionBlocked(nextSupplier)) {
      setSupplierError("Ce fournisseur n'est plus disponible.");
      return;
    }

    const nextKey = supplierOptionKey(nextSupplier);
    const alreadyExists = localSupplierOptions.some(
      (supplier) => supplierOptionKey(supplier) === nextKey
    );
    if (alreadyExists) {
      setSupplierError("Ce fournisseur existe déjà.");
      return;
    }

    setLocalSupplierOptions((prev) => [...prev, nextSupplier]);
    setSelectedSupplier(nextSupplier);
    setShowAddSupplier(false);
    setNewSupplierLabel("");
    setSupplierError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    const purchaseDate = (fd.get("purchase_date") as string) ?? "";
    const label = (fd.get("label") as string) ?? "";
    const supplier = (fd.get("supplier") as string) ?? "";
    const lotCode = (fd.get("lot_code") as string) ?? "";
    const totalCostRaw = (fd.get("total_cost") as string) ?? "";
    const notes = (fd.get("notes") as string) ?? "";
    const statusRaw = (fd.get("status") as string) ?? "draft";

    const totalCost = Number(totalCostRaw.toString().replace(",", "."));
    const status: LotStatus = statusRaw === "confirmed" ? "confirmed" : "draft";

    setError(null);

    const currentTotalPieces = Number(lot.total_pieces ?? 0);
    const isConfirmingEmptyDraftLot =
      lot.status === "draft" &&
      status === "confirmed" &&
      (!Number.isFinite(currentTotalPieces) || currentTotalPieces <= 0);

    if (isConfirmingEmptyDraftLot) {
      setError(EMPTY_LOT_CONFIRMATION_ERROR);
      return;
    }

    startTransition(async () => {
      const result = await updateLotFromDialog(lot.id, {
        purchaseDate,
        label: label || undefined,
        supplier: supplier || undefined,
        lotCode: lotCode || undefined,
        totalCost,
        status,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError(
          result.error ||
            "Impossible de mettre à jour le lot. Merci de réessayer."
        );
        return;
      }

      // succès -> on ferme la modale
      setOpen(false);
    });
  };

  const triggerButton = (
    <Button
      type="button"
      variant={variant === "card" ? "outline" : "ghost"}
      size="icon"
      className={
        variant === "card"
          ? "h-9 w-9 rounded-full text-slate-600"
          : "h-8 w-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      }
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Bouton crayon (style dépend du variant) */}
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>

      <DialogContent className="max-w-3xl p-8 sm:p-10">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Modifier le lot
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Mets à jour les informations principales de ce lot
            d&apos;approvisionnement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Ligne 1 : date / libellé / fournisseur */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Date du lot</Label>
              <Input
                id="purchase_date"
                name="purchase_date"
                type="date"
                required
                defaultValue={defaultDate}
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Libellé</Label>
              <Input
                id="label"
                name="label"
                defaultValue={lot.label ?? ""}
                placeholder="ex : Stock initial, Brocante du 12/09…"
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Fournisseur</Label>
              <details
                ref={detailsRef}
                className="group"
                data-row-action="true"
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  setIsSupplierDrawerOpen(isOpen);

                  if (!isOpen) {
                    setShowAddSupplier(false);
                    setNewSupplierLabel("");
                    setSupplierError(null);
                  }
                }}
              >
                <summary
                  id="supplier"
                  aria-expanded={isSupplierDrawerOpen}
                  aria-controls={supplierDrawerId}
                  className="app-control flex cursor-pointer list-none items-center justify-between rounded-full"
                >
                  <span
                    className={
                      selectedSupplier ? "truncate text-slate-700" : "truncate text-slate-400"
                    }
                  >
                    {selectedSupplier || "Sélectionner un fournisseur"}
                  </span>
                  <ChevronDown
                    className={
                      isSupplierDrawerOpen
                        ? "h-4 w-4 rotate-180 text-slate-500 transition-transform"
                        : "h-4 w-4 text-slate-500 transition-transform"
                    }
                  />
                </summary>

                <div
                  id={supplierDrawerId}
                  className="mt-2 rounded-[22px] border border-white/75 bg-white/96 p-2 shadow-[0_14px_32px_rgba(15,23,42,0.1)] backdrop-blur-sm"
                >
                  <div
                    role="listbox"
                    aria-label="Liste des fournisseurs"
                    className="max-h-44 space-y-1 overflow-y-auto pr-1"
                  >
                    {localSupplierOptions.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-slate-500">
                        Aucun fournisseur disponible.
                      </p>
                    ) : (
                      localSupplierOptions.map((supplier) => {
                        const isSelected =
                          supplierOptionKey(selectedSupplier) === supplierOptionKey(supplier);

                        return (
                          <button
                            key={supplier}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectSupplier(supplier)}
                            className={
                              isSelected
                                ? "flex w-full items-center justify-between rounded-full bg-sky-100/80 px-3 py-2 text-left text-xs text-sky-900 transition-colors"
                                : "flex w-full items-center justify-between rounded-full px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100/70"
                            }
                          >
                            <span className="truncate">{supplier}</span>
                            {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-2 border-t border-slate-200/70 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        Ajouter un fournisseur
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0 rounded-full"
                        aria-label="Ajouter un fournisseur"
                        onClick={() => {
                          setShowAddSupplier((prev) => !prev);
                          setSupplierError(null);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {showAddSupplier ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          value={newSupplierLabel}
                          onChange={(event) => setNewSupplierLabel(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAddSupplier();
                            }
                          }}
                          placeholder="Nouveau fournisseur"
                          className="h-8 rounded-full px-3 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 px-3 text-[11px]"
                          onClick={handleAddSupplier}
                        >
                          Ajouter
                        </Button>
                      </div>
                    ) : null}

                    {supplierError ? (
                      <p className="mt-1 text-xs text-rose-600">{supplierError}</p>
                    ) : null}
                  </div>
                </div>
              </details>

              <input type="hidden" name="supplier" value={selectedSupplier} />
            </div>
          </div>

          {/* Ligne 2 : LotID / coût total / nb pièces */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lot_code">LotID (optionnel)</Label>
              <Input
                id="lot_code"
                name="lot_code"
                defaultValue={lot.lot_code ?? ""}
                placeholder="ex : LOT_0, LOT_1…"
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_cost">Coût total du lot (€)</Label>
              <Input
                id="total_cost"
                name="total_cost"
                defaultValue={lot.total_cost?.toString() ?? ""}
                placeholder="ex : 120"
                inputMode="decimal"
                required
                className="rounded-full"
              />
            </div>
          </div>

          {/* Ligne 3 : statut + notes */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[190px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                name="status"
                defaultValue={
                  lot.status === "confirmed" ? "confirmed" : "draft"
                }
                className="app-control app-control--md"
              >
                <option value="draft">
                  Brouillon (ne compte pas encore dans le stock)
                </option>
                <option value="confirmed">
                  Confirmé (intégré au stock actuel)
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Input
                id="notes"
                name="notes"
                defaultValue={lot.notes ?? ""}
                placeholder="ex : Lot 0 = stock initial estimé…"
                className="rounded-full"
              />
            </div>
          </div>

          {error && (
            <p className="mt-1 text-sm text-red-500">{error}</p>
          )}

          {/* Footer cohérent avec “Ajouter un set” */}
          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="h-10 px-6 text-sm"
              >
                Annuler
              </Button>
            </DialogClose>

            <Button
              type="submit"
              disabled={isPending}
              className="h-10 px-8 text-sm font-medium"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
