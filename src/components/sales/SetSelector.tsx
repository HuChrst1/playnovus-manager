"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, X, Search, Boxes } from "lucide-react";
import { SetPiecesDialog } from "@/components/sales/SetPiecesDialog";
import type { PieceOverridesMap } from "@/lib/sales-types";

export type SaleDraftSetLine = {
  id: string;
  item_kind: "SET";
  set_id: string;
  // libellé UI (ex: "3666 · v2")
  set_label?: string | null;
  quantity: number;
  is_partial_set: boolean;
  net_amount?: number | null;

  // 3.4.4.x (nouveau) : mapping piece_ref -> quantité finale
  overrides?: PieceOverridesMap;

  // compat UI (ancien champ utilisé avant migration) : même format que `overrides`
  piece_overrides?: PieceOverridesMap;
};

export type SetSelectorErrors = Record<
  string,
  { setId?: string; quantity?: string }
>;

type SetSelectorProps = {
  value: SaleDraftSetLine[];
  onChange: (next: SaleDraftSetLine[]) => void;
  disabled?: boolean;
  errors?: SetSelectorErrors;
};

type SetSearchRow = {
  id: string;
  display_ref: string | null;
  version: string | null;
};

type SetPiecesRow = {
  piece_ref: string;
  piece_name: string | null;
  bom_qty: number;
  stock_qty: number;
  avg_unit_cost: number | null;
  total_value: number | null;
  missing_qty: number;
};

type SetPiecesResponse = {
  set_id: string;
  pieces: SetPiecesRow[];
};

type ResultsByLineId = Record<string, SetSearchRow[]>;
type QueryByLineId = Record<string, string>;

const makeLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

// Style cohérent avec Approvisionnement : pas de contour noir,
// mais un “halo” doux pour la profondeur.
const fieldClassName =
  "border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-0";

const errorRing = "ring-1 ring-rose-300";

const inputClassName = (hasError?: boolean) =>
  cn("h-10 rounded-full px-4", fieldClassName, hasError && errorRing);

const parseDecimalFR = (raw: string) => {
    const cleaned = (raw ?? "")
      .toString()
      .trim()
      .replace("€", "")
      .replace(/\s/g, "");
    const normalized = cleaned.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  };

export function SetSelector({
  value,
  onChange,
  disabled,
  errors,
}: SetSelectorProps) {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [queryByLineId, setQueryByLineId] = useState<QueryByLineId>({});
  const [resultsByLineId, setResultsByLineId] = useState<ResultsByLineId>({});
  const [loadingLineId, setLoadingLineId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [piecesDialogLineId, setPiecesDialogLineId] = useState<string | null>(null);
  const [piecesBySetId, setPiecesBySetId] = useState<Record<string, SetPiecesResponse>>({});
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [piecesError, setPiecesError] = useState<string | null>(null);

  const activeQuery = useMemo(() => {
    if (!activeLineId) return "";
    return (queryByLineId[activeLineId] ?? "").trim();
  }, [activeLineId, queryByLineId]);

  const showNetLineAmount = value.length > 1;

  const piecesDialogSetId = useMemo(() => {
    if (!piecesDialogLineId) return null;
    const line = value.find((l) => l.id === piecesDialogLineId);
    const setId = (line?.set_id ?? "").trim();
    return setId.length > 0 ? setId : null;
  }, [piecesDialogLineId, value]);

  const piecesDialogData = useMemo(() => {
    if (!piecesDialogSetId) return null;
    return piecesBySetId[piecesDialogSetId] ?? null;
  }, [piecesBySetId, piecesDialogSetId]);

  async function ensurePiecesLoaded(setId: string, opts?: { force?: boolean }) {
    const force = Boolean(opts?.force);
    if (!force && piecesBySetId[setId]) return;

    setPiecesLoading(true);
    setPiecesError(null);

    try {
      const res = await fetch(`/api/sets/${encodeURIComponent(setId)}/bom-stock`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        // En dev, Next renvoie souvent une page HTML (404/500). On évite d'afficher tout le HTML.
        if (contentType.includes("text/html")) {
          throw new Error(
            `Erreur API (HTTP ${res.status}). Vérifie la route /api/sets/[setId]/bom-stock (src/app/api/sets/[setId]/bom-stock/route.ts) et l'ID du set.`
          );
        }

        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      if (!contentType.includes("application/json")) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Réponse API inattendue (non-JSON). Vérifie la route /api/sets/[setId]/bom-stock. ${txt ? "(" + txt.slice(0, 120) + "…)" : ""}`
        );
      }

      const json = (await res.json()) as SetPiecesResponse;
      setPiecesBySetId((prev) => ({ ...prev, [setId]: json }));
    } catch (e: any) {
      setPiecesError(e?.message ?? "Erreur lors du chargement des pièces.");
    } finally {
      setPiecesLoading(false);
    }
  }

  useEffect(() => {
    if (!activeLineId) return;

    const q = (queryByLineId[activeLineId] ?? "").trim();

    // On n'interroge qu'à partir de 2 caractères
    if (q.length < 2) {
      setResultsByLineId((prev) => ({ ...prev, [activeLineId]: [] }));
      setSearchError(null);
      setLoadingLineId(null);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setLoadingLineId(activeLineId);
        setSearchError(null);

        // Recherche simple par numéro de set (display_ref uniquement)
        const { data, error } = await supabase
          .from("sets_catalog")
          .select("id, display_ref, version")
          .ilike("display_ref", `%${q}%`)
          .limit(8);

        if (error) {
          setSearchError(error.message);
          setResultsByLineId((prev) => ({ ...prev, [activeLineId]: [] }));
          return;
        }

        setResultsByLineId((prev) => ({
          ...prev,
          [activeLineId]: (data ?? []) as SetSearchRow[],
        }));
      } catch (e: any) {
        setSearchError(e?.message ?? "Erreur de recherche.");
        setResultsByLineId((prev) => ({ ...prev, [activeLineId]: [] }));
      } finally {
        setLoadingLineId((cur) => (cur === activeLineId ? null : cur));
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [activeLineId, queryByLineId]);

  useEffect(() => {
    if (!piecesDialogSetId) return;
    void ensurePiecesLoaded(piecesDialogSetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piecesDialogSetId]);

  const addLine = () => {
    onChange([
      ...value,
      {
        id: makeLocalId(),
        item_kind: "SET",
        set_id: "",
        set_label: null,
        quantity: 1,
        is_partial_set: false,
        net_amount: null,
      },
    ]);
  };

  const removeLine = (id: string) => {
    const next = value.filter((l) => l.id !== id);
    onChange(next.length > 0 ? next : value);
  };

  const updateLine = (id: string, patch: Partial<SaleDraftSetLine>) => {
    onChange(value.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const displayedSearchError = useMemo(() => {
    if (!searchError) return null;
    const msg = String(searchError);
    if (msg.toLowerCase().includes("secret api key")) {
      return "Supabase: tu utilises une clé *secrète* côté navigateur. Mets la clé **anon public** dans NEXT_PUBLIC_SUPABASE_ANON_KEY (et garde la service_role uniquement côté serveur).";
    }
    return msg;
  }, [searchError]);

  const computeIsPartialFromOverrides = (
    pieces: SetPiecesRow[],
    setQty: number,
    overrides?: Record<string, number>
  ) => {
    const qty = Math.max(1, Number(setQty || 1));
    const ov = overrides ?? {};
    return pieces.some((p) => {
      const required = Math.max(0, Number(p.bom_qty ?? 0) * qty);
      const current = typeof ov[p.piece_ref] === "number" ? ov[p.piece_ref] : required;
      return Number(current) < Number(required);
    });
  };

  return (
    <div className="rounded-3xl border border-dashed border-border/70 p-4 space-y-4 bg-white/70">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Lignes de set
        </p>

        <Button
          type="button"
          onClick={addLine}
          disabled={disabled}
          className="h-9 rounded-full px-4 bg-slate-900 text-white text-xs font-medium shadow-[0_10px_25px_rgba(15,23,42,0.35)] hover:bg-slate-900/90 gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter un set
        </Button>
      </div>

      <div className="space-y-4">
        {value.map((line) => {
          const lineErr = errors?.[line.id];
          return (
            <div
              key={line.id}
              className="rounded-3xl bg-white/80 p-4 shadow-[0_10px_25px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPiecesDialogLineId(line.id);
                    }}
                    disabled={disabled || !(line.set_label && (line.set_id ?? "").trim())}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium",
                      "bg-white/70 hover:bg-white shadow-[0_10px_25px_rgba(15,23,42,0.10)]",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    aria-label="Détail des pièces"
                  >
                    <Boxes className="h-4 w-4" />
                    Détail des pièces
                  </button>
                  {((line.overrides && Object.keys(line.overrides).length > 0) ||
                    (line.piece_overrides && Object.keys(line.piece_overrides).length > 0)) && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                      Set partiel (détail)
                    </span>
                  )}
                </div>
                {value.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Supprimer la ligne"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div
                className={cn(
                  "mt-3 grid gap-4",
                  showNetLineAmount ? "md:grid-cols-4" : "md:grid-cols-3"
                )}
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Identifiant du set
                  </Label>
                  <div className="relative">
                    <Input
                      value={
                        queryByLineId[line.id] ??
                        line.set_label ??
                        line.set_id ??
                        ""
                      }
                      onFocus={() => setActiveLineId(line.id)}
                      onBlur={() => {
                        // petit délai pour laisser le clic sur une option du dropdown
                        window.setTimeout(() => {
                          setActiveLineId((cur) => (cur === line.id ? null : cur));
                        }, 120);
                      }}
                      onChange={(e) => {
                        const nextQ = e.target.value;
                        setQueryByLineId((prev) => ({ ...prev, [line.id]: nextQ }));

                        // Tant qu'on n'a pas sélectionné dans la liste, on conserve la saisie
                        // dans set_id (utile si l'utilisateur tape directement la réf complète).
                        updateLine(line.id, {
                          set_id: nextQ,
                          set_label: null,
                        });
                      }}
                      placeholder="Ex: 3666"
                      className={cn(
                        inputClassName(Boolean(lineErr?.setId)),
                        "pr-10"
                      )}
                      disabled={disabled}
                    />

                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Search className="h-4 w-4" />
                    </div>

                    {activeLineId === line.id && (
                      (activeQuery.length >= 2) ||
                      (resultsByLineId[line.id]?.length ?? 0) > 0
                    ) && (
                      <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                        <div className="max-h-64 overflow-auto p-1">
                          {loadingLineId === line.id ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              Recherche…
                            </div>
                          ) : (resultsByLineId[line.id]?.length ?? 0) === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              Aucun résultat
                            </div>
                          ) : (
                            resultsByLineId[line.id]!.map((r) => {
                              const ref = r.display_ref ?? r.id;
                              const versionLabel = r.version ? `v${r.version}` : "";
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onMouseDown={(ev) => {
                                    // important : éviter le blur avant la sélection
                                    ev.preventDefault();

                                    updateLine(line.id, {
                                      set_id: r.id,
                                      set_label: `${ref}${versionLabel ? ` · ${versionLabel}` : ""}`,
                                      overrides: undefined,
                                      piece_overrides: undefined,
                                      is_partial_set: false,
                                    });

                                    setQueryByLineId((prev) => ({
                                      ...prev,
                                      [line.id]: `${ref}`,
                                    }));

                                    setActiveLineId(null);
                                  }}
                                  className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-900">
                                      {ref}
                                    </span>
                                    {versionLabel && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {versionLabel}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {displayedSearchError && (
                          <div className="border-t border-slate-100 px-3 py-2 text-xs text-rose-600">
                            {displayedSearchError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {(line.set_label || (line.set_id && (line.set_id ?? "").trim().length > 0)) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Sélectionné : <span className="font-medium text-slate-900">{line.set_label ?? line.set_id}</span>
                    </p>
                  )}

                  {lineErr?.setId && (
                    <p className="text-xs text-rose-600">{lineErr.setId}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Quantité
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={String(line.quantity ?? 1)}
                    onChange={(e) =>
                      updateLine(line.id, {
                        quantity: Math.max(1, Number(e.target.value || 1)),
                      })
                    }
                    className={inputClassName(Boolean(lineErr?.quantity))}
                    disabled={disabled}
                  />
                  {lineErr?.quantity && (
                    <p className="text-xs text-rose-600">
                      {lineErr.quantity}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Set partiel ?
                  </Label>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[#E3ECF8] text-primary focus-visible:outline-none focus-visible:ring-0"
                      checked={Boolean(line.is_partial_set)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const currentOverrides = line.overrides ?? line.piece_overrides;

                        updateLine(line.id, {
                          is_partial_set: checked,
                          overrides: checked ? currentOverrides : undefined,
                          piece_overrides: undefined,
                        });
                      }}
                      disabled={disabled}
                    />
                    <span className="text-xs text-muted-foreground">
                      Le set n&apos;est pas complet
                    </span>
                  </div>
                </div>

                {showNetLineAmount && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Tarif réparti par set (optionnel)
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 12,00"
                      value={
                        typeof line.net_amount === "number" && Number.isFinite(line.net_amount)
                          ? String(line.net_amount).replace(".", ",")
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = parseDecimalFR(raw);
                        updateLine(line.id, {
                          net_amount: Number.isFinite(n) ? n : null,
                        });
                      }}
                      className={inputClassName(false)}
                      disabled={disabled}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {piecesDialogLineId && (
        <SetPiecesDialog
          open={Boolean(piecesDialogLineId)}
          setId={piecesDialogSetId}
          setQty={
            piecesDialogLineId
              ? value.find((l) => l.id === piecesDialogLineId)?.quantity ?? 1
              : 1
          }
          pieces={piecesDialogData?.pieces ?? null}
          loading={piecesLoading}
          error={piecesError}
          disabled={disabled}
          initialOverrides={
            piecesDialogLineId
              ? (value.find((l) => l.id === piecesDialogLineId)?.overrides ??
                  value.find((l) => l.id === piecesDialogLineId)?.piece_overrides)
              : undefined
          }
          onClose={() => {
            setPiecesDialogLineId(null);
            setPiecesError(null);
          }}
          onRefresh={() => {
            if (piecesDialogSetId) void ensurePiecesLoaded(piecesDialogSetId, { force: true });
          }}
          onSave={(overrides) => {
            if (!piecesDialogLineId) return;

            const line = value.find((l) => l.id === piecesDialogLineId);
            const qty = line?.quantity ?? 1;
            const pieces = piecesDialogData?.pieces ?? [];

            const isPartial = computeIsPartialFromOverrides(pieces, qty, overrides);

            updateLine(piecesDialogLineId, {
              overrides,
              piece_overrides: undefined,
              is_partial_set: isPartial,
            });

            setPiecesDialogLineId(null);
            setPiecesError(null);
          }}
        />
      )}
    </div>
  );
}