import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";

// ----------------------
// DB row types (Supabase)
// ----------------------

// Lignes de la table sales
export type SaleRow = Tables<"sales">;
export type SaleInsert = TablesInsert<"sales">;
export type SaleUpdate = TablesUpdate<"sales">;

// Lignes de la table sale_items
export type SaleItemRow = Tables<"sale_items">;
export type SaleItemInsert = TablesInsert<"sale_items">;
export type SaleItemUpdate = TablesUpdate<"sale_items">;

// ----------------------
// IMPORTANT: bigint-safe lot_id
// ----------------------
// Supabase/PostgREST peut renvoyer un int8 (bigint) sous forme de string.
// On choisit donc string côté app pour éviter tout souci (overflow / mismatch).
type StockMovementRowBase = Tables<"stock_movements">;
type StockMovementInsertBase = TablesInsert<"stock_movements">;
type StockMovementUpdateBase = TablesUpdate<"stock_movements">;

export type StockMovementRow = Omit<StockMovementRowBase, "lot_id"> & {
  lot_id: string | null;
};

export type StockMovementInsert = Omit<StockMovementInsertBase, "lot_id"> & {
  lot_id?: string | null;
};

export type StockMovementUpdate = Omit<StockMovementUpdateBase, "lot_id"> & {
  lot_id?: string | null;
};

// IDs pratiques
export type SaleId = SaleRow["id"];
export type SaleItemId = SaleItemRow["id"];

// Pour les futures requêtes "vente + lignes"
export type SaleWithItems = SaleRow & {
  items: SaleItemRow[];
};

// ----------------------
// Drafts (front <-> back)
// ----------------------

/**
 * On garde des unions littérales côté draft (front/back),
 * même si en DB c'est stocké comme string.
 */
export type SaleType = "SET" | "PIECE";
export type SalesChannel =
  | "VINTED"
  | "LEBONCOIN"
  | "EBAY"
  | "DIRECT"
  | "OTHER";

// Backward/transition aliases
export type SaleTypeDraft = SaleType;
export type SalesChannelDraft = SalesChannel;

export type SaleDraftMeta = {
  sale_type: SaleType;
  sales_channel: SalesChannel | string;
  paid_at: string; // YYYY-MM-DD
  net_seller_amount: number;
  currency?: string;
  comment?: string | null;
};

// Demande de consommation pour une pièce (utilisé par le moteur FIFO)
export type PieceDemand = {
  piece_ref: string;
  quantity: number;
};

export type PieceOverridesMap = Record<string, number>;
export type PieceOverridesLegacy = PieceOverridesMap | PieceDemand[];

export type SaleItemSetDraftInput = {
  item_kind: "SET";
  set_id: string;
  quantity: number;
  is_partial_set: boolean;
  net_amount?: number | null;

  overrides?: PieceOverridesMap;
  piece_overrides?: PieceOverridesLegacy; // compat
  comment?: string | null;
};

export type SaleItemPieceDraftInput = {
  item_kind: "PIECE";
  piece_ref: string;
  quantity: number;
  is_partial_set?: boolean;
  net_amount?: number | null;
  comment?: string | null;
};

export type SaleItemDraft = SaleItemSetDraftInput | SaleItemPieceDraftInput;

export type SaleDraft = SaleDraftMeta & {
  items: SaleItemDraft[];
};

// ----------------------
// UI helpers (front only)
// ----------------------

export type SaleDraftPieceLine = {
  id: string;
  item_kind: "PIECE";
  piece_ref: string;
  quantity: number;
  net_amount?: number | null;
  comment?: string | null;
};