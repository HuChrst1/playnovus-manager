// src/app/actions/stock-movements.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  createStockMovements,
  StockMovementInput,
} from "@/lib/stock";

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
  const movements: StockMovementInput[] = args.items.map((item) => ({
    pieceRef: item.pieceRef.trim(),
    direction: "OUT",
    quantity: item.quantity,
    unitCost: item.unitCost ?? null,
    lotId: null, // plus tard on pourra faire du vrai FIFO et y lier les lots
    sourceType: "SALE",
    sourceId: saleIdStr,
    comment: null,
  }));

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