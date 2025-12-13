"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, X, Search } from "lucide-react";

export type SaleDraftPieceLine = {
  id: string;
  item_kind: "PIECE";
  piece_ref: string;
  // libellé UI optionnel
  piece_name?: string | null;
  available_qty?: number | null;
  quantity: number;
  net_amount?: number | null;
  comment?: string | null;
};

export type PieceSelectorErrors = Record<
  string,
  { pieceRef?: string; quantity?: string; netAmount?: string }
>;

type PieceSelectorProps = {
  value: SaleDraftPieceLine[];
  onChange: (next: SaleDraftPieceLine[]) => void;
  disabled?: boolean;
  errors?: PieceSelectorErrors;
};

type StockPerPieceRow = {
    piece_ref: string;
    total_quantity: number | null;
    avg_unit_cost: number | null;
    total_value?: number | null; // optionnel si tu veux l’afficher plus tard
  };

const makeLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const fieldClassName =
  "border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-0";

const inputClassName = (hasError?: boolean) =>
  cn(
    "h-10 rounded-full px-4",
    fieldClassName,
    hasError && "ring-1 ring-rose-300"
  );

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

export function PieceSelector({ value, onChange, disabled, errors }: PieceSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockPerPieceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const showNetLineAmount = true;

  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setLoading(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoading(true);
      setSearchError(null);

      try {
        // ⚠️ Table/vue attendue : stock_per_piece
        // Colonnes attendues : piece_ref, piece_name, stock_qty, avg_unit_cost
        const { data, error } = await supabase
            .from("stock_per_piece")
            .select("piece_ref, total_quantity, avg_unit_cost, total_value")
            .gt("total_quantity", 0)
            .ilike("piece_ref", `%${q}%`)
            .order("piece_ref", { ascending: true })
            .limit(12);

        if (error) {
          setResults([]);
          setSearchError(error.message);
          return;
        }

        setResults((data ?? []) as StockPerPieceRow[]);
      } catch (e: any) {
        setResults([]);
        setSearchError(e?.message ?? "Erreur de recherche.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query]);

  const addOrIncrement = (row: StockPerPieceRow) => {
    const ref = (row.piece_ref ?? "").trim();
    if (!ref) return;

    const existing = value.find((l) => l.piece_ref === ref);
    if (existing) {
        const nextWanted = Number(existing.quantity ?? 1) + 1;
        const nextQty = clampQty(nextWanted, existing.available_qty);
      
        onChange(
          value.map((l) =>
            l.id === existing.id ? { ...l, quantity: nextQty } : l
          )
        );
        return;
      }

    onChange([
      ...value,
      {
        id: makeLocalId(),
        item_kind: "PIECE",
        piece_ref: ref,
        piece_name: null, // on n'a pas le nom dans stock_per_piece
        available_qty: Number(row.total_quantity ?? 0),
        quantity: 1,
        net_amount: null,
        comment: null,
      },
    ]);
  };

  const removeLine = (id: string) => {
    onChange(value.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, patch: Partial<SaleDraftPieceLine>) => {
    onChange(value.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const displayedSearchError = useMemo(() => {
    if (!searchError) return null;
    const msg = String(searchError);
    if (msg.toLowerCase().includes("secret api key")) {
      return "Supabase: tu utilises une clé *secrète* côté navigateur. Mets la clé **anon public** dans NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    }
    return msg;
  }, [searchError]);

  const clampQty = (wanted: number, available?: number | null) => {
    const w = Math.max(1, Number(wanted || 1));
    const a = typeof available === "number" && Number.isFinite(available) ? available : null;
    if (a === null) return w;
    return Math.min(w, Math.max(0, a)); // si stock=0 (normalement filtré), clamp à 0 mais on forcera à 1 ailleurs
  };

  return (
    <div className="rounded-3xl border border-dashed border-border/70 p-4 space-y-4 bg-white/70">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Lignes de pièces
        </p>

        <Button
          type="button"
          disabled={disabled}
          onClick={() => setQuery("")}
          className="h-9 rounded-full px-4 bg-slate-900 text-white text-xs font-medium shadow-[0_10px_25px_rgba(15,23,42,0.35)] hover:bg-slate-900/90 gap-2"
        >
          <Search className="h-4 w-4" />
          Rechercher
        </Button>
      </div>

      {/* Recherche */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          Rechercher une pièce (référence)
        </Label>

        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: 3001, 3024, ..."
            className={cn(inputClassName(false), "pr-10")}
            disabled={disabled}
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
        </div>

        {/* Résultats */}
        {(query.trim().length >= 2 || results.length > 0) && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
            <div className="max-h-72 overflow-auto p-1">
              {loading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Recherche…
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Aucun résultat (ou stock = 0)
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.piece_ref}
                    type="button"
                    onClick={() => addOrIncrement(r)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                    disabled={disabled}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">
                        {r.piece_ref}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Stock: {Number(r.total_quantity ?? 0)}
                      </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground">
                        Stock: {Number(r.stock_qty ?? 0)}
                      </span>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                ))
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

      {/* Tableau des lignes */}
      <div className="space-y-3">
        {value.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-muted-foreground">
            Ajoute une ou plusieurs pièces via la recherche ci-dessus.
          </div>
        ) : (
          value.map((line) => {
            const lineErr = errors?.[line.id];
            return (
              <div
                key={line.id}
                className="rounded-3xl bg-white/80 p-4 shadow-[0_10px_25px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {line.piece_ref}
                    </p>
                    {(line.piece_name || typeof line.available_qty === "number") && (
                      <p className="text-[11px] text-muted-foreground">
                        {line.piece_name ? line.piece_name : null}
                        {line.piece_name && typeof line.available_qty === "number"
                          ? " · "
                          : null}
                        {typeof line.available_qty === "number"
                          ? `Stock: ${line.available_qty}`
                          : null}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={disabled}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
                    aria-label="Supprimer la ligne"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className={cn("mt-3 grid gap-4", showNetLineAmount ? "md:grid-cols-3" : "md:grid-cols-2")}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Quantité vendue
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={String(line.quantity ?? 1)}
                      onChange={(e) => {
                        const raw = Number(e.target.value || 1);
                        const nextQty = clampQty(raw, line.available_qty);           
                        updateLine(line.id, { quantity: nextQty });
                      }}
                      className={inputClassName(Boolean(lineErr?.quantity))}
                      disabled={disabled}
                      max={typeof line.available_qty === "number" ? line.available_qty : undefined}
                    />
                    {lineErr?.quantity && (
                      <p className="text-xs text-rose-600">{lineErr.quantity}</p>
                    )}
                  </div>

                  {showNetLineAmount && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Net par ligne (optionnel)
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 3,50"
                        value={
                          typeof line.net_amount === "number" && Number.isFinite(line.net_amount)
                            ? String(line.net_amount).replace(".", ",")
                            : ""
                        }
                        onChange={(e) => {
                          const n = parseDecimalFR(e.target.value);
                          updateLine(line.id, { net_amount: Number.isFinite(n) ? n : null });
                        }}
                        className={inputClassName(Boolean(lineErr?.netAmount))}
                        disabled={disabled}
                      />
                      {lineErr?.netAmount && (
                        <p className="text-xs text-rose-600">{lineErr.netAmount}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Commentaire (optionnel)
                    </Label>
                    <Input
                      value={line.comment ?? ""}
                      onChange={(e) => updateLine(line.id, { comment: e.target.value })}
                      placeholder="Note..."
                      className={inputClassName(false)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}