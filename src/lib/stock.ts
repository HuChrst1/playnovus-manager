// src/lib/stock.ts

import "server-only";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import {
  buildFifoBuckets,
  toNullableBigintString,
} from "@/lib/stock-fifo";
import type { Tables, TablesInsert } from "@/types/supabase";
import type {
  FifoAllocationResult,
  FifoBucket,
  FifoChunk,
} from "@/lib/stock-fifo";

type StockMovementDbRow = Tables<"stock_movements">;
type StockMovementDbInsert = TablesInsert<"stock_movements">;

type StockMovementRowBigint = Omit<StockMovementDbRow, "lot_id"> & {
  lot_id: string | null;
};

export type StockForPiece = {
  totalQuantity: number;
  avgUnitCost: number | null;
  totalValue: number;
};

export { buildFifoBuckets };
export type { FifoAllocationResult, FifoBucket, FifoChunk };

const toNullableInt = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;

  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);

  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  return null;
};

/**
 * Récupère les infos de stock pour une liste de références de pièces
 * en s'appuyant sur la vue SQL `stock_per_piece`.
 */
export async function getStockForPieces(
  pieceRefs: string[]
): Promise<Record<string, StockForPiece>> {
  const result: Record<string, StockForPiece> = {};

  if (!pieceRefs || pieceRefs.length === 0) return result;

  const uniqueRefs = Array.from(new Set(pieceRefs.filter(Boolean)));
  if (uniqueRefs.length === 0) return result;

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
  // bigint-safe
  lotId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  comment?: string | null;
};

export async function fetchMovementsForPiece(
  pieceRef: string
): Promise<StockMovementRowBigint[]> {
  if (!pieceRef) return [];

  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("piece_ref", pieceRef)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }) 
    .limit(100000);

  if (error) {
    console.error("fetchMovementsForPiece - error loading stock_movements:", error);
    return [];
  }

  // 🔑 Normalisation bigint-safe
  const rows = (data ?? []) as StockMovementDbRow[];

  return rows.map((m): StockMovementRowBigint => ({
    ...m,
    lot_id: toNullableBigintString(m.lot_id),
  }));
}

export async function allocateFifoForPiece(
  pieceRef: string,
  requestedQty: number
): Promise<FifoAllocationResult> {
  const safeRequested = Number(requestedQty ?? 0);

  if (!pieceRef || !Number.isFinite(safeRequested) || safeRequested <= 0) {
    return {
      pieceRef,
      requestedQuantity: safeRequested,
      totalQuantity: 0,
      totalCost: 0,
      chunks: [],
    };
  }

  const movements = await fetchMovementsForPiece(pieceRef);
  const buckets = buildFifoBuckets(movements);

  let remaining = safeRequested;
  const chunks: FifoChunk[] = [];
  let totalCost = 0;

  for (const bucket of buckets) {
    if (remaining <= 0) break;
    if (bucket.quantityAvailable <= 0) continue;

    const take = Math.min(bucket.quantityAvailable, remaining);
    if (take <= 0) continue;

    chunks.push({
      pieceRef,
      lotId: bucket.lotId,
      quantity: take,
      unitCost: bucket.unitCost,
      movementId: bucket.firstMovementId,
    });

    totalCost += take * bucket.unitCost;
    remaining -= take;
  }

  const totalQuantity = safeRequested - remaining;

  if (totalQuantity < safeRequested) {
    throw new Error(
      `Stock insuffisant pour la pièce ${pieceRef} (demandé: ${safeRequested}, disponible: ${totalQuantity})`
    );
  }

  return {
    pieceRef,
    requestedQuantity: safeRequested,
    totalQuantity,
    totalCost,
    chunks,
  };
}

export async function debugFifoForPiece(pieceRef: string, requestedQty?: number) {
  if (!pieceRef) return;

  console.log("===== DEBUG FIFO POUR PIECE =====");
  console.log("pieceRef:", pieceRef);

  const movements = await fetchMovementsForPiece(pieceRef);
  console.log(
    "Mouvements (triés par created_at ASC):",
    movements.map((m) => ({
      id: m.id,
      created_at: m.created_at,
      direction: m.direction,
      source_type: m.source_type,
      source_id: m.source_id,
      quantity: m.quantity,
      unit_cost: m.unit_cost,
      lot_id: m.lot_id,
    }))
  );

  const buckets = buildFifoBuckets(movements);
  console.log("Buckets FIFO (stock disponible):", buckets);

  if (requestedQty !== undefined && requestedQty !== null) {
    const safeRequested = Number(requestedQty);
    if (Number.isFinite(safeRequested) && safeRequested > 0) {
      const alloc = await allocateFifoForPiece(pieceRef, safeRequested);
      console.log(`Allocation FIFO (qty=${safeRequested}):`, alloc);
    }
  }

  console.log("===== FIN DEBUG FIFO =====");
}

export async function createStockMovements(
  movements: StockMovementInput[]
): Promise<{ success: boolean; error?: string }> {
  const cleaned: StockMovementDbInsert[] = movements
    .filter((m) => m.pieceRef && Number.isFinite(m.quantity) && m.quantity > 0)
    .map((m): StockMovementDbInsert => ({
      piece_ref: m.pieceRef,
      lot_id: toNullableInt(m.lotId),
      direction: m.direction,
      quantity: m.quantity,
      unit_cost: m.unitCost !== undefined && m.unitCost !== null ? Number(m.unitCost) : null,
      source_type: m.sourceType,
      source_id: m.sourceId ?? null,
      comment: m.comment ?? null,
    }));

  if (cleaned.length === 0) return { success: true };

  const { error } = await supabase.from("stock_movements").insert(cleaned);

  if (error) {
    console.error("createStockMovements - insert error:", error);
    return { success: false, error: "Impossible d'enregistrer les mouvements de stock." };
  }

  return { success: true };
}
