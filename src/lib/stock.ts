// src/lib/stock.ts

import { supabase } from "@/lib/supabase";

export type StockForPiece = {
  totalQuantity: number;
  avgUnitCost: number | null;
  totalValue: number;
};

/**
 * Récupère les infos de stock pour une liste de références de pièces
 * en s'appuyant sur la vue SQL `stock_per_piece`.
 *
 * - pieceRefs : liste de références de pièces (BOM d'un set, par exemple)
 *
 * Retourne un dictionnaire :
 * {
 *   "30000000": { totalQuantity: 12, avgUnitCost: 0.24, totalValue: 2.88 },
 *   "30010000": { ... },
 *   ...
 * }
 *
 * Si une pièce n'est pas présente dans la vue (stock nul), elle ne sera
 * pas dans le résultat. À l'appelant de gérer le fallback (0).
 */
export async function getStockForPieces(
  pieceRefs: string[]
): Promise<Record<string, StockForPiece>> {
  const result: Record<string, StockForPiece> = {};

  if (!pieceRefs || pieceRefs.length === 0) {
    return result;
  }

  // On déduplique au cas où la BOM aurait plusieurs lignes identiques
  const uniqueRefs = Array.from(new Set(pieceRefs.filter(Boolean)));

  if (uniqueRefs.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from("stock_per_piece")
    .select("piece_ref, total_quantity, avg_unit_cost, total_value")
    .in("piece_ref", uniqueRefs)
    .limit(1000000);

  if (error) {
    console.error("getStockForPieces - error loading stock_per_piece:", error);
    return result;
  }

  for (const row of data ?? []) {
    const pieceRef = row.piece_ref as string | null;

    if (!pieceRef) continue;

    const totalQuantity = Number(row.total_quantity ?? 0);
    const avgUnitCostRaw = row.avg_unit_cost;
    const totalValue = Number(row.total_value ?? 0);

    const avgUnitCost =
      avgUnitCostRaw === null || avgUnitCostRaw === undefined
        ? null
        : Number(avgUnitCostRaw);

    result[pieceRef] = {
      totalQuantity,
      avgUnitCost: Number.isFinite(avgUnitCost) ? avgUnitCost : null,
      totalValue,
    };
  }

  return result;
}

// --- Helpers génériques pour les mouvements de stock ---

export type StockMovementDirection = "IN" | "OUT" | "ADJUST";

export type StockMovementInput = {
  pieceRef: string;
  direction: StockMovementDirection;
  quantity: number;
  unitCost?: number | null;
  lotId?: number | null;
  sourceType: string; // ex: "PURCHASE", "SALE", "ADJUSTMENT"
  sourceId?: string | null; // ex: lot_id, sale_id...
  comment?: string | null;
};

/**
 * Insère une liste de mouvements de stock dans la table stock_movements.
 *
 * Utilisable aussi bien pour :
 *  - les entrées (IN) depuis les lots
 *  - les sorties (OUT) depuis les ventes
 *  - les ajustements (ADJUST)
 */
export async function createStockMovements(
  movements: StockMovementInput[]
): Promise<{ success: boolean; error?: string }> {
  const cleaned = movements
    .filter((m) => m.pieceRef && Number.isFinite(m.quantity) && m.quantity > 0)
    .map((m) => ({
      piece_ref: m.pieceRef,
      lot_id: m.lotId ?? null,
      direction: m.direction,
      quantity: m.quantity,
      unit_cost:
        m.unitCost !== undefined && m.unitCost !== null
          ? Number(m.unitCost)
          : null,
      source_type: m.sourceType,
      source_id: m.sourceId ?? null,
      comment: m.comment ?? null,
    }));

  if (cleaned.length === 0) {
    return { success: true };
  }

  const { error } = await supabase
    .from("stock_movements")
    .insert(cleaned);

  if (error) {
    console.error("createStockMovements - insert error:", error);
    return {
      success: false,
      error: "Impossible d'enregistrer les mouvements de stock.",
    };
  }

  return { success: true };
}