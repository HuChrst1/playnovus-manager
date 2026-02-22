"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";

export type SetPiecesRow = {
  piece_ref: string;
  piece_name: string | null;
  bom_qty: number;
  stock_qty: number;
  avg_unit_cost: number | null;
  total_value: number | null;
  missing_qty: number;
};

type Props = {
  open: boolean;
  setId: string | null;
  setQty: number; // quantité de sets vendus sur la ligne
  pieces: SetPiecesRow[] | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;

  initialOverrides?: Record<string, number>;
  onClose: () => void;
  onRefresh: () => void;
  onSave: (overrides: Record<string, number>) => void;
};

export function SetPiecesDialog({
  open,
  setId,
  setQty,
  pieces,
  loading,
  error,
  disabled,
  initialOverrides,
  onClose,
  onRefresh,
  onSave,
}: Props) {
  const [localOverrides, setLocalOverrides] = useState<Record<string, number>>(
    () => initialOverrides ?? {}
  );

  const rows = useMemo(() => {
    const list = pieces ?? [];
    return list.map((p) => {
      const required = Math.max(0, Number(p.bom_qty ?? 0) * Math.max(1, setQty));
      const current =
        typeof localOverrides[p.piece_ref] === "number"
          ? localOverrides[p.piece_ref]
          : required;

      return {
        ...p,
        required_qty: required,
        current_qty: current,
      };
    });
  }, [pieces, localOverrides, setQty]);

  const isPartial = useMemo(() => {
    return rows.some((r) => Number(r.current_qty) < Number(r.required_qty));
  }, [rows]);

  const hasEdits = useMemo(() => {
    // on considère “édité” si on a au moins une entrée dans overrides
    return Object.keys(localOverrides ?? {}).length > 0;
  }, [localOverrides]);

  function setOverride(pieceRef: string, required: number, raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // vide => on revient au théorique (donc on supprime l'override)
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[pieceRef];
        return next;
      });
      return;
    }

    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;

    const clamped = Math.max(0, Math.min(required, Math.floor(n)));

    setLocalOverrides((prev) => {
      // si = théorique => on supprime pour garder un mapping “minimal”
      if (clamped === required) {
        const next = { ...prev };
        delete next[pieceRef];
        return next;
      }
      return { ...prev, [pieceRef]: clamped };
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/28 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />

      <div className="absolute left-1/2 top-10 w-[min(1020px,calc(100%-2rem))] -translate-x-1/2">
        <div className="app-dialog-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-medium tracking-tight text-slate-900">
                Pièces du set
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {setId ? `Set ID : ${setId}` : "Sélectionne d'abord un set."}
                {" · "}
                Qté sets : {Math.max(1, setQty)}
                {isPartial && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                    Set partiel
                  </span>
                )}
              </p>
            </div>

            <Button
              type="button"
              variant="icon"
              size="icon"
              onClick={onClose}
              className="h-9 w-9"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            {setId && (
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {(pieces?.length ?? 0) > 0 ? `${pieces!.length} pièce(s)` : ""}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-4 text-xs"
                    onClick={onRefresh}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement…
                      </span>
                    ) : (
                      "Rafraîchir"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-4 text-xs"
                    onClick={() => setLocalOverrides({})}
                    disabled={disabled || loading}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            {!setId ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-muted-foreground">
                Aucun set sélectionné.
              </div>
            ) : loading && !pieces ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement…
                </span>
              </div>
            ) : (pieces?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-muted-foreground">
                Aucune pièce trouvée pour ce set.
              </div>
            ) : (
              <div className="appro-table-shell p-1.5">
                <div className="appro-table-scroll max-h-[60vh] overflow-auto">
                  <table className="appro-table w-full text-left text-xs">
                    <thead className="appro-table-header sticky top-0 bg-white/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-slate-900">
                          Réf
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-900">
                          Nom
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-900">
                          Théorique
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-900">
                          Quantité vendue
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-900">
                          Stock
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-900">
                          Manquant
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.piece_ref} className="appro-table-row">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {p.piece_ref}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {p.piece_name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {p.required_qty}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              max={p.required_qty}
                              value={String(p.current_qty)}
                              onChange={(e) =>
                                setOverride(
                                  p.piece_ref,
                                  p.required_qty,
                                  e.target.value
                                )
                              }
                              className={cn(
                                "h-9 rounded-full px-3",
                                Number(p.current_qty) < Number(p.required_qty) &&
                                  "ring-1 ring-sky-300"
                              )}
                              disabled={disabled || loading}
                            />
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {Number(p.current_qty) < Number(p.required_qty)
                                ? "Partiel"
                                : "Complet"}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {p.stock_qty}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 font-semibold",
                              p.missing_qty > 0
                                ? "text-rose-700"
                                : "text-emerald-700"
                            )}
                          >
                            {p.missing_qty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-white/75 bg-white/90 px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">
                    Laisse vide (= théorique) ou saisis une quantité pour marquer un
                    set incomplet.
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-4 text-xs"
                      onClick={onClose}
                    >
                      Annuler
                    </Button>

                    <Button
                      type="button"
                      className="h-9 rounded-full px-4 text-xs font-semibold"
                      onClick={() => {
                        // On envoie un mapping COMPLET (quantités finales) uniquement si le set est partiel.
                        // Sinon, on renvoie {} pour dire "set complet" (pas d’overrides).
                        const full: Record<string, number> = {};
                      
                        for (const r of rows) {
                          const ref = String(r.piece_ref ?? "").trim();
                          if (!ref) continue;
                          const q = Math.max(0, Math.floor(Number(r.current_qty ?? 0)));
                          full[ref] = q; // on garde 0 (pièce absente)
                        }
                      
                        onSave(isPartial ? full : {});
                      }}
                      disabled={disabled || loading || !setId}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {setId && hasEdits && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Overrides enregistrés : {Object.keys(localOverrides).length} pièce(s)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
