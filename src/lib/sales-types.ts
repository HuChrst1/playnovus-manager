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

// Lignes de stock_movements (utile pour FIFO + debug)
export type StockMovementRow = Tables<"stock_movements">;
export type StockMovementInsert = TablesInsert<"stock_movements">;

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
// Draft-side unions (front/back). We expose them under stable names used across the codebase.
export type SaleType = "SET" | "PIECE";
export type SalesChannel =
  | "VINTED"
  | "LEBONCOIN"
  | "EBAY"
  | "DIRECT"
  | "OTHER";

// Backward/transition aliases (if some files still import *Draft names*)
export type SaleTypeDraft = SaleType;
export type SalesChannelDraft = SalesChannel;

/**
 * Métadonnées du brouillon de vente, partagées front/back.
 * (La phase actuelle peut forcer `sale_type: "SET"` côté UI, mais on garde les 2 valeurs ici.)
 */
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

/**
 * Overrides (set incomplet / pièces retirées / quantités ajustées)
 * Clé = piece_ref, valeur = quantité finale à consommer pour CETTE ligne.
 */
export type PieceOverridesMap = Record<string, number>;

/**
 * Ligne SET (version backend)
 *
 * IMPORTANT: discriminated union sur `item_kind`.
 */
export type SaleItemSetDraftInput = {
  item_kind: "SET";
  set_id: string;
  quantity: number;
  is_partial_set: boolean;
  net_amount?: number | null;

  /**
   * Nouveau format (3.4.4.x) : mapping piece_ref -> quantité finale
   */
  overrides?: PieceOverridesMap;

  /**
   * Compat: ancien format (tableau) parfois encore présent dans du code legacy.
   * On le garde TEMPORAIREMENT pour éviter de casser pendant la migration.
   * Idéalement, supprimer une fois que tout le code utilise `overrides`.
   */
  piece_overrides?: PieceDemand[];

  comment?: string | null;
};

/**
 * Ligne PIECE (version backend)
 *
 * IMPORTANT: discriminated union sur `item_kind`.
 */
export type SaleItemPieceDraftInput = {
  item_kind: "PIECE";
  piece_ref: string;
  quantity: number;

  // Pour compat avec certains usages (`item.is_partial_set ?? false`).
  // Doit rester faux pour une ligne PIECE.
  is_partial_set?: boolean;

  net_amount?: number | null;
  comment?: string | null;
};

/**
 * Union discriminée: évite les `never` lors des checks sur item_kind.
 */
export type SaleItemDraft = SaleItemSetDraftInput | SaleItemPieceDraftInput;

export type SaleDraft = SaleDraftMeta & {
  items: SaleItemDraft[];
};

// ----------------------
// UI helpers (front only)
// ----------------------

// Ligne UI pour une vente PIECE (avec id local pour React)
export type SaleDraftPieceLine = {
  id: string;
  item_kind: "PIECE";
  piece_ref: string;
  quantity: number;
  net_amount?: number | null;
  comment?: string | null;
};