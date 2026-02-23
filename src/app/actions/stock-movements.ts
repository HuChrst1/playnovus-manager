// src/app/actions/stock-movements.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  createStockMovements,
  StockMovementInput,
} from "@/lib/stock";
import {
  getAuthSessionErrorMessage,
  requireActiveSession,
} from "@/lib/auth/require-active-session";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const SALES_RATE_LIMIT = {
  scope: "sales_mutations",
  limit: 60,
  windowMs: 5 * 60 * 1000,
} as const;

const PIECE_REF_REGEX = /^[A-Za-z0-9._-]+$/;

/**
 * Server action générique pour enregistrer les mouvements
 * de stock liés à une vente.
 *
 * Elle NE crée pas la vente elle-même : elle prend en entrée
 * un saleId déjà connu, et la liste des lignes consommées.
 */
export async function registerSaleStockMovements(args: {
  saleId: string | number;
  items: {
    pieceRef: string;
    quantity: number;
    unitCost?: number | null; // tu pourras y mettre le coût FIFO plus tard
  }[];
}) {
  try {
    const actor = await requireActiveSession();
    const limit = enforceRateLimit(
      SALES_RATE_LIMIT.scope,
      actor.userId,
      SALES_RATE_LIMIT.limit,
      SALES_RATE_LIMIT.windowMs
    );
    if (!limit.allowed) {
      return {
        success: false,
        error: `Trop de requetes. Reessaie dans ${limit.retryAfterSeconds}s.`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: getAuthSessionErrorMessage(error),
    };
  }

  const saleIdStr = String(args.saleId);

  if (!saleIdStr) {
    return { success: false, error: "Identifiant de vente invalide." };
  }

  if (!args.items || args.items.length === 0) {
    return {
      success: false,
      error: "Aucune ligne de pièce à enregistrer pour cette vente.",
    };
  }

  // Construction des mouvements OUT
  const movements: StockMovementInput[] = [];
  for (const item of args.items) {
    const pieceRef = String(item.pieceRef ?? "").trim().toUpperCase();
    const quantity = Number(item.quantity);

    if (!PIECE_REF_REGEX.test(pieceRef)) {
      return { success: false, error: `Reference piece invalide: ${item.pieceRef}` };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        success: false,
        error: `Quantite invalide pour ${pieceRef}. Attendu: entier strictement positif.`,
      };
    }

    movements.push({
      pieceRef,
      direction: "OUT",
      quantity,
      unitCost: item.unitCost ?? null,
      lotId: null, // plus tard on pourra faire du vrai FIFO et y lier les lots
      sourceType: "SALE",
      sourceId: saleIdStr,
      comment: null,
    });
  }

  const result = await createStockMovements(movements);

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? "Erreur lors de l'enregistrement des mouvements.",
    };
  }

  // On invalide les vues de stock qui en dépendent
  revalidatePath("/stock");

  // plus tard : revalidatePath("/ventes"); etc.
  return { success: true };
}
