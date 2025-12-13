import { supabase } from "@/lib/supabase";
import type {
  PieceDemand,
  SaleItemDraft,
  SaleItemPieceDraftInput,
  SaleItemSetDraftInput,
} from "@/lib/sales-types";

/**
 * Charge le BOM d'un set et le renvoie sous forme de { piece_ref, quantity }.
 */
async function fetchBomForSet(setId: string): Promise<PieceDemand[]> {
  if (!setId) return [];

  const { data, error } = await supabase
    .from("sets_bom")
    .select("piece_ref, quantity")
    .eq("set_id", setId);

  if (error) {
    console.error("fetchBomForSet - erreur lors du chargement du BOM:", error);
    throw new Error(`Impossible de charger le BOM pour le set ${setId}`);
  }

  if (!data || data.length === 0) {
    console.warn(
      `fetchBomForSet - aucun BOM trouvé pour le set ${setId}. Vérifier sets_bom.`
    );
    return [];
  }

  return data.map((row) => ({
    piece_ref: row.piece_ref,
    quantity: Number(row.quantity ?? 0),
  }));
}

/**
 * 3.2.2.2 - Cas item_kind = 'PIECE'
 */
export function getPiecesForSaleItemPiece(
  item: SaleItemPieceDraftInput
): PieceDemand[] {
  if (!item.piece_ref) {
    throw new Error(
      "getPiecesForSaleItemPiece - piece_ref manquant pour une ligne PIECE"
    );
  }

  const qty = Number(item.quantity ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) return [];

  return [{ piece_ref: item.piece_ref, quantity: qty }];
}

/**
 * 3.2.2.3 - Cas item_kind = 'SET'
 *
 * - Charge le BOM du set
 * - Multiplie les quantités par item.quantity (nb d'exemplaires vendus)
 * - Applique éventuellement les overrides (mapping piece_ref -> quantité finale)
 */
export async function getPiecesForSaleItemSet(
  item: SaleItemSetDraftInput
): Promise<PieceDemand[]> {
  if (!item.set_id) {
    throw new Error(
      "getPiecesForSaleItemSet - set_id manquant pour une ligne SET"
    );
  }

  const qtySets = Number(item.quantity ?? 0);
  if (!Number.isFinite(qtySets) || qtySets <= 0) return [];

  // 1) BOM
  const bomRows = await fetchBomForSet(item.set_id);

  // 2) BOM * quantité de sets vendus
  const aggregated = new Map<string, number>();

  for (const row of bomRows) {
    const baseQty = Number(row.quantity ?? 0);
    if (!Number.isFinite(baseQty) || baseQty <= 0) continue;

    const totalForThisPiece = baseQty * qtySets;
    aggregated.set(row.piece_ref, (aggregated.get(row.piece_ref) ?? 0) + totalForThisPiece);
  }

  // 3) Overrides (NOUVEAU format): mapping { [piece_ref]: qtyFinalePourLaLigne }
  if (item.overrides && Object.keys(item.overrides).length > 0) {
    for (const [pieceRef, rawQty] of Object.entries(item.overrides)) {
      const overrideQty = Number(rawQty ?? 0);
      if (!pieceRef) continue;

      if (!Number.isFinite(overrideQty) || overrideQty <= 0) {
        aggregated.delete(pieceRef);
      } else {
        aggregated.set(pieceRef, overrideQty);
      }
    }
  }
  // 3bis) Compat temporaire (ANCIEN format): tableau piece_overrides
  else if (item.piece_overrides && item.piece_overrides.length > 0) {
    for (const override of item.piece_overrides) {
      const pieceRef = override.piece_ref;
      const overrideQty = Number(override.quantity ?? 0);
      if (!pieceRef) continue;

      if (!Number.isFinite(overrideQty) || overrideQty <= 0) {
        aggregated.delete(pieceRef);
      } else {
        aggregated.set(pieceRef, overrideQty);
      }
    }
  }

  // 4) Map -> tableau
  const result: PieceDemand[] = [];
  for (const [piece_ref, quantity] of aggregated.entries()) {
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    result.push({ piece_ref, quantity });
  }

  return result;
}

/**
 * 3.2.2.4 - Helper unifié
 */
export async function getPiecesForSaleItem(item: SaleItemDraft): Promise<PieceDemand[]> {
  if (item.item_kind === "PIECE") {
    return getPiecesForSaleItemPiece(item);
  }
  // item_kind === "SET"
  return getPiecesForSaleItemSet(item);
}