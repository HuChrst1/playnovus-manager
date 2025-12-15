import { supabase } from "@/lib/supabase";
import type {
  PieceDemand,
  SaleItemDraft,
  SaleItemPieceDraftInput,
  SaleItemSetDraftInput,
} from "@/lib/sales-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";

// Helper: nettoie/valide overrides (attendu: { [piece_ref]: number })
function normalizeOverrides(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;

  const raw = v as Record<string, unknown>;
  const out: Record<string, number> = {};

  for (const [k, val] of Object.entries(raw)) {
    const key = String(k ?? "").trim();
    const n = Number(val);
    if (!key) continue;
    if (!Number.isFinite(n) || n <= 0) continue;
    out[key] = n;
  }

  return Object.keys(out).length > 0 ? out : null;
}

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

  // ✅ OPTIMISÉ : si overrides existe => on NE CHARGE PAS le BOM
  const ov = normalizeOverrides((item as any).overrides);
  if (ov) {
    return Object.entries(ov).map(([piece_ref, quantity]) => ({
      piece_ref,
      quantity,
    }));
  }

  // ✅ Compat: si piece_overrides est un mapping (ancien front), on le prend aussi
  const ovLegacyMap = normalizeOverrides((item as any).piece_overrides);
  if (ovLegacyMap) {
    return Object.entries(ovLegacyMap).map(([piece_ref, quantity]) => ({
      piece_ref,
      quantity,
    }));
  }

  // 1) BOM
  const bomRows = await fetchBomForSet(item.set_id);

  // 2) BOM * quantité de sets vendus
  const aggregated = new Map<string, number>();

  for (const row of bomRows) {
    const baseQty = Number(row.quantity ?? 0);
    if (!Number.isFinite(baseQty) || baseQty <= 0) continue;

    const totalForThisPiece = baseQty * qtySets;
    aggregated.set(
      row.piece_ref,
      (aggregated.get(row.piece_ref) ?? 0) + totalForThisPiece
    );
  }

  // 3) Compat temporaire (ANCIEN format): tableau piece_overrides
  if (Array.isArray(item.piece_overrides) && item.piece_overrides.length > 0) {
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
export async function getPiecesForSaleItem(
  item: SaleItemDraft
): Promise<PieceDemand[]> {
  if (item.item_kind === "PIECE") {
    return getPiecesForSaleItemPiece(item);
  }
  // item_kind === "SET"
  return getPiecesForSaleItemSet(item);
}

// ------------------------------------------------------------
// 3.6.1 (A) DATA — Liste "commandes" pour /ventes (agrégée)
// ------------------------------------------------------------

export type SalesListParams = {
  from?: string; // ISO date/time
  to?: string; // ISO date/time
  channel?: string;
  status?: string; // ex: "CONFIRMED"
  type?: "SET" | "PIECE";
  limit?: number;
  offset?: number;
};

export type SalesListRow = {
  sale_id: number;
  paid_at: string;
  sales_channel: string;
  sale_type: "SET" | "PIECE" | "MIXED";
  net_seller_amount: number;

  total_cost_amount: number;
  total_margin_amount: number;
  margin_rate: number | null;

  sets_count: number;
  pieces_lines_count: number;
  pieces_qty_total: number;
};

type SalesDbRow = Pick<
  Tables<"sales">,
  | "id"
  | "paid_at"
  | "sales_channel"
  | "sale_type"
  | "status"
  | "net_seller_amount"
  | "total_cost_amount"
  | "total_margin_amount"
  | "margin_rate"
>;

type SaleItemMini = Pick<
  Tables<"sale_items">,
  "item_kind" | "quantity" | "cost_amount"
>;

type SalesWithItems = SalesDbRow & {
  sale_items: SaleItemMini[] | null;
};

const toNumber = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Liste paginée des ventes pour la table "commandes".
 * - 1 seul appel PostgREST : sales + embed sale_items
 * - Agrégation côté JS (robuste + simple à maintenir)
 * - Exclut CANCELLED par défaut
 */
export async function listSalesForTable(
  client: SupabaseClient<Database>,
  params: SalesListParams = {}
): Promise<{ rows: SalesListRow[]; total: number | null }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);

  let q = client
    .from("sales")
    .select(
      `
        id,
        paid_at,
        sales_channel,
        sale_type,
        status,
        net_seller_amount,
        total_cost_amount,
        total_margin_amount,
        margin_rate,
        sale_items (
          item_kind,
          quantity,
          cost_amount
        )
      `,
      { count: "exact" }
    )
    .neq("status", "CANCELLED");

  if (params.status) q = q.eq("status", params.status);
  if (params.channel) q = q.eq("sales_channel", params.channel);
  if (params.from) q = q.gte("paid_at", params.from);
  if (params.to) q = q.lte("paid_at", params.to);
  if (params.type) q = q.eq("sale_type", params.type);

  // IMPORTANT: on garde .returns() à la toute fin, sinon TS perd .eq/.gte/... selon les versions
  const { data, error, count } = await q
    .order("paid_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<SalesWithItems[]>();

  if (error) throw error;

  const rows: SalesListRow[] = (data ?? []).map((s) => {
    const items = Array.isArray(s.sale_items) ? s.sale_items : [];

    const sets_count = items.filter((i) => i.item_kind === "SET").length;
    const pieces_lines_count = items.filter((i) => i.item_kind === "PIECE").length;
    const pieces_qty_total = items
      .filter((i) => i.item_kind === "PIECE")
      .reduce((acc, i) => acc + toNumber(i.quantity, 0), 0);

    // Fallback coût si sales.total_cost_amount est null (ou pas encore rempli)
    const fallbackCost = items.reduce(
      (acc, i) => acc + toNumber(i.cost_amount, 0),
      0
    );

    const net = toNumber(s.net_seller_amount, 0);
    const cost = s.total_cost_amount ?? fallbackCost;
    const margin = s.total_margin_amount ?? net - cost;
    const marginRate = s.margin_rate ?? (net > 0 ? margin / net : null);

    const derivedType: "SET" | "PIECE" | "MIXED" =
      sets_count > 0 && pieces_lines_count > 0
        ? "MIXED"
        : sets_count > 0
          ? "SET"
          : "PIECE";

    // sale_type DB peut être null/unknown selon ton schéma => on sécurise
    const saleTypeFromDb =
      s.sale_type === "SET" || s.sale_type === "PIECE" ? s.sale_type : null;

    return {
      sale_id: s.id,
      paid_at: s.paid_at,
      sales_channel: s.sales_channel,
      sale_type: saleTypeFromDb ?? derivedType,
      net_seller_amount: net,

      total_cost_amount: cost,
      total_margin_amount: margin,
      margin_rate: marginRate,

      sets_count,
      pieces_lines_count,
      pieces_qty_total,
    };
  });

  return { rows, total: count ?? null };
}