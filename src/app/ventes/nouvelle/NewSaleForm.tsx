"use client";

import { useMemo, useState, useEffect, FormEvent, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SetSelector, type SaleDraftSetLine } from "@/components/sales/SetSelector";
import {
  PieceSelector,
  type SaleDraftPieceLine,
  type PieceSelectorErrors,
} from "@/components/sales/PieceSelector";
import { cn } from "@/lib/utils";
import { createSaleAction } from "@/app/actions/sales";
import type { SaleDraft, SaleType, SalesChannel, PieceOverridesMap } from "@/lib/sales-types";
import Link from "next/link";


type NewSaleFormErrors = Partial<{
  paidAt: string;
  netAmount: string;
  // erreurs par ligne de set (clé = id local de la ligne)
  setLines: Record<string, { setId?: string; quantity?: string }>;
  pieceRef: string;
  pieceLines: PieceSelectorErrors;
}>;

type SubmitResult = {
  saleId: number;
  net: number;
  totalCost: number;
  totalMargin: number;
  marginRate: number | null;
};

type SetLineWithOverrides = SaleDraftSetLine & {
  overrides?: PieceOverridesMap;
  piece_overrides?: PieceOverridesMap;
};

export function NewSaleForm() {
  const [saleType, setSaleType] = useState<SaleType>("SET");

  // Champs "header" de la vente
  const [paidAt, setPaidAt] = useState<string>("");
  const [channel, setChannel] = useState<SalesChannel>("VINTED");
  const [netAmount, setNetAmount] = useState<string>("");

  const [comment, setComment] = useState<string>("");

  // Lignes de vente (SET) : tableau de lignes (préparation 3.4.2)
  const makeLocalId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const [setLines, setSetLines] = useState<SaleDraftSetLine[]>(() => [
    {
      id: makeLocalId(),
      item_kind: "SET",
      set_id: "",
      quantity: 1,
      is_partial_set: false,
      net_amount: null,
    },
  ]);
  const [pieceLines, setPieceLines] = useState<SaleDraftPieceLine[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const [errors, setErrors] = useState<NewSaleFormErrors>({});
  const [draft, setDraft] = useState<SaleDraft | null>(null);

  // 3.4.4.3 – États de soumission
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  // Quand on change de mode (SET <-> PIECE), on reset les messages de soumission
  // pour éviter d'afficher un succès/erreur d'un mode précédent.
  useEffect(() => {
    setSubmitError(null);
    setSubmitResult(null);
    setFormMessage(null);
    setDraft(null);

    // On nettoie uniquement les erreurs spécifiques aux lignes.
    setErrors((prev) => ({
      ...prev,
      setLines: undefined,
      pieceRef: undefined,
      pieceLines: undefined,
    }));
  }, [saleType]);

  const parseDecimalFR = (raw: string) => {
    const cleaned = (raw ?? "").toString().trim().replace("€", "").replace(/\s/g, "");
    const normalized = cleaned.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  };

  const buildDraft = (): SaleDraft => {
    const net = parseDecimalFR(netAmount);

    const base: Omit<SaleDraft, "items"> = {
      sale_type: saleType,
      sales_channel: channel,
      paid_at: paidAt,
      net_seller_amount: Number.isFinite(net) ? net : 0,
      comment: comment?.trim() ? comment.trim() : null,
    };

    if (saleType === "SET") {
      return {
        ...base,
        items: setLines.map((l) => {
          const line = l as SetLineWithOverrides;
          return {
            item_kind: "SET" as const,
            set_id: (line.set_id ?? "").trim(),
            quantity: Math.max(1, Number(line.quantity || 1)),
            is_partial_set: Boolean(line.is_partial_set),
            net_amount: line.net_amount ?? null,
            overrides: line.overrides ?? line.piece_overrides ?? undefined,
          };
        }),
      };
    }

    return {
      ...base,
      items: pieceLines.map((l) => ({
        item_kind: "PIECE" as const,
        piece_ref: (l.piece_ref ?? "").trim(),
        quantity: Math.max(1, Number(l.quantity || 1)),
        net_amount:
          typeof l.net_amount === "number" && Number.isFinite(l.net_amount)
            ? l.net_amount * Math.max(1, Number(l.quantity || 1))
            : null,
        comment: l.comment ?? null,
      })),
    };
  };

  const validateDraft = (d: SaleDraft): NewSaleFormErrors => {
    const next: NewSaleFormErrors = {};

    if (!d.paid_at) {
      next.paidAt = "La date de paiement est obligatoire.";
    }

    if (!Number.isFinite(d.net_seller_amount) || d.net_seller_amount <= 0) {
      next.netAmount = "Le montant net doit être > 0.";
    }

    if (d.sale_type === "SET") {
      const lineErrors: Record<string, { setId?: string; quantity?: string }> = {};

      // On se base sur l'état UI (setLines) pour retrouver les IDs locaux
      // et afficher les erreurs au bon endroit.
      setLines.forEach((uiLine, idx) => {
        const item = d.items[idx];
        const setId = (item && item.item_kind === "SET" ? item.set_id : "").trim();
        const qty = Number(item && item.item_kind === "SET" ? item.quantity : 0);

        const e: { setId?: string; quantity?: string } = {};
        if (!setId) e.setId = "Le SetID est obligatoire.";
        if (!Number.isFinite(qty) || qty <= 0) e.quantity = "La quantité doit être ≥ 1.";

        if (Object.keys(e).length > 0) {
          lineErrors[uiLine.id] = e;
        }
      });

      if (Object.keys(lineErrors).length > 0) {
        next.setLines = lineErrors;
      }
    }

    if (d.sale_type === "PIECE") {
      // 1) Au moins une ligne
      if (!d.items || d.items.length === 0 || pieceLines.length === 0) {
        next.pieceRef = "Ajoute au moins une pièce (mode pièces).";
        return next;
      }

      // 2) Erreurs par ligne + tarif par pièce obligatoire
      const lineErrors: PieceSelectorErrors = {};
      let linesCents = 0;

      for (const uiLine of pieceLines) {
        const eLine: { pieceRef?: string; quantity?: string; netAmount?: string } = {};

        const ref = (uiLine.piece_ref ?? "").trim();
        if (!ref) eLine.pieceRef = "Référence obligatoire.";

        const qty = Number(uiLine.quantity ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) eLine.quantity = "Quantité invalide.";

        // Soft validation stock si on a la dispo
        if (
          typeof uiLine.available_qty === "number" &&
          Number.isFinite(uiLine.available_qty) &&
          qty > uiLine.available_qty
        ) {
          eLine.quantity = "Quantité > stock disponible.";
        }

        // IMPORTANT: ici net_amount = TARIF PAR PIECE (unitaire) côté UI
        const unit = uiLine.net_amount;
        const unitIsOk = typeof unit === "number" && Number.isFinite(unit) && unit > 0;
        if (!unitIsOk) {
          eLine.netAmount = "Tarif par pièce obligatoire.";
        }

        if (Object.keys(eLine).length > 0) {
          lineErrors[uiLine.id] = eLine;
        } else {
          // À ce stade, unitIsOk est forcément vrai (sinon eLine.netAmount aurait été rempli)
          linesCents += Math.round((unit as number) * qty * 100);
        }
      }

      if (Object.keys(lineErrors).length > 0) {
        next.pieceLines = lineErrors;
        next.pieceRef = "Merci de corriger les lignes de pièces.";
        return next;
      }

      // 3) Somme des lignes = net vendeur (au centime)
      const netCents = Math.round((d.net_seller_amount ?? 0) * 100);
      if (linesCents !== netCents) {
        const fmt = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
        next.pieceRef = `La somme des lignes (${fmt(linesCents)}) doit être égale au net vendeur (${fmt(netCents)}).`;
      }
    }

    return next;
  };

  // UX minimale : on calcule en continu si le formulaire est validable
  const canSubmit = useMemo(() => {
    const d = buildDraft();
    const e = validateDraft(d);
    return Object.keys(e).length === 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleType, channel, paidAt, netAmount, comment, setLines, pieceLines]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormMessage(null);
    setSubmitError(null);
    setSubmitResult(null);

    const nextDraft = buildDraft();
    const nextErrors = validateDraft(nextDraft);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setDraft(null);
      setFormMessage("Merci de corriger les champs en rouge.");
      return;
    }

    setErrors({});
    setDraft(nextDraft);
    setIsSubmitting(true);

    try {
      const res = await createSaleAction(nextDraft);

      if (!res?.success || !res.saleId) {
        setSubmitError(res?.error ?? "Erreur lors de l'enregistrement de la vente.");
        if (res?.debug) console.error("createSaleAction debug:", res.debug);
        return;
      }

      // Stub totals: tant que FIFO n'est pas branché, coût = 0
      const net = Number(nextDraft.net_seller_amount ?? 0);
      const totalCost = 0;
      const totalMargin = net - totalCost;
      const marginRate = net > 0 ? totalMargin / net : null;

      setSubmitResult({
        saleId: res.saleId,
        net,
        totalCost,
        totalMargin,
        marginRate,
      });

      setFormMessage("Vente enregistrée.");

      // Option redirection directe :
      // router.push(`/ventes/${res.saleId}`);
    } catch (err) {
      console.error("NewSaleForm - submit error:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Erreur inattendue lors de l'enregistrement."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSetSale = saleType === "SET";
  // Classe utilitaire commune : pas de contour noir, mais un halo (shadow) doux comme sur Approvisionnement
  const fieldClassName =
    "border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-0";

  const errorRing = "ring-1 ring-rose-300";
  const inputClassName = (hasError?: boolean) =>
    cn("h-10 rounded-full px-4", fieldClassName, hasError && errorRing);
  const selectClassName = cn(
    "h-10 w-full rounded-full px-4 text-sm appearance-none",
    fieldClassName
  );
  const textareaClassName = cn(
    "rounded-2xl px-4 py-3",
    fieldClassName
  );

  const euro = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

  const pieceSummary = useMemo(() => {
    if (saleType !== "PIECE") return null;

    const net = parseDecimalFR(netAmount);
    const netCents = Number.isFinite(net) ? Math.round(net * 100) : 0;

    let totalCents = 0;
    let missingUnitCount = 0;
    let overStockCount = 0;

    for (const line of pieceLines) {
      const qty = Math.max(1, Number(line.quantity || 1));

      const available =
        typeof line.available_qty === "number" && Number.isFinite(line.available_qty)
          ? line.available_qty
          : null;

      if (available !== null && qty > available) {
        overStockCount += 1;
      }

      const unit = line.net_amount;
      const unitOk = typeof unit === "number" && Number.isFinite(unit) && unit > 0;
      if (!unitOk) {
        missingUnitCount += 1;
        continue;
      }

      totalCents += Math.round(unit * qty * 100);
    }

    const hasLines = pieceLines.length > 0;
    const netOk = netCents > 0;
    const totalsMatch = hasLines && netOk && totalCents === netCents;

    return {
      hasLines,
      netOk,
      netCents,
      totalCents,
      diffCents: totalCents - netCents,
      missingUnitCount,
      overStockCount,
      totalsMatch,
    };
  }, [saleType, netAmount, pieceLines]);

  const footerAutoMessage = useMemo(() => {
    // If the form is valid, no hint needed
    if (canSubmit) return null;

    // PIECE mode: give the most actionable cause first
    if (saleType === "PIECE") {
      if (!pieceSummary || !pieceSummary.hasLines) {
        return "Ajoute au moins une pièce.";
      }
      if (!pieceSummary.netOk) {
        return "Renseigne un net vendeur (> 0).";
      }
      if (pieceSummary.overStockCount > 0) {
        return "Corrige la quantité : elle dépasse le stock disponible.";
      }
      if (pieceSummary.missingUnitCount > 0) {
        return "Renseigne le tarif par pièce sur toutes les lignes.";
      }
      if (pieceSummary.diffCents !== 0) {
        return "Écart entre le total des lignes et le net vendeur.";
      }
      return "Merci de corriger les champs.";
    }

    // SET mode (générique)
    return "Complète les champs obligatoires pour pouvoir enregistrer.";
  }, [canSubmit, saleType, pieceSummary]);

  return (
    <div
      className={cn(
        "px-1",
        // Hauteur MAX (pas forcée) : laisse de l'air en haut/bas, scroll interne si besoin
        "max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain pr-3 py-4",
        // Scrollbar visible à droite (WebKit)
        "[&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb]:bg-slate-300/70",
        "hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/80"
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-8 pb-10">
      {/* 3.4.4.3 – D) Bannière erreur + card succès */}
      {submitError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}

      {submitResult && (
        <section className="app-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Vente enregistrée
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-4 text-xs">
            <div>
              <p className="text-[11px] text-muted-foreground">Net vendeur</p>
              <p className="font-medium">{euro.format(submitResult.net)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Coût total</p>
              <p className="font-medium">{euro.format(submitResult.totalCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Marge</p>
              <p className="font-medium">{euro.format(submitResult.totalMargin)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">% marge</p>
              <p className="font-medium">
                {submitResult.marginRate === null
                  ? "—"
                  : `${Math.round(submitResult.marginRate * 1000) / 10}%`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button asChild type="button" className="h-9 rounded-full px-4">
              <Link href={`/ventes/${submitResult.saleId}`}>Voir la vente</Link>
            </Button>
          </div>
        </section>
      )}
      {/* TYPE DE VENTE */}
      <section className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Type de vente
        </p>

        <div className="inline-flex rounded-full bg-muted/70 p-1 shadow-[0_10px_25px_rgba(15,23,42,0.10)]">
          <button
            type="button"
            aria-pressed={saleType === "SET"}
            onClick={() => setSaleType("SET")}
            disabled={isSubmitting}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold transition-all",
              saleType === "SET"
                ? "bg-white text-slate-900 shadow-[0_12px_26px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5 -translate-y-px"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70 opacity-80"
            )}
          >
            Vente de set
          </button>

          <button
            type="button"
            aria-pressed={saleType === "PIECE"}
            onClick={() => setSaleType("PIECE")}
            disabled={isSubmitting}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold transition-all",
              saleType === "PIECE"
                ? "bg-white text-slate-900 shadow-[0_12px_26px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5 -translate-y-px"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70 opacity-80"
            )}
          >
            Vente de pièces
          </button>
        </div>
      </section>

      {/* Infos générales de la vente */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="paid_at"
            className="text-xs font-medium text-muted-foreground"
          >
            Date de paiement
          </Label>
          <Input
            id="paid_at"
            type="date"
            value={paidAt}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setPaidAt(e.target.value);
              setErrors((prev) => ({ ...prev, paidAt: undefined }));
            }}
            className={inputClassName(Boolean(errors.paidAt))}
            required
            disabled={isSubmitting}
          />
          {errors.paidAt && (
            <p className="text-xs text-rose-600">{errors.paidAt}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="sales_channel"
            className="text-xs font-medium text-muted-foreground"
          >
            Canal de vente
          </Label>
          <select
            id="sales_channel"
            className={selectClassName}
            value={channel}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setChannel(e.target.value as SalesChannel)
            }
            disabled={isSubmitting}
          >
            <option value="VINTED">Vinted</option>
            <option value="LEBONCOIN">Le Bon Coin</option>
            <option value="EBAY">eBay</option>
            <option value="DIRECT">Direct</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="net_amount"
            className="text-xs font-medium text-muted-foreground"
          >
            Montant net vendeur (€)
          </Label>
          <Input
            id="net_amount"
            type="text"
            inputMode="decimal"
            value={netAmount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setNetAmount(e.target.value);
              setErrors((prev) => ({ ...prev, netAmount: undefined }));
            }}
            placeholder="Ex: 23,50"
            className={inputClassName(Boolean(errors.netAmount))}
            required
            disabled={isSubmitting}
          />
          {errors.netAmount && (
            <p className="text-xs text-rose-600">{errors.netAmount}</p>
          )}
        </div>
      </section>

      {/* Commentaire global */}
      <section className="space-y-1.5">
        <Label
          htmlFor="comment"
          className="text-xs font-medium text-muted-foreground"
        >
          Commentaire (optionnel)
        </Label>
        <Textarea
          id="comment"
          rows={3}
          value={comment}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setComment(e.target.value)
          }
          placeholder="Notes sur la vente (acheteur, particularités, etc.)"
          className={textareaClassName}
          disabled={isSubmitting}
        />
      </section>

      {/* Lignes de vente */}
      <section className="space-y-3">
      <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Lignes de vente</h2>
        </div>

        {isSetSale ? (
          <SetSelector
            value={setLines}
            onChange={(next) => {
              setSetLines(next);
              // on n'efface pas tout, seulement le bloc d'erreurs SET
              setErrors((prev) => ({ ...prev, setLines: undefined }));
            }}
            disabled={isSubmitting}
            errors={errors.setLines}
          />
        ) : (
          <div className="space-y-2">
            <PieceSelector
              value={pieceLines}
              onChange={(next) => {
                setPieceLines(next);
                setErrors((prev) => ({
                  ...prev,
                  pieceRef: undefined,
                  pieceLines: undefined,
                }));
              }}
              disabled={isSubmitting}
              errors={errors.pieceLines}
            />
            {pieceSummary && (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-xs",
                  pieceSummary.totalsMatch && pieceSummary.missingUnitCount === 0 && pieceSummary.overStockCount === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white/70 text-slate-700"
                )}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    <span className="text-muted-foreground">Total lignes :</span>{" "}
                    {euro.format((pieceSummary.totalCents ?? 0) / 100)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Net vendeur :</span>{" "}
                    {euro.format((pieceSummary.netCents ?? 0) / 100)}
                  </span>
                  {pieceSummary.hasLines && pieceSummary.netOk && pieceSummary.diffCents !== 0 && (
                    <span className="text-rose-600">
                      Écart : {euro.format(Math.abs(pieceSummary.diffCents) / 100)}
                    </span>
                  )}
                </div>

                {pieceSummary.overStockCount > 0 && (
                  <p className="mt-1 text-rose-600">
                    Quantité &gt; stock sur {pieceSummary.overStockCount} ligne(s).
                  </p>
                )}

                {pieceSummary.missingUnitCount > 0 && (
                  <p className="mt-1 text-rose-600">
                    Tarif manquant sur {pieceSummary.missingUnitCount} ligne(s).
                  </p>
                )}

                {pieceSummary.hasLines && pieceSummary.netOk && pieceSummary.totalsMatch && (
                  <p className="mt-1">OK : total des lignes = net vendeur.</p>
                )}
              </div>
            )}
            {errors.pieceRef && (
              <p className="text-xs text-rose-600">{errors.pieceRef}</p>
            )}
          </div>
        )}
      </section>

      {draft && (
        <section className="app-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Brouillon en mémoire
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-4 text-xs">
            <div>
              <p className="text-[11px] text-muted-foreground">Type</p>
              <p className="font-medium">{draft.sale_type}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Canal</p>
              <p className="font-medium">{draft.sales_channel}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Payée le</p>
              <p className="font-medium">{draft.paid_at || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Net vendeur</p>
              <p className="font-medium">
                {Number.isFinite(draft.net_seller_amount)
                  ? euro.format(draft.net_seller_amount)
                  : "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER FORMULAIRE */}
      <section className="flex items-center justify-between gap-3 pt-2">
        {(formMessage || footerAutoMessage) && (
          <p className="text-xs text-muted-foreground">
            {formMessage ?? footerAutoMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className={cn(
            "inline-flex items-center h-10 rounded-full px-8 bg-slate-900 text-white text-sm font-medium shadow-[0_12px_26px_rgba(15,23,42,0.45)] hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed",
            isSubmitting && "opacity-80 cursor-not-allowed"
          )}
        >
          {/* 1) Texte sans “squelette” */}
          {isSubmitting ? "Enregistrement…" : "Enregistrer la vente"}
        </Button>
      </section>
      </form>
    </div>
  );
}