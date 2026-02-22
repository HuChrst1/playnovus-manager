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
import { createSaleAction, updateSaleAction, cancelSaleAction } from "@/app/actions/sales";
import type {
  SaleDraft,
  SaleType,
  SalesChannel,
  PieceOverridesMap,
  SaleStatus,
  SaleItemSetDraftInput,
  SaleItemPieceDraftInput,
} from "@/lib/sales-types";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";


type NewSaleFormErrors = Partial<{
  paidAt: string;
  netAmount: string;
  // erreurs par ligne de set (clé = id local de la ligne)
  setLines: Record<string, { setId?: string; quantity?: string; netAmount?: string }>;
  pieceRef: string;
  pieceLines: PieceSelectorErrors;
}>;

type SetLineWithOverrides = SaleDraftSetLine & {
  overrides?: PieceOverridesMap;
  piece_overrides?: PieceOverridesMap;
};

type NewSaleFormProps = {
  mode?: "create" | "edit";
  saleId?: number; // requis si mode=edit
  initialDraft?: SaleDraft;
  editStockCreditByPieceRef?: Record<string, number>;
  onDone?: () => void; // fermer la modale
};

type StockPerPieceQtyRow = {
  piece_ref: string | null;
  total_quantity: number | null;
};

const isSetItemDraft = (
  item: SaleDraft["items"][number]
): item is SaleItemSetDraftInput => item.item_kind === "SET";

const isPieceItemDraft = (
  item: SaleDraft["items"][number]
): item is SaleItemPieceDraftInput => item.item_kind === "PIECE";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }
  return fallback;
};

const hasDebugPayload = (value: unknown): value is { debug: unknown } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "debug" in value &&
    (value as { debug?: unknown }).debug !== undefined
  );
};

const extractDebugMessage = (debug: unknown): string | null => {
  if (!debug || typeof debug !== "object") return null;

  const rec = debug as Record<string, unknown>;

  const directMessage = getErrorMessage(rec.message, "");
  if (directMessage) return directMessage;

  const keysByPriority = [
    "exception",
    "fifoErr",
    "saleError",
    "itemsError",
    "itemsInsertError",
    "deletePiecesErr",
    "deleteItemsErr",
  ];

  for (const key of keysByPriority) {
    const message = getErrorMessage(rec[key], "");
    if (message) return message;
  }

  const validationErrors = rec.validationErrors;
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    const first = validationErrors[0] as { message?: unknown } | undefined;
    if (first?.message && typeof first.message === "string") {
      return first.message;
    }
  }

  return null;
};

const logDebug = (label: string, debug: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.debug(label, debug);
  }
};

export function NewSaleForm({
  mode = "create",
  saleId,
  initialDraft,
  editStockCreditByPieceRef,
  onDone,
}: NewSaleFormProps) {
  const [saleType, setSaleType] = useState<SaleType>("SET");

  // ✅ statut (edit uniquement)
  const [status, setStatus] = useState<SaleStatus>("CONFIRMED");

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

  const toDateInputValue = (v: string | null | undefined) => {
    if (!v) return "";
    // accepte ISO (2025-...T...) ou déjà YYYY-MM-DD
    return v.includes("T") ? v.slice(0, 10) : v;
  };
  
  const toFR = (n: number | null | undefined) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return "";
    return String(n).replace(".", ",");
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

  useEffect(() => {
    if (mode !== "edit") return;
    if (!initialDraft) return;
  
    setSaleType(initialDraft.sale_type);
    setPaidAt(toDateInputValue(initialDraft.paid_at));
    setChannel(initialDraft.sales_channel as SalesChannel);
    setNetAmount(toFR(Number(initialDraft.net_seller_amount ?? 0)));
    setComment(initialDraft.comment ?? "");

    // ✅ statut récupéré uniquement en edit
    setStatus((initialDraft.status ?? "CONFIRMED") as SaleStatus);
  
    const items = initialDraft.items ?? [];
  
    if (initialDraft.sale_type === "SET") {
      setPieceLines([]);
    
      const setItems = items.filter(isSetItemDraft);
    
      setSetLines(
        setItems.map((it) => {
          const ov = it.overrides ?? undefined;
          const hasOv = !!ov && Object.keys(ov).length > 0;
    
          return {
            id: makeLocalId(),
            item_kind: "SET" as const,
            set_id: String(it.set_id ?? ""),
            set_label: null,
            quantity: Math.max(1, Number(it.quantity ?? 1)),
            is_partial_set: Boolean(it.is_partial_set) || hasOv,
            overrides: hasOv ? ov : undefined,
            net_amount: null,
            piece_overrides: undefined,
          };
        })
      );
    
      // recalcul net_amount unitaire si pack
      setTimeout(() => {
        setSetLines((prev) => {
          if (prev.length <= 1) return prev;
    
          return prev.map((l, idx) => {
            const src = setItems[idx];
            const total = Number(src?.net_amount ?? 0);
            const q = Math.max(1, Number(src?.quantity ?? l.quantity ?? 1));
            const unit = total > 0 ? Math.round((total * 100) / q) / 100 : null;
            return { ...l, net_amount: unit };
          });
        });
      }, 0);
    } else {
      setSetLines([
        {
          id: makeLocalId(),
          item_kind: "SET",
          set_id: "",
          quantity: 1,
          is_partial_set: false,
          net_amount: null,
        },
      ]);
    
      const pieceItems = items.filter(isPieceItemDraft);
      const onlyOnePieceLine = pieceItems.length === 1;
    
      setPieceLines(
        pieceItems.map((it) => {
          const qty = Math.max(1, Number(it.quantity ?? 1));
          const total = Number(it.net_amount ?? 0);
    
          return {
            id: makeLocalId(),
            item_kind: "PIECE" as const,
            piece_ref: String(it.piece_ref ?? ""),
            piece_name: null,
            available_qty: null,
            quantity: qty,
            net_amount: onlyOnePieceLine ? null : (total > 0 ? total : null),
            comment: it.comment ?? null,
          };
        })
      );
    }
  }, [mode, initialDraft]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const [errors, setErrors] = useState<NewSaleFormErrors>({});
  const [draft, setDraft] = useState<SaleDraft | null>(null);

  // 3.4.4.3 – États de soumission
  const [submitError, setSubmitError] = useState<string | null>(null);

  type BomStockPiece = {
    piece_ref: string;
    bom_qty: number;
    stock_qty: number;
  };
  
  type BomStockResponse = {
    set_id: string;
    pieces: BomStockPiece[];
  };
  
  const [bomBySetId, setBomBySetId] = useState<Record<string, BomStockResponse>>({});
  const [bomLoading, setBomLoading] = useState(false);
  const [availableByPieceRef, setAvailableByPieceRef] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const effectiveAvailableByPieceRef = useMemo(() => {
    // En édition CONFIRMED, on réintègre virtuellement les pièces de la vente en cours.
    if (mode !== "edit" || status === "CANCELLED") return availableByPieceRef;

    const creditEntries = Object.entries(editStockCreditByPieceRef ?? {});
    if (creditEntries.length === 0) return availableByPieceRef;

    const merged: Record<string, number> = { ...availableByPieceRef };
    for (const [rawRef, rawCredit] of creditEntries) {
      const ref = String(rawRef ?? "").trim();
      const credit = Number(rawCredit ?? 0);
      if (!ref || !Number.isFinite(credit) || credit <= 0) continue;

      const base = Number(merged[ref] ?? 0);
      merged[ref] = (Number.isFinite(base) ? base : 0) + credit;
    }

    return merged;
  }, [mode, status, availableByPieceRef, editStockCreditByPieceRef]);
  // Quand on change de mode (SET <-> PIECE), on reset les messages de soumission
  // pour éviter d'afficher un succès/erreur d'un mode précédent.
  useEffect(() => {
    setSubmitError(null);
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

  const router = useRouter();

  // 3.6.2.5.6 – Précharger BOM+stock par set (pour vérifier dépassement stock en mode SET)
  useEffect(() => {
    if (saleType !== "SET") return;

    const setIds = Array.from(
      new Set(
        setLines
          .map((l) => (l.set_id ?? "").trim())
          .filter((x) => x.length > 0)
      )
    );

    if (setIds.length === 0) return;

    let cancelled = false;

    (async () => {
      setBomLoading(true);
      try {
        const missing = setIds.filter((id) => !bomBySetId[id]);
        if (missing.length === 0) return;

        const resList = await Promise.all(
          missing.map(async (setId) => {
            try {
              const res = await fetch(
                `/api/sets/${encodeURIComponent(setId)}/bom-stock`,
                {
                  method: "GET",
                  headers: { Accept: "application/json" },
                }
              );
              if (!res.ok) return null;
              const json = (await res.json()) as BomStockResponse;
              return json?.set_id ? json : null;
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const patch: Record<string, BomStockResponse> = {};
        for (const r of resList) {
          if (r && r.set_id) patch[r.set_id] = r;
        }

        if (Object.keys(patch).length > 0) {
          setBomBySetId((prev) => ({ ...prev, ...patch }));
        }
      } finally {
        if (!cancelled) setBomLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [saleType, setLines, bomBySetId]);

  // 3.6.2.5.6 – Calcul demande globale (PIECE + SET) puis comparaison au stock_per_piece
  const stockDemand = useMemo(() => {
    const demand = new Map<string, number>();

    // PIECE: somme des quantités
    for (const l of pieceLines) {
      const ref = (l.piece_ref ?? "").trim();
      if (!ref) continue;
      const qty = Number(l.quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      demand.set(ref, (demand.get(ref) ?? 0) + Math.max(0, qty));
    }

    // SET: BOM * qty, ou overrides (déjà des quantités finales par ligne)
    if (saleType === "SET") {
      for (const line of setLines) {
        const setId = (line.set_id ?? "").trim();
        if (!setId) continue;

        const qtySets = Math.max(1, Number(line.quantity ?? 1));
        const ov = line.overrides ?? line.piece_overrides;

        // Overrides = quantités finales (pas besoin de multiplier par qtySets)
        if (ov && Object.keys(ov).length > 0) {
          for (const [pieceRef, q] of Object.entries(ov)) {
            const ref = String(pieceRef ?? "").trim();
            const qty = Number(q);
            if (!ref || !Number.isFinite(qty) || qty <= 0) continue;
            demand.set(ref, (demand.get(ref) ?? 0) + qty);
          }
          continue;
        }

        const bom = bomBySetId[setId]?.pieces ?? null;
        if (!bom) continue;

        for (const p of bom) {
          const ref = (p.piece_ref ?? "").trim();
          const bomQty = Number(p.bom_qty ?? 0);
          if (!ref || !Number.isFinite(bomQty) || bomQty <= 0) continue;
          demand.set(ref, (demand.get(ref) ?? 0) + bomQty * qtySets);
        }
      }
    }

    return demand;
  }, [saleType, setLines, pieceLines, bomBySetId]);

  const stockRefsKey = useMemo(() => {
    const refs = Array.from(stockDemand.keys());
    refs.sort();
    return refs.join("|");
  }, [stockDemand]);

  useEffect(() => {
    const refs = Array.from(stockDemand.keys());

    if (refs.length === 0) {
      setAvailableByPieceRef({});
      setStockError(null);
      setStockLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setStockLoading(true);
      setStockError(null);

      try {
        const { data, error } = await supabase
          .from("stock_per_piece")
          .select("piece_ref, total_quantity")
          .in("piece_ref", refs)
          .limit(1000000);

        if (cancelled) return;

        if (error) {
          setStockError(error.message);
          // En cas d'erreur, on ne bloque pas par défaut (mais on laisse stockLoading=false)
          setAvailableByPieceRef({});
          return;
        }

        const rows = (data ?? []) as StockPerPieceQtyRow[];
        const map: Record<string, number> = {};
        for (const r of rows) {
          const ref = String(r.piece_ref ?? "").trim();
          const qty = Number(r.total_quantity ?? 0);
          if (!ref) continue;
          map[ref] = Number.isFinite(qty) ? qty : 0;
        }

        // Si une ref n'est pas renvoyée, on considère stock = 0
        for (const ref of refs) {
          if (!(ref in map)) map[ref] = 0;
        }

        setAvailableByPieceRef(map);
      } catch (e: unknown) {
        if (cancelled) return;
        setStockError(getErrorMessage(e, "Erreur chargement stock."));
        setAvailableByPieceRef({});
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockRefsKey]);

  const overStockIssues = useMemo(() => {
    const issues: { piece_ref: string; need: number; have: number }[] = [];
    for (const [ref, need] of stockDemand.entries()) {
      const have = Number(effectiveAvailableByPieceRef[ref] ?? 0);
      if (Number.isFinite(have) && need > have) {
        issues.push({ piece_ref: ref, need, have });
      }
    }
    issues.sort((a, b) => a.piece_ref.localeCompare(b.piece_ref));
    return issues;
  }, [stockDemand, effectiveAvailableByPieceRef]);

  const stockOk = overStockIssues.length === 0;

  const stockCheckPending = useMemo(() => {
    // SET: si un set est saisi mais BOM pas encore chargé, on attend
    const hasSetIds =
      saleType === "SET" &&
      setLines.some((l) => (l.set_id ?? "").trim().length > 0);

    const missingBom =
      saleType === "SET" &&
      setLines.some((l) => {
        const setId = (l.set_id ?? "").trim();
        return setId.length > 0 && !bomBySetId[setId];
      });

    // Stock: si on a des refs à vérifier et que ça charge
    const hasRefs = stockDemand.size > 0;

    return (hasSetIds && (bomLoading || missingBom)) || (hasRefs && stockLoading);
  }, [saleType, setLines, bomBySetId, bomLoading, stockDemand, stockLoading]);

  useEffect(() => {
    if (saleType !== "SET") return;
    if (setLines.length !== 1) return;
  
    const net = parseDecimalFR(netAmount);
    const qty = setLines[0]?.quantity ?? 1;
  
    const unit = computeSingleSetUnit(net, qty);
  
    // On met à jour uniquement si ça change (évite boucle)
    const current = setLines[0]?.net_amount ?? null;
    const same =
      (current === null && unit === null) ||
      (typeof current === "number" &&
        typeof unit === "number" &&
        Math.round(current * 100) === Math.round(unit * 100));
  
    if (same) return;
  
    setSetLines((prev) => {
      if (prev.length !== 1) return prev;
      return [{ ...prev[0], net_amount: unit }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleType, netAmount, setLines.length, setLines[0]?.quantity]);
  
  const computeSingleSetUnit = (netSeller: number, qty: number) => {
    const q = Math.max(1, Number(qty || 1));
    if (!Number.isFinite(netSeller) || netSeller <= 0) return null;
  
    // On veut que (unit * qty) = netSeller au centime
    const unit = Math.round((netSeller * 100) / q) / 100;
    return Number.isFinite(unit) && unit > 0 ? unit : null;
  };

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
      const isSingle = setLines.length === 1;
  
      return {
        ...base,
        items: setLines.map((l) => {
          const line = l as SetLineWithOverrides;
          const qty = Math.max(1, Number(line.quantity || 1));
          const ov = line.overrides ?? line.piece_overrides;
          const isPartial = !!ov && Object.keys(ov).length > 0;
  
          if (isSingle) {
            return {
              item_kind: "SET" as const,
              set_id: (line.set_id ?? "").trim(),
              quantity: qty,
              is_partial_set: isPartial,
              overrides: isPartial ? ov : undefined,
              net_amount: Number.isFinite(net) ? net : 0,
            };
          }
  
          const unit = line.net_amount;
          const total =
            typeof unit === "number" && Number.isFinite(unit) ? unit * qty : null;
  
          return {
            item_kind: "SET" as const,
            set_id: (line.set_id ?? "").trim(),
            quantity: qty,
            is_partial_set: isPartial,
            overrides: isPartial ? ov : undefined,
            net_amount: total,
          };
        }),
      };
    }
  
    // ✅ 3.6.2.5.1 : Vente PIECE -> net_amount = TOTAL LIGNE (pas unitaire)
    // ✅ 1 seule ligne -> total ligne implicite = net vendeur
    const isSingleLine = pieceLines.length === 1;
  
    return {
      ...base,
      items: pieceLines.map((l) => {
        const qty = Math.max(1, Number(l.quantity || 1));
  
        const totalLine = isSingleLine
          ? (Number.isFinite(net) ? net : 0)
          : (typeof l.net_amount === "number" && Number.isFinite(l.net_amount) && l.net_amount > 0
              ? l.net_amount
              : null);
  
        return {
          item_kind: "PIECE" as const,
          piece_ref: (l.piece_ref ?? "").trim(),
          quantity: qty,
          is_partial_set: false,
          net_amount: totalLine,
          comment: l.comment ?? null,
        };
      }),
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
      const isPack = setLines.length > 1;
      const lineErrors: Record<
        string,
        { setId?: string; quantity?: string; netAmount?: string }
      > = {};
    
      let linesCents = 0;
    
      // On se base sur l’état UI (setLines) pour retrouver les IDs locaux
      setLines.forEach((uiLine, idx) => {
        const item = d.items[idx];
        const setId = (item && item.item_kind === "SET" ? item.set_id : "").trim();
        const qty = Number(item && item.item_kind === "SET" ? item.quantity : 0);

        const e: { setId?: string; quantity?: string; netAmount?: string } = {};

        const ov = uiLine.overrides ?? uiLine.piece_overrides;

        const hasOv = !!ov && Object.keys(ov).length > 0;

        // Cas legacy : on a un set marqué partiel (ancienne vente) mais aucun snapshot
        if (uiLine.is_partial_set && !hasOv) {
          e.setId =
            e.setId ??
            "Set partiel : ouvre “Détail des pièces” et clique Enregistrer (snapshot requis).";
        }

        if (!setId) e.setId = "Le SetID est obligatoire.";
        if (!Number.isFinite(qty) || qty <= 0) e.quantity = "La quantité doit être ≥ 1.";

        // IMPORTANT: tarif par set (unitaire) OBLIGATOIRE
        if (isPack) {
          const unit = uiLine.net_amount;
          const unitIsOk = typeof unit === "number" && Number.isFinite(unit) && unit > 0;
          if (!unitIsOk) e.netAmount = "Tarif réparti par set obligatoire.";
        }

        // Si la ligne est OK, on additionne (tarif * quantité) au centime
        if (!e.setId && !e.quantity && !e.netAmount) {
          if (isPack) {
            const unit = uiLine.net_amount as number;
            linesCents += Math.round(unit * qty * 100);
          } else {
            // 1 set => linesCents doit matcher net vendeur, donc on force le total = net
            const netCents = Math.round((d.net_seller_amount ?? 0) * 100);
            linesCents += netCents;
          }
        }

        if (Object.keys(e).length > 0) {
          lineErrors[uiLine.id] = e;
        }
      });
    
      if (Object.keys(lineErrors).length > 0) {
        next.setLines = lineErrors;
      }
    
      // Si aucune erreur par ligne, on impose: somme (tarif set * quantité) = net vendeur
      if (!next.setLines) {
        const netCents = Math.round((d.net_seller_amount ?? 0) * 100);
        if (linesCents !== netCents) {
          const fmt = (cents: number) =>
            `${(cents / 100).toFixed(2).replace(".", ",")} €`;
          next.netAmount = `La somme des tarifs répartis par set (${fmt(linesCents)}) doit être égale au net vendeur (${fmt(netCents)}).`;
        }
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
        const available =
          Number(effectiveAvailableByPieceRef[ref] ?? uiLine.available_qty ?? Number.NaN);
        if (ref && Number.isFinite(available) && qty > available) {
          eLine.quantity = "Quantité > stock disponible.";
        }

        const isSingleLine = pieceLines.length === 1;

        // ✅ 3.6.2.5.1 : ici net_amount = TOTAL DE LA LIGNE (pas unitaire)
        const total = uiLine.net_amount;
        const totalIsOk = typeof total === "number" && Number.isFinite(total) && total > 0;

        // 1 seule ligne => pas de tarif réparti obligatoire (il sera implicite = net vendeur)
        if (!isSingleLine && !totalIsOk) {
          eLine.netAmount = "Tarif réparti (total ligne) obligatoire.";
        }

        if (Object.keys(eLine).length > 0) {
          lineErrors[uiLine.id] = eLine;
        } else {
          if (!isSingleLine) {
            linesCents += Math.round((total as number) * 100);
          }
        }
      }

      if (pieceLines.length === 1) {
        // 1 ligne => total implicite = net vendeur, donc pas de contrôle de somme,
        // MAIS on doit quand même remonter les erreurs (ex: dépassement stock)
        if (Object.keys(lineErrors).length > 0) {
          next.pieceLines = lineErrors;
          next.pieceRef = "Merci de corriger les lignes de pièces.";
        }
        return next;
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
    // ✅ en edit, si on passe en CANCELLED, on autorise la sauvegarde même si le draft est incomplet
    if (mode === "edit" && status === "CANCELLED") return true;

    const d = buildDraft();
    const e = validateDraft(d);

    // 3.6.2.5.6 : bouton désactivé si dépassement stock (PIECE + SET)
    return Object.keys(e).length === 0 && stockOk && !stockCheckPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    status,
    saleType,
    channel,
    paidAt,
    netAmount,
    comment,
    setLines,
    pieceLines,
    stockOk,
    stockCheckPending,
  ]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormMessage(null);
    setSubmitError(null);

    // ✅ EDIT: changement de statut en "CANCELLED" = annulation (remet stock + conserve la vente)
    if (mode === "edit" && status === "CANCELLED") {
      if (!saleId) {
        setSubmitError("saleId manquant pour l’annulation.");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await cancelSaleAction(Number(saleId));

        if (!res.ok) {
          const msg =
            res.errors?.[0]?.message ?? "Erreur lors de l’annulation de la vente.";
          setSubmitError(msg);
          return;
        }

        onDone?.(); // ferme la modale + refresh via parent
        return;
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Erreur lors de l’annulation."
        );
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

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
      if (mode === "edit") {
        if (!saleId) {
          setSubmitError("saleId manquant pour l’édition.");
          return;
        }

        const res = await updateSaleAction(Number(saleId), nextDraft);

        if (!res?.success) {
          const fallbackError = "Erreur lors de la mise à jour de la vente.";
          const baseError = res?.error ?? fallbackError;
          const debugMessage =
            hasDebugPayload(res) ? extractDebugMessage(res.debug) : null;

          setSubmitError(
            debugMessage ? `${baseError} (${debugMessage})` : baseError
          );

          if (hasDebugPayload(res)) {
            logDebug("updateSaleAction debug:", res.debug);
          }
          return;
        }

        // En édition, on ferme et refresh via le parent
        onDone?.();
        return;
      }

      // mode=create
      const res = await createSaleAction(nextDraft);

      if (!res?.success || !res.saleId) {
        const fallbackError = "Erreur lors de l'enregistrement de la vente.";
        const baseError = res?.error ?? fallbackError;
        const debugMessage =
          hasDebugPayload(res) ? extractDebugMessage(res.debug) : null;

        setSubmitError(
          debugMessage ? `${baseError} (${debugMessage})` : baseError
        );

        if (hasDebugPayload(res)) {
          logDebug("createSaleAction debug:", res.debug);
        }
        return;
      }

      // ✅ Succès : fermer la modale (si présente) ou revenir à /ventes
      if (onDone) {
        onDone();
      } else {
        router.push("/ventes");
      }
      return;
    } catch (err) {
      logDebug("NewSaleForm - submit error:", err);
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
  const errorRing = "ring-1 ring-rose-300";
  const inputClassName = (hasError?: boolean) =>
    cn("app-control app-control--md", hasError && errorRing);
  const selectClassName = cn("app-control app-control--md w-full appearance-none");
  const textareaClassName = cn("app-control app-control--textarea");

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
    const refsInPieceLines = new Set(
      pieceLines
        .map((line) => String(line.piece_ref ?? "").trim())
        .filter((ref) => ref.length > 0)
    );
    const overStockCount = overStockIssues.filter((issue) =>
      refsInPieceLines.has(issue.piece_ref)
    ).length;

    for (const line of pieceLines) {
      const isSingleLine = pieceLines.length === 1;

      const total = line.net_amount;
      const totalOk = typeof total === "number" && Number.isFinite(total) && total > 0;

      if (!isSingleLine) {
        if (!totalOk) {
          missingUnitCount += 1;
          continue;
        }
        totalCents += Math.round((total as number) * 100);
      } else {
        // 1 ligne : total implicite = net vendeur
        totalCents = netCents;
      }
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
  }, [saleType, netAmount, pieceLines, overStockIssues]);

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
      if (stockCheckPending) {
        return "Vérification du stock en cours…";
      }
      if (pieceSummary.overStockCount > 0 || overStockIssues.length > 0) {
        if (overStockIssues.length > 0) {
          const details = overStockIssues
            .map((x) => `${x.piece_ref} (besoin ${x.need}, dispo ${x.have})`)
            .join(" · ");
          return `Stock insuffisant : ${details}.`;
        }

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

    // SET mode
    if (stockCheckPending) return "Vérification du stock en cours…";

    if (overStockIssues.length > 0) {
      const details = overStockIssues
        .map((x) => `${x.piece_ref} (besoin ${x.need}, dispo ${x.have})`)
        .join(" · ");

      return `Stock insuffisant : ${details}.`;
    }

    if (stockError) {
      return "Impossible de vérifier le stock pour le moment.";
    }

    return "Complète les champs obligatoires pour pouvoir enregistrer.";
  }, [canSubmit, saleType, pieceSummary, stockCheckPending, overStockIssues, stockError]);

  return (
    <div
      className={cn(
        "px-1 sm:px-2",
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
      <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      {/* 3.4.4.3 – Bannière erreur */}
      {submitError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}
      {/* TYPE DE VENTE */}
      <section className="app-surface-muted space-y-3 p-4 sm:p-5">
        <p className="app-section-label">
          Type de vente
        </p>

        <div className="app-segmented bg-muted/70">
          <button
            type="button"
            aria-pressed={saleType === "SET"}
            onClick={() => setSaleType("SET")}
            disabled={isSubmitting}
            className={cn(
              "app-segmented-item px-4 py-2 text-xs font-semibold",
              saleType === "SET"
                ? "app-segmented-item--active"
                : "app-segmented-item--inactive opacity-80"
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
              "app-segmented-item px-4 py-2 text-xs font-semibold",
              saleType === "PIECE"
                ? "app-segmented-item--active"
                : "app-segmented-item--inactive opacity-80"
            )}
          >
            Vente de pièces
          </button>
        </div>
      </section>

      {/* Infos générales de la vente */}
      <section className="app-surface-muted p-4 sm:p-5">
        <p className="app-section-label mb-3">Informations de vente</p>
        <div
          className={cn(
            "grid gap-4",
            mode === "edit" ? "md:grid-cols-4" : "md:grid-cols-3"
          )}
        >
        <div className="min-w-0 space-y-1.5">
          <Label
            htmlFor="paid_at"
            className="app-control-label whitespace-nowrap"
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

        <div className="min-w-0 space-y-1.5">
          <Label
            htmlFor="sales_channel"
            className="app-control-label whitespace-nowrap"
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

        {mode === "edit" && (
          <div className="min-w-0 space-y-1.5">
            <Label className="app-control-label whitespace-nowrap">
              Statut
            </Label>
            <select
              className={selectClassName}
              value={status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setStatus(e.target.value as SaleStatus)
              }
              disabled={isSubmitting}
            >
              <option value="CONFIRMED">Confirmée</option>
              <option value="CANCELLED">Annulée</option>
            </select>
          </div>
        )}

        <div className="min-w-0 space-y-1.5">
          <Label
            htmlFor="net_amount"
            className="app-control-label whitespace-nowrap"
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
        </div>

        {mode === "edit" && status === "CANCELLED" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Annuler remet le stock et conserve la vente dans l’historique.
          </p>
        ) : null}
      </section>

      {/* Commentaire global */}
      <section className="app-surface-muted space-y-1.5 p-4 sm:p-5">
        <Label
          htmlFor="comment"
          className="app-control-label"
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
      <section className="app-surface-muted space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Lignes de vente</h2>
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
                // ✅ 3.6.2.5.2 : si 1 seule ligne, pas de tarif réparti à saisir
                // on efface net_amount pour éviter une valeur implicite “fantôme”
                const normalized =
                  next.length === 1 && next[0]
                    ? [{ ...next[0], net_amount: null }]
                    : next;

                setPieceLines(normalized);
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
        <section className="app-surface-muted p-4 sm:p-5">
          <p className="app-section-label">
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
      <section className="app-surface-muted flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        {(formMessage || footerAutoMessage) && (
          <p className="text-xs text-muted-foreground">
            {formMessage ?? footerAutoMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className={cn(
            "inline-flex items-center h-10 px-8 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
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
