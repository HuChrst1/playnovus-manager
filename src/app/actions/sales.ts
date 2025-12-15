"use server";

import { supabaseServer as supabase } from "@/lib/supabase-server";
import type {
  SaleDraft,
  SaleItemDraft,
  SaleType,
  SaleRow,
  SaleItemRow,
  SaleInsert,
  SaleItemInsert,
  StockMovementInsert,
  StockMovementRow,
  SaleUpdate,
} from "@/lib/sales-types";
import type { Tables, TablesInsert } from "@/types/supabase";
type SaleItemDbRow = Tables<"sale_items">;
type SaleItemInsertDb = TablesInsert<"sale_items">;
type StockMovementDbRow = Tables<"stock_movements">;
type StockMovementInsertDb = TablesInsert<"stock_movements">;
type SaleItemPiecesInsertDb = TablesInsert<"sale_item_pieces">;
type SaleItemIdRow = Pick<SaleItemDbRow, "id">;
import { getPiecesForSaleItem } from "@/lib/sales";
import { allocateFifoForPiece } from "@/lib/stock";


export type CreateSaleValidationError = {
  field: string;
  message: string;
};

export type CreateSaleActionResult = {
  success: boolean;
  saleId?: number;
  error?: string;
  debug?: any;
};

/**
 * Validation métier de base pour une demande de création de vente.
 * Cette fonction ne touche pas à la base de données.
 */
function validateSaleDraft(draft: SaleDraft): CreateSaleValidationError[] {
  const errors: CreateSaleValidationError[] = [];

  if (!draft) {
    return [
      {
        field: "root",
        message: "Aucune donnée de vente fournie.",
      },
    ];
  }

  // sale_type
  if (!draft.sale_type) {
    errors.push({
      field: "sale_type",
      message: "Le type de vente est requis (SET ou PIECE).",
    });
  } else if (draft.sale_type !== "SET" && draft.sale_type !== "PIECE") {
    errors.push({
      field: "sale_type",
      message: `Type de vente invalide: ${draft.sale_type}.`,
    });
  }

  // net_seller_amount
  const net = Number(draft.net_seller_amount ?? 0);
  if (!Number.isFinite(net) || net <= 0) {
    errors.push({
      field: "net_seller_amount",
      message:
        "Le montant net vendeur doit être un nombre strictement positif.",
    });
  }

  // paid_at
  if (!draft.paid_at) {
    errors.push({
      field: "paid_at",
      message: "La date de paiement est requise.",
    });
  } else {
    const d = new Date(draft.paid_at);
    if (Number.isNaN(d.getTime())) {
      errors.push({
        field: "paid_at",
        message: "La date de paiement n'est pas une date valide.",
      });
    }
  }

  // sales_channel
  if (!draft.sales_channel || String(draft.sales_channel).trim() === "") {
    errors.push({
      field: "sales_channel",
      message: "Le canal de vente est requis (ex: VINTED).",
    });
  }

  // items
  if (!draft.items || draft.items.length === 0) {
    errors.push({
      field: "items",
      message: "Au moins une ligne de vente est requise.",
    });
  } else {
    const isPackSetSale = draft.sale_type === "SET" && draft.items.length > 1;

    draft.items.forEach((item, index) => {
      validateSaleItemDraft(
        item,
        index,
        draft.sale_type as SaleType,
        errors,
        { isPackSetSale }
      );
    });
  }

  return errors;
}


function hasNonEmptyOverrides(item: any): boolean {
  const isNonEmptyMap = (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const obj = v as Record<string, unknown>;
    return Object.keys(obj).some((k) => {
      const key = String(k ?? "").trim();
      const n = Number(obj[k]);
      return key.length > 0 && Number.isFinite(n) && n > 0;
    });
  };

  // nouveau format (map)
  if (isNonEmptyMap(item?.overrides)) return true;

  // compat: ancien format peut être map OU tableau
  if (isNonEmptyMap(item?.piece_overrides)) return true;
  if (Array.isArray(item?.piece_overrides)) {
    return item.piece_overrides.some((o: any) => {
      const ref = String(o?.piece_ref ?? "").trim();
      const q = Number(o?.quantity ?? 0);
      return ref.length > 0 && Number.isFinite(q) && q > 0;
    });
  }

  return false;
}
/**
 * Validation d'une ligne de vente (SaleItemDraft).
 */
function validateSaleItemDraft(
  item: SaleItemDraft,
  index: number,
  saleType: SaleType,
  errors: CreateSaleValidationError[],
  ctx: { isPackSetSale: boolean }
) {
  const prefix = `items[${index}]`;

  // Cohérence entre sale_type global et item_kind
  if (saleType === "SET" && item.item_kind !== "SET") {
    errors.push({
      field: `${prefix}.item_kind`,
      message:
        "Pour une vente de type SET, toutes les lignes doivent être de type SET.",
    });
  }
  if (saleType === "PIECE" && item.item_kind !== "PIECE") {
    errors.push({
      field: `${prefix}.item_kind`,
      message:
        "Pour une vente de type PIECE, toutes les lignes doivent être de type PIECE.",
    });
  }

  // Quantité
  const qty = Number(item.quantity ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    errors.push({
      field: `${prefix}.quantity`,
      message: "La quantité doit être un nombre strictement positif.",
    });
  }

  // Champs obligatoires selon item_kind
  if (item.item_kind === "PIECE") {
    if (!item.piece_ref) {
      errors.push({
        field: `${prefix}.piece_ref`,
        message:
          "Pour une ligne de type PIECE, la référence de pièce (piece_ref) est requise.",
      });
    }
  } else if (item.item_kind === "SET") {
    if (!item.set_id) {
      errors.push({
        field: `${prefix}.set_id`,
        message:
          "Pour une ligne de type SET, l'identifiant du set (set_id) est requis.",
      });
    }
  
    // ✅ Set partiel => overrides obligatoires
    if (item.is_partial_set === true && !hasNonEmptyOverrides(item)) {
      errors.push({
        field: `${prefix}.overrides`,
        message:
          "Pour un set partiel, tu dois renseigner le détail des pièces (overrides).",
      });
    }
  
    // ✅ Mode pack: net_amount requis par set
    if (ctx.isPackSetSale) {
      const netLine = Number(item.net_amount);
      if (!Number.isFinite(netLine) || netLine <= 0) {
        errors.push({
          field: `${prefix}.net_amount`,
          message:
            "En mode pack (plusieurs sets), le 'Tarif réparti par set' est obligatoire et doit être > 0.",
        });
      }
    }
  } else {
    const unknownKind = (item as any)?.item_kind;

    errors.push({
      field: `${prefix}.item_kind`,
      message: `Type de ligne de vente non supporté: ${String(unknownKind)}.`,
    });
  }
}

/**
 * 3.4.4.2 - Server action de création de vente
 */
export async function createSaleAction(
  draft: SaleDraft
): Promise<CreateSaleActionResult> {
  try {
    const validationErrors = validateSaleDraft(draft);

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: "Données de vente invalides. Merci de corriger les champs.",
        debug: { validationErrors },
      };
    }

    // 1) Insertion dans sales
    const currency = draft.currency ?? "EUR";
    const net = Number(draft.net_seller_amount);

    const saleInsert: SaleInsert = {
      sale_type: draft.sale_type,
      sales_channel: String(draft.sales_channel),
      net_seller_amount: net,
      paid_at: draft.paid_at,
      status: "CONFIRMED",
      currency,
      comment: draft.comment ?? null,

      total_cost_amount: 0,
      total_margin_amount: 0,
      margin_rate: null,

      buyer_paid_total: null,
      vat_rate: null,
      sale_number: null,
    };

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert(saleInsert)
      .select("*")
      .single();

    if (saleError || !sale) {
      console.error(
        "createSaleAction - erreur lors de l'insertion dans sales:",
        saleError
      );
      return {
        success: false,
        error:
          "Impossible de créer la vente (erreur lors de l'insertion dans la table sales).",
        debug: { saleError },
      };
    }

    const isSingleSetSale = draft.sale_type === "SET" && draft.items.length === 1;

    // 2) Insertion dans sale_items

    // Normalise les overrides (mapping piece_ref -> qty) pour être sûr de stocker un JSON propre.
    const normalizeOverrides = (v: unknown): Record<string, number> | null => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return null;
      const raw = v as Record<string, unknown>;
      const cleaned: Record<string, number> = {};

      for (const [k, val] of Object.entries(raw)) {
        const key = String(k ?? "").trim();
        const n = Number(val as any);
        if (!key) continue;
        if (!Number.isFinite(n) || n <= 0) continue;
        cleaned[key] = n;
      }

      return Object.keys(cleaned).length > 0 ? cleaned : null;
    };

    const buildItemInsert = (
      item: SaleItemDraft,
      index: number,
      opts: { includeOverrides: boolean }
    ): SaleItemInsertDb => {
      const quantity = Number(item.quantity ?? 0);

      const resolvedNetAmount =
        isSingleSetSale && item.item_kind === "SET" ? net : item.net_amount ?? null;

      const base: SaleItemInsertDb = {
        sale_id: sale.id,
        line_index: index,
        item_kind: item.item_kind,
        quantity,
        is_partial_set: item.is_partial_set ?? false,
        comment: item.comment ?? null,
        net_amount: resolvedNetAmount,
        cost_amount: null,
        margin_amount: null,
        set_id: null,
        piece_ref: null,
        // overrides: will be set below if needed
      };

      if (item.item_kind === "SET") {
        base.set_id = item.set_id ?? null;

        if (opts.includeOverrides) {
          const ov =
            normalizeOverrides((item as any).overrides) ??
            normalizeOverrides((item as any).piece_overrides);

            base.overrides = ov; // null ou JSON clean
        }
      } else {
        base.piece_ref = item.piece_ref ?? null;
        // pas d'overrides pour PIECE
      }

      return base;
    };

    // Tentative 1: insert AVEC overrides (si la colonne existe).
    const itemsInsertWithOverrides: SaleItemInsertDb[] = draft.items.map((item, index) =>
      buildItemInsert(item, index, { includeOverrides: true })
    );

    // Fallback: si la colonne `overrides` n'existe pas (schema cache PostgREST non à jour, ou DB sans colonne),
    // on réinsère sans ce champ pour ne pas bloquer la création de vente.
    const itemsInsertWithoutOverrides: SaleItemInsertDb[] = draft.items.map((item, index) =>
      buildItemInsert(item, index, { includeOverrides: false })
    );

    let insertedItemsRaw: SaleItemDbRow[] | null = null;
    let itemsError: any = null;

    // 1) essai avec overrides
    const attempt1 = await supabase
      .from("sale_items")
      .insert(itemsInsertWithOverrides)
      .select("*");

    insertedItemsRaw = attempt1.data ?? null;
    itemsError = attempt1.error ?? null;

    // 2) fallback si erreur typique "column overrides" / "schema cache" (PostgREST)
    if (
      itemsError &&
      typeof itemsError.message === "string" &&
      /overrides/i.test(itemsError.message) &&
      /(schema cache|column)/i.test(itemsError.message)
    ) {
      const attempt2 = await supabase
        .from("sale_items")
        .insert(itemsInsertWithoutOverrides)
        .select("*");

      insertedItemsRaw = attempt2.data ?? null;
      itemsError = attempt2.error ?? null;
    }

    const insertedItems = (insertedItemsRaw ?? []) as SaleItemRow[];

    if (itemsError || insertedItems.length === 0) {
      console.error(
        "createSaleAction - erreur lors de l'insertion dans sale_items:",
        itemsError
      );

      try {
        await supabase.from("sales").delete().eq("id", sale.id);
      } catch (cleanupError) {
        console.error(
          "createSaleAction - erreur lors du cleanup après échec sale_items:",
          cleanupError
        );
      }

      return {
        success: false,
        error: "Impossible de créer les lignes de vente (sale_items). La vente a été annulée.",
        debug: {
          itemsError: {
            message: itemsError?.message,
            code: itemsError?.code,
            details: itemsError?.details,
            hint: itemsError?.hint,
          },
        },
      };
    }

    // 3) FIFO + mouvements OUT dans stock_movements + calcul des coûts/marges
    try {
      const movementsToInsert: StockMovementInsertDb[] = [];

      const saleItemPiecesToInsert: SaleItemPiecesInsertDb[] = [];

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

      let totalCost = 0;

      const sortedItems = [...insertedItems].sort(
        (a, b) => (a.line_index ?? 0) - (b.line_index ?? 0)
      );

      for (const dbItem of sortedItems) {
        const idx = Number(dbItem.line_index ?? 0);
        if (!draft.items[idx]) continue;

        const itemForDemand: SaleItemDraft =
        dbItem.item_kind === "SET"
    ? {
        item_kind: "SET",
        set_id: String(dbItem.set_id ?? ""),
        quantity: Number(dbItem.quantity ?? 1),
        is_partial_set: Boolean(dbItem.is_partial_set),
        net_amount: dbItem.net_amount ?? null,
        overrides: normalizeOverrides(dbItem.overrides) ?? undefined,
        comment: dbItem.comment ?? null,
      }
    : {
        item_kind: "PIECE",
        piece_ref: String(dbItem.piece_ref ?? ""),
        quantity: Number(dbItem.quantity ?? 1),
        is_partial_set: Boolean(dbItem.is_partial_set),
        net_amount: dbItem.net_amount ?? null,
        comment: dbItem.comment ?? null,
      };

        const demands = await getPiecesForSaleItem(itemForDemand);

        let lineCost = 0;

        for (const demand of demands) {
          const pieceRef = (demand.piece_ref ?? "").trim();
          const qtyNeeded = Number(demand.quantity ?? 0);

          if (!pieceRef || !Number.isFinite(qtyNeeded) || qtyNeeded <= 0) continue;

          const fifoRes = await allocateFifoForPiece(pieceRef, qtyNeeded);
          const chunks = fifoRes.chunks;

          if (!Array.isArray(chunks)) {
            throw new Error(`Réponse FIFO invalide pour ${pieceRef}`);
          }

          for (const c of chunks) {
            const q = Number(c.quantity ?? 0);
            const uc = Number(c.unitCost ?? 0);

            if (!Number.isFinite(q) || q <= 0) continue;

            const safeUnitCost = Number.isFinite(uc) ? uc : 0;
            const safeLotId = toNullableInt((c as Record<string, unknown>)["lotId"]);
            if (safeLotId === null) {
              throw new Error(`LotId invalide (FIFO) pour ${pieceRef}`);
            }

            movementsToInsert.push({
              piece_ref: pieceRef,
              lot_id: safeLotId,
              direction: "OUT",
              quantity: q,
              unit_cost: safeUnitCost,
              source_type: "SALE",
              source_id: String(dbItem.id),
              comment: `Vente #${sale.id}`,
            });

            saleItemPiecesToInsert.push({
              sale_id: sale.id,
              sale_item_id: dbItem.id,
              piece_ref: pieceRef,
              quantity: q,
              unit_cost: safeUnitCost,
              lot_id: safeLotId,
            });

            lineCost += q * safeUnitCost;
          }
        }

        totalCost += lineCost;

        const lineNet = Number(dbItem.net_amount ?? 0);
        const lineNetIsOk = Number.isFinite(lineNet) && lineNet > 0;

        const { error: updErr } = await supabase
          .from("sale_items")
          .update({
            cost_amount: lineCost,
            margin_amount: lineNetIsOk ? lineNet - lineCost : null,
          })
          .eq("id", dbItem.id);

        if (updErr) {
          throw new Error(
            `Impossible de mettre à jour cost/marge sur sale_items(${dbItem.id}).`
          );
        }
      }

      // 3.4) Insert des mouvements OUT
      if (movementsToInsert.length > 0) {
        const { error: movErr } = await supabase
          .from("stock_movements")
          .insert(movementsToInsert);

        if (movErr) throw movErr;
      }

      // 3.4 bis) Snapshot des pièces consommées (sale_item_pieces)
      if (saleItemPiecesToInsert.length > 0) {
        const { error: snapErr } = await supabase
          .from("sale_item_pieces")
          .insert(saleItemPiecesToInsert);

        if (snapErr) {
          throw new Error(
            `Impossible d'enregistrer le snapshot des pièces consommées (sale_item_pieces). ${snapErr.message}`
          );
        }
      }

      // 3.5) Update totals sur sales
      const netSale = Number(sale.net_seller_amount ?? 0);
      const totalMargin = netSale - totalCost;
      const marginRate = netSale > 0 ? totalMargin / netSale : null;

      const { error: saleUpdErr } = await supabase
        .from("sales")
        .update({
          total_cost_amount: totalCost,
          total_margin_amount: totalMargin,
          margin_rate: marginRate,
        })
        .eq("id", sale.id);

      if (saleUpdErr) {
        throw new Error("Impossible de mettre à jour les totaux de la vente.");
      }
    } catch (fifoErr: any) {
      console.error("createSaleAction - erreur FIFO/stock_movements:", fifoErr);

      try {
        const saleItemIds = insertedItems.map(i => String(i.id));

        await supabase
          .from("sale_item_pieces")
          .delete()
          .eq("sale_id", sale.id);

        if (saleItemIds.length > 0) {
          await supabase
            .from("stock_movements")
            .delete()
            .eq("source_type", "SALE")
            .in("source_id", saleItemIds);
        }

        // ✅ rollback “vente” lui-même
        await supabase.from("sale_items").delete().eq("sale_id", sale.id);
        await supabase.from("sales").delete().eq("id", sale.id);
      } catch (e) {
        console.error("cleanup failed:", e);
      }

      return {
        success: false,
        error:
          fifoErr?.message ??
          "Erreur lors de la consommation de stock (FIFO). Vente annulée.",
        debug: { fifoErr },
      };
    }

    return {
      success: true,
      saleId: sale.id,
      debug: {
        sale,
        items: insertedItems,
      },
    };
  } catch (e) {
    console.error("createSaleAction - exception:", e);
    return {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : "Erreur inattendue lors de la création de la vente.",
      debug: { e },
    };
  }
}

// ---- 3.2.4.1 - Chargement des données de la vente pour annulation ----

type LoadedSaleForCancel = {
  sale: SaleRow;
  items: SaleItemRow[];
};

async function loadSaleForCancel(saleId: number): Promise<LoadedSaleForCancel> {
  const id = Number(saleId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Identifiant de vente invalide pour l'annulation.");
  }

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .single();

  if (saleError || !sale) {
    console.error("loadSaleForCancel - vente introuvable:", saleError);
    throw new Error("Vente introuvable pour l'annulation.");
  }

  if (sale.status === "CANCELLED") {
    throw new Error("Cette vente est déjà annulée.");
  }
  if (sale.status !== "CONFIRMED") {
    throw new Error(
      "Seules les ventes confirmées peuvent être annulées pour l'instant."
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", id)
    .order("line_index", { ascending: true });

  if (itemsError || !items) {
    console.error(
      "loadSaleForCancel - erreur lors du chargement des lignes de vente:",
      itemsError
    );
    throw new Error(
      "Impossible de charger les lignes de vente pour l'annulation."
    );
  }

  if (items.length === 0) {
    throw new Error(
      "Cette vente ne contient aucune ligne. Annulation impossible."
    );
  }

  return {
    sale: sale as SaleRow,
    items: items as SaleItemRow[],
  };
}

const toNullableBigintString = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  return null;
};

async function loadSaleOutMovementsForCancel(
  saleId: number
): Promise<{
  sale: SaleRow;
  items: SaleItemRow[];
  movements: StockMovementDbRow[];
}> {
  const { sale, items } = await loadSaleForCancel(saleId);

  const itemIds = items.map((item) => item.id.toString());
  if (itemIds.length === 0) {
    throw new Error(
      "Cette vente ne contient aucune ligne de vente. Annulation impossible."
    );
  }

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("direction", "OUT")
    .eq("source_type", "SALE")
    .in("source_id", itemIds);

  if (movementsError || !movements) {
    console.error(
      "loadSaleOutMovementsForCancel - erreur lors du chargement des mouvements de stock OUT:",
      movementsError
    );
    throw new Error(
      "Impossible de charger les mouvements de stock liés à cette vente."
    );
  }

  return {
    sale: sale as SaleRow,
    items: items as SaleItemRow[],
    movements: (movements ?? []) as StockMovementDbRow[],
  };
}

// ---- 3.2.4.3 - Annulation de vente ----

export type CancelSaleResult =
  | {
      ok: true;
      errors: [];
      saleId: number;
      sale: SaleRow;
      items: SaleItemRow[];
      movementsCreated: number;
    }
  | {
      ok: false;
      errors: CreateSaleValidationError[];
    };

export async function cancelSaleAction(
  saleId: number
): Promise<CancelSaleResult> {
  let loaded;
  try {
    loaded = await loadSaleOutMovementsForCancel(saleId);
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Impossible de charger les données pour l'annulation de la vente.";

    return {
      ok: false,
      errors: [{ field: "root", message }],
    };
  }

  const { sale, items, movements } = loaded;

  const mirrorMovements: StockMovementInsertDb[] = movements.map((m) => ({
    piece_ref: m.piece_ref,
    lot_id: m.lot_id,
    direction: "IN",
    quantity: m.quantity,
    unit_cost: m.unit_cost,
    source_type: "SALE_CANCEL",
    source_id: m.source_id,
    comment: `Annulation de la vente #${sale.id}`,
  }));

  if (mirrorMovements.length > 0) {
    const { error: insertError } = await supabase
      .from("stock_movements")
      .insert(mirrorMovements);

    if (insertError) {
      console.error(
        "cancelSaleAction - erreur lors de l'insertion des mouvements IN miroirs:",
        insertError
      );
      return {
        ok: false,
        errors: [
          {
            field: "root",
            message:
              "Impossible de créer les mouvements de stock pour l'annulation de la vente.",
          },
        ],
      };
    }
  }

  let updatedSale: SaleRow = sale;

  try {
    const { data: saleUpdate, error: saleUpdateError } = await supabase
      .from("sales")
      .update({ status: "CANCELLED" })
      .eq("id", sale.id)
      .select("*")
      .single();

    if (saleUpdateError || !saleUpdate) {
      console.error(
        "cancelSaleAction - erreur lors de la mise à jour du statut de la vente:",
        saleUpdateError
      );
    } else {
      updatedSale = saleUpdate as SaleRow;
    }
  } catch (e) {
    console.error(
      "cancelSaleAction - exception lors de la mise à jour du statut de la vente:",
      e
    );
  }

  return {
    ok: true,
    errors: [],
    saleId: sale.id,
    sale: updatedSale,
    items,
    movementsCreated: mirrorMovements.length,
  };
}

// ---- 3.2.5 - Mise à jour des métadonnées de la vente (updateSaleMeta) ----

export type UpdateSaleMetaPayload = {
  comment?: string | null;
  sales_channel?: string;
  paid_at?: string;
  net_seller_amount?: number;
  buyer_paid_total?: number | null;
  vat_rate?: number | null;
  sale_number?: string | null;
};

export type UpdateSaleMetaResult =
  | { ok: true; errors: []; saleId: number }
  | { ok: false; errors: CreateSaleValidationError[] };

function validateUpdateSaleMetaInput(
  saleId: number,
  payload: UpdateSaleMetaPayload
): CreateSaleValidationError[] {
  const errors: CreateSaleValidationError[] = [];

  const id = Number(saleId);
  if (!Number.isFinite(id) || id <= 0) {
    errors.push({ field: "saleId", message: "Identifiant de vente invalide." });
  }

  const hasAnyField =
    payload.comment !== undefined ||
    payload.sales_channel !== undefined ||
    payload.paid_at !== undefined ||
    payload.net_seller_amount !== undefined ||
    payload.buyer_paid_total !== undefined ||
    payload.vat_rate !== undefined ||
    payload.sale_number !== undefined;

  if (!hasAnyField) {
    errors.push({
      field: "root",
      message:
        "Aucune donnée de métadonnée fournie pour la mise à jour de la vente.",
    });
    return errors;
  }

  if (payload.sales_channel !== undefined) {
    const ch = String(payload.sales_channel).trim();
    if (ch.length === 0) {
      errors.push({
        field: "sales_channel",
        message: "Le canal de vente ne peut pas être une chaîne vide.",
      });
    }
  }

  if (payload.paid_at !== undefined) {
    const d = new Date(payload.paid_at);
    if (Number.isNaN(d.getTime())) {
      errors.push({
        field: "paid_at",
        message: "La date de paiement fournie n'est pas valide.",
      });
    }
  }

  if (payload.net_seller_amount !== undefined) {
    const net = Number(payload.net_seller_amount);
    if (!Number.isFinite(net) || net < 0) {
      errors.push({
        field: "net_seller_amount",
        message: "Le montant net vendeur doit être un nombre positif ou nul.",
      });
    }
  }

  if (
    payload.buyer_paid_total !== undefined &&
    payload.buyer_paid_total !== null
  ) {
    const buyerTotal = Number(payload.buyer_paid_total);
    if (!Number.isFinite(buyerTotal) || buyerTotal < 0) {
      errors.push({
        field: "buyer_paid_total",
        message:
          "Le montant total payé par l'acheteur doit être un nombre positif ou nul.",
      });
    }
  }

  if (payload.vat_rate !== undefined && payload.vat_rate !== null) {
    const vat = Number(payload.vat_rate);
    if (!Number.isFinite(vat) || vat < 0) {
      errors.push({
        field: "vat_rate",
        message:
          "Le taux de TVA doit être un nombre positif ou nul (ex: 0, 5.5, 20).",
      });
    }
  }

  if (payload.sale_number !== undefined && payload.sale_number !== null) {
    const num = String(payload.sale_number).trim();
    if (num.length === 0) {
      errors.push({
        field: "sale_number",
        message: "Le numéro de vente ne peut pas être une chaîne vide.",
      });
    }
  }

  return errors;
}

export async function updateSaleMetaAction(
  saleId: number,
  payload: UpdateSaleMetaPayload
): Promise<UpdateSaleMetaResult> {
  const errors = validateUpdateSaleMetaInput(saleId, payload);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const id = Number(saleId);

  const { data: existing, error: existingError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    console.error(
      "updateSaleMetaAction - vente introuvable pour mise à jour:",
      existingError
    );
    return {
      ok: false,
      errors: [{ field: "root", message: "Vente introuvable pour mise à jour." }],
    };
  }

  if (existing.status === "CANCELLED") {
    return {
      ok: false,
      errors: [{ field: "root", message: "Impossible de modifier une vente annulée." }],
    };
  }

  const update: SaleUpdate = {};

  if (payload.comment !== undefined) update.comment = payload.comment;
  if (payload.sales_channel !== undefined)
    update.sales_channel = String(payload.sales_channel);
  if (payload.paid_at !== undefined) update.paid_at = payload.paid_at;

  let netChanged = false;
  let newNet: number | undefined = undefined;

  if (payload.net_seller_amount !== undefined) {
    const net = Number(payload.net_seller_amount);
    update.net_seller_amount = net;
    netChanged = true;
    newNet = net;
  }

  if (payload.buyer_paid_total !== undefined && payload.buyer_paid_total !== null) {
    update.buyer_paid_total = Number(payload.buyer_paid_total);
  } else if (payload.buyer_paid_total !== undefined) {
    update.buyer_paid_total = null;
  }

  if (payload.vat_rate !== undefined && payload.vat_rate !== null) {
    update.vat_rate = Number(payload.vat_rate);
  } else if (payload.vat_rate !== undefined) {
    update.vat_rate = null;
  }

  if (payload.sale_number !== undefined) {
    update.sale_number =
      payload.sale_number !== null ? String(payload.sale_number) : null;
  }

  if (netChanged && newNet !== undefined) {
    const cost = Number(existing.total_cost_amount ?? 0);
    const totalMargin = newNet - cost;
    update.total_margin_amount = totalMargin;
    update.margin_rate = newNet > 0 ? totalMargin / newNet : null;
  }

  const { error: updateError } = await supabase
    .from("sales")
    .update(update)
    .eq("id", id);

  if (updateError) {
    console.error(
      "updateSaleMetaAction - erreur lors de la mise à jour de la vente:",
      updateError
    );
    return {
      ok: false,
      errors: [
        { field: "root", message: "Impossible de mettre à jour les métadonnées de la vente." },
      ],
    };
  }

  return { ok: true, errors: [], saleId: id };
}

// 3.6.x - Suppression d'une vente (données de test / admin)
export async function deleteSaleAction(saleId: number) {
  const id = Number(saleId);

  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: "saleId invalide" };
  }

  // 1) Charger les sale_items de la vente (pour supprimer les mouvements)
  const { data: items, error: itemsError } = await supabase
    .from("sale_items")
    .select("id")
    .eq("sale_id", id)
    .returns<SaleItemIdRow[]>();

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  const saleItemIds = (items ?? []).map((x) => String(x.id));

  // 2) Supprimer snapshot sale_item_pieces
  const { error: sipError } = await supabase
    .from("sale_item_pieces")
    .delete()
    .eq("sale_id", id);

  if (sipError) {
    return { success: false, error: sipError.message };
  }

  // 3) Supprimer mouvements de vente (SALE + SALE_CANCEL)
  if (saleItemIds.length > 0) {
    const { error: mvError } = await supabase
      .from("stock_movements")
      .delete()
      .in("source_type", ["SALE", "SALE_CANCEL"])
      .in("source_id", saleItemIds);

    if (mvError) {
      return { success: false, error: mvError.message };
    }
  }

  // 4) Supprimer sale_items
  const { error: siError } = await supabase
    .from("sale_items")
    .delete()
    .eq("sale_id", id);

  if (siError) {
    return { success: false, error: siError.message };
  }

  // 5) Supprimer sale
  const { error: sError } = await supabase.from("sales").delete().eq("id", id);

  if (sError) {
    return { success: false, error: sError.message };
  }

  return { success: true };
}