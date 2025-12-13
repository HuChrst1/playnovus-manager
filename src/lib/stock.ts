// src/lib/stock.ts

import { supabase } from "@/lib/supabase";
import type { StockMovementRow } from "@/lib/sales-types";

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
 * Représente un "morceau" de stock consommé en FIFO pour une pièce donnée.
 * Chaque chunk correspond typiquement à une partie d'un lot (ou d'un mouvement IN).
 */
export type FifoChunk = {
  pieceRef: string;
  lotId: number | null;
  quantity: number;
  unitCost: number;
  /**
   * Id du mouvement source associé, si utile pour le debug
   * (ex: id d'un mouvement IN dans stock_movements).
   */
  movementId?: number;
};

/**
 * Résultat d'une allocation FIFO pour une pièce.
 *
 * - requestedQuantity : quantité demandée à l'origine
 * - totalQuantity : quantité réellement allouée (<= requestedQuantity)
 * - totalCost : somme(quantity * unitCost) sur tous les chunks
 */
export type FifoAllocationResult = {
  pieceRef: string;
  requestedQuantity: number;
  totalQuantity: number;
  totalCost: number;
  chunks: FifoChunk[];
};

/**
 * Représente l'état courant d'un "bucket" FIFO pour une pièce :
 * un lot (ou groupe de mouvements IN) avec une quantité encore disponible.
 */
export type FifoBucket = {
  pieceRef: string;
  lotId: number | null;
  unitCost: number;
  quantityAvailable: number;
  firstMovementId?: number;
};

/**
 * Construit les "buckets" FIFO à partir de la liste des mouvements
 * déjà triés par created_at ASC.
 *
 * Hypothèses actuelles :
 * - direction = 'IN' => on ajoute du stock (PURCHASE, SALE_CANCEL, etc.)
 * - direction = 'OUT' => on consomme du stock existant en FIFO
 * - direction = 'ADJUST' => pour l'instant ignoré dans la reconstruction FIFO
 *   (le stock global reste correct via stock_per_piece, mais les corrections
 *    manuelles ne sont pas encore reflétées dans le détail FIFO).
 */
export function buildFifoBuckets(
  movements: StockMovementRow[]
): FifoBucket[] {
  const buckets: FifoBucket[] = [];

  for (const m of movements) {
    const pieceRef = m.piece_ref;
    if (!pieceRef) continue;

    const qty = Number(m.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const unitCost =
      m.unit_cost !== null && m.unit_cost !== undefined
        ? Number(m.unit_cost)
        : 0;
    const lotId = m.lot_id ?? null;

    if (m.direction === "IN") {
      // Nouveau stock disponible (achat, retour de vente, etc.)
      buckets.push({
        pieceRef,
        lotId,
        unitCost,
        quantityAvailable: qty,
        firstMovementId: m.id ?? undefined,
      });
    } else if (m.direction === "OUT") {
      // Consommation FIFO des buckets existants
      let remaining = qty;

      for (const bucket of buckets) {
        if (remaining <= 0) break;
        if (bucket.quantityAvailable <= 0) continue;

        const take = Math.min(bucket.quantityAvailable, remaining);
        bucket.quantityAvailable -= take;
        remaining -= take;
      }

      // Si remaining > 0 ici, cela signifie que l'historique contient
      // plus de sorties que d'entrées pour cette pièce. On ne jette pas
      // d'erreur dans cette fonction pure, mais les buckets reflèteront
      // un stock épuisé (ou négatif si on allait plus loin).
    } else if (m.direction === "ADJUST") {
      // TODO: intégrer les ajustements manuels dans la reconstruction FIFO
      // lorsqu'on aura une règle métier claire pour leur répartition.
      continue;
    }
  }

  // On ne retourne que les buckets qui ont encore une quantité disponible
  return buckets.filter((b) => b.quantityAvailable > 0);
}

/**
 * Charge l'historique complet des mouvements de stock pour une pièce donnée,
 * triés par created_at ASC (du plus ancien au plus récent).
 *
 * On ne filtre pas ici par direction ou source_type : la logique FIFO
 * se chargera ensuite d'interpréter les IN / OUT / ADJUST / SALE_CANCEL, etc.
 */
export async function fetchMovementsForPiece(
  pieceRef: string
): Promise<StockMovementRow[]> {
  if (!pieceRef) {
    return [];
  }

  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("piece_ref", pieceRef)
    .order("created_at", { ascending: true })
    .limit(100000);

  if (error) {
    console.error(
      "fetchMovementsForPiece - error loading stock_movements:",
      error
    );
    return [];
  }

  return data ?? [];
};

/**
 * Alloue une quantité demandée pour une pièce donnée en appliquant le FIFO.
 *
 * - Récupère tous les mouvements pour cette pièce (triés ASC)
 * - Construit les buckets FIFO (buildFifoBuckets)
 * - Alloue dans l'ordre des buckets jusqu'à atteindre requestedQty
 *
 * Si la quantité disponible est insuffisante, la fonction lève une erreur
 * afin que l'appelant puisse bloquer la vente.
 */
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
    console.error(
      `allocateFifoForPiece - stock insuffisant pour la pièce ${pieceRef}: demandé=${safeRequested}, disponible=${totalQuantity}`
    );
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

/**
 * Helper de debug pour visualiser :
 * - l'historique brut des mouvements d'une pièce
 * - les buckets FIFO calculés
 * - et, optionnellement, une allocation pour une quantité demandée.
 *
 * À utiliser ponctuellement (console) pendant le développement.
 */
export async function debugFifoForPiece(
  pieceRef: string,
  requestedQty?: number
): Promise<void> {
  if (!pieceRef) {
    console.warn("debugFifoForPiece - pieceRef vide");
    return;
  }

  console.log("===== DEBUG FIFO POUR PIECE =====");
  console.log("pieceRef:", pieceRef);

  // 1) Mouvements bruts
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

  // 2) Buckets FIFO
  const buckets = buildFifoBuckets(movements);
  console.log("Buckets FIFO (stock disponible):", buckets);

  // 3) Éventuellement, test d'allocation
  if (requestedQty !== undefined && requestedQty !== null) {
    const safeRequested = Number(requestedQty);
    if (Number.isFinite(safeRequested) && safeRequested > 0) {
      try {
        const alloc = await allocateFifoForPiece(pieceRef, safeRequested);
        console.log(
          `Allocation FIFO pour quantité demandée = ${safeRequested}:`,
          alloc
        );
      } catch (e) {
        console.error(
          `Erreur lors de l'allocation FIFO pour ${pieceRef} (qty=${safeRequested}):`,
          e
        );
      }
    }
  }

  // 4) Pour comparaison, on peut aussi interroger la vue stock_per_piece
  try {
    const { data: stockRow, error: stockError } = await supabase
      .from("stock_per_piece")
      .select("piece_ref, total_quantity, avg_unit_cost, total_value")
      .eq("piece_ref", pieceRef)
      .maybeSingle();

    if (stockError) {
      console.error(
        "debugFifoForPiece - erreur lors de la lecture de stock_per_piece:",
        stockError
      );
    } else {
      console.log("Vue stock_per_piece pour cette pièce:", stockRow);
    }
  } catch (err) {
    console.error(
      "debugFifoForPiece - exception lors de la lecture de stock_per_piece:",
      err
    );
  }

  console.log("===== FIN DEBUG FIFO =====");
}

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