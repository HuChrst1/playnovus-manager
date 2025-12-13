"use server";

import { supabase } from "@/lib/supabase";
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

  // sales_channel (on accepte pour l'instant n'importe quel string non vide)
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
    draft.items.forEach((item, index) => {
      validateSaleItemDraft(
        item,
        index,
        draft.sale_type as SaleType,
        errors
      );
    });
  }

  return errors;
}

/**
 * Validation d'une ligne de vente (SaleItemDraft).
 */
function validateSaleItemDraft(
  item: SaleItemDraft,
  index: number,
  saleType: SaleType,
  errors: CreateSaleValidationError[]
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
  } else {
    // TS sait déjà que item_kind est "SET" | "PIECE" ⇒ ce bloc devient unreachable (item = never).
    // On garde quand même une erreur runtime au cas où des données invalides arrivent.
    const unknownKind = (item as any)?.item_kind;

    errors.push({
      field: `${prefix}.item_kind`,
      message: `Type de ligne de vente non supporté: ${String(unknownKind)}.`,
    });
  }
}

/**
 * 3.4.4.2 - Server action de création de vente
 *
 * Phase "stub minimal" :
 * - Valide le draft
 * - Insère dans `sales` + `sale_items`
 * - Ne touche pas encore au stock (FIFO)
 * - Initialise au minimum les totaux de coût/marge à 0
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

      // Phase stub : pas de calcul FIFO -> totaux init à 0
      total_cost_amount: 0,
      total_margin_amount: 0,
      margin_rate: null,

      // Champs optionnels/à venir
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

    // 2) Insertion dans sale_items
    const itemsInsert: SaleItemInsert[] = draft.items.map((item, index) => {
      const quantity = Number(item.quantity ?? 0);

      const base: SaleItemInsert = {
        sale_id: sale.id,
        line_index: index,
        item_kind: item.item_kind,
        quantity,
        is_partial_set: item.is_partial_set ?? false,
        comment: item.comment ?? null,
        net_amount: item.net_amount ?? null,

        // Phase stub : coûts/marges ligne non calculés
        cost_amount: null,
        margin_amount: null,

        set_id: null,
        piece_ref: null,
      };

      if (item.item_kind === "SET") {
        base.set_id = item.set_id ?? null;
      } else {
        base.piece_ref = item.piece_ref ?? null;
      }

      return base;
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("sale_items")
      .insert(itemsInsert)
      .select("*");

    if (itemsError || !insertedItems) {
      console.error(
        "createSaleAction - erreur lors de l'insertion dans sale_items:",
        itemsError
      );

      // Cleanup best-effort : si les lignes échouent, on supprime la vente créée
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
        error:
          "Impossible de créer les lignes de vente (sale_items). La vente a été annulée.",
        debug: { itemsError },
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

/**
 * Charge une vente et ses lignes pour une éventuelle annulation.
 * - Vérifie que l'ID est valide
 * - Vérifie que la vente existe
 * - Vérifie que la vente est encore confirmée (non déjà annulée)
 */
async function loadSaleForCancel(saleId: number): Promise<LoadedSaleForCancel> {
  const id = Number(saleId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Identifiant de vente invalide pour l'annulation.");
  }

  // 1) Charger la vente
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .single();

  if (saleError || !sale) {
    console.error("loadSaleForCancel - vente introuvable:", saleError);
    throw new Error("Vente introuvable pour l'annulation.");
  }

  // On ne permet d'annuler que les ventes confirmées
  if (sale.status === "CANCELLED") {
    throw new Error("Cette vente est déjà annulée.");
  }
  if (sale.status !== "CONFIRMED") {
    throw new Error(
      "Seules les ventes confirmées peuvent être annulées pour l'instant."
    );
  }

  // 2) Charger les lignes de vente
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

/**
 * Charge tous les mouvements de stock OUT liés à une vente,
 * c'est-à-dire les mouvements:
 *  - direction = 'OUT'
 *  - source_type = 'SALE'
 *  - source_id ∈ (ids des lignes de la vente)
 *
 * Cette fonction s'appuie sur loadSaleForCancel pour s'assurer
 * que la vente existe et est annulable.
 */
async function loadSaleOutMovementsForCancel(
  saleId: number
): Promise<{
  sale: SaleRow;
  items: SaleItemRow[];
  movements: StockMovementRow[];
}> {
  // On commence par charger la vente et ses lignes (validation incluse)
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

  if (movements.length === 0) {
    console.warn(
      "loadSaleOutMovementsForCancel - aucun mouvement OUT trouvé pour cette vente."
    );
  }

  return {
    sale: sale as SaleRow,
    items: items as SaleItemRow[],
    movements: movements as StockMovementRow[],
  };
}

// ---- 3.2.4.3 - Annulation de vente : mouvements IN miroirs + statut ----

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

/**
 * Annule une vente :
 *  - recharge la vente + lignes + mouvements OUT existants
 *  - crée des mouvements IN miroirs (SALE_CANCEL) avec les mêmes coûts unitaires
 *  - met à jour le statut de la vente en CANCELLED
 *
 * Le stock est ainsi remis dans l'état "comme avant la vente".
 */
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
      errors: [
        {
          field: "root",
          message,
        },
      ],
    };
  }

  const { sale, items, movements } = loaded;

  // 1) Construire les mouvements IN miroirs
  const mirrorMovements: StockMovementInsert[] = movements.map((m) => ({
    piece_ref: m.piece_ref,
    lot_id: m.lot_id,
    direction: "IN",
    quantity: m.quantity,
    unit_cost: m.unit_cost,
    source_type: "SALE_CANCEL",
    source_id: m.source_id,
    comment: `Annulation de la vente #${sale.id}`,
  }));

  // 2) Insérer les mouvements IN
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

  // 3) Mettre à jour le statut de la vente en CANCELLED
  let updatedSale: SaleRow = sale;

  try {
    const { data: saleUpdate, error: saleUpdateError } = await supabase
      .from("sales")
      .update({
        status: "CANCELLED",
      })
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
  // Ces champs ne sont pas NULLABLE en base : si on les fournit, on doit donner une valeur non nulle.
  sales_channel?: string;
  paid_at?: string;
  net_seller_amount?: number;
  // Ces champs sont nullable en base : on peut explicitement les mettre à null.
  buyer_paid_total?: number | null;
  vat_rate?: number | null;
  sale_number?: string | null;
};

export type UpdateSaleMetaResult =
  | {
      ok: true;
      errors: [];
      saleId: number;
    }
  | {
      ok: false;
      errors: CreateSaleValidationError[];
    };

/**
 * Validation de base pour la mise à jour des métadonnées d'une vente.
 * Ne touche pas à la base de données.
 */
function validateUpdateSaleMetaInput(
  saleId: number,
  payload: UpdateSaleMetaPayload
): CreateSaleValidationError[] {
  const errors: CreateSaleValidationError[] = [];

  const id = Number(saleId);
  if (!Number.isFinite(id) || id <= 0) {
    errors.push({
      field: "saleId",
      message: "Identifiant de vente invalide.",
    });
  }

  // Si aucun champ n'est fourni, on considère que la requête est vide
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

  // sales_channel : si fourni, ne doit pas être une chaîne vide
  if (payload.sales_channel !== undefined) {
    const ch = String(payload.sales_channel).trim();
    if (ch.length === 0) {
      errors.push({
        field: "sales_channel",
        message: "Le canal de vente ne peut pas être une chaîne vide.",
      });
    }
  }

  // paid_at : si fourni, doit être une date valide
  if (payload.paid_at !== undefined) {
    const d = new Date(payload.paid_at);
    if (Number.isNaN(d.getTime())) {
      errors.push({
        field: "paid_at",
        message: "La date de paiement fournie n'est pas valide.",
      });
    }
  }

  // net_seller_amount : si fourni, doit être un nombre >= 0
  if (payload.net_seller_amount !== undefined) {
    const net = Number(payload.net_seller_amount);
    if (!Number.isFinite(net) || net < 0) {
      errors.push({
        field: "net_seller_amount",
        message:
          "Le montant net vendeur doit être un nombre positif ou nul.",
      });
    }
  }

  // buyer_paid_total : si fourni, doit être un nombre >= 0
  if (payload.buyer_paid_total !== undefined && payload.buyer_paid_total !== null) {
    const buyerTotal = Number(payload.buyer_paid_total);
    if (!Number.isFinite(buyerTotal) || buyerTotal < 0) {
      errors.push({
        field: "buyer_paid_total",
        message:
          "Le montant total payé par l'acheteur doit être un nombre positif ou nul.",
      });
    }
  }

  // vat_rate : si fourni, doit être un nombre >= 0
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

  // sale_number : si fourni, on accepte les chaînes non vides uniquement
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

/**
 * Server action de mise à jour des métadonnées d'une vente.
 *
 * Ce snippet (3.2.5.1) se concentre sur la signature et la validation.
 * La logique d'UPDATE en base sera ajoutée dans 3.2.5.2.
 */
export async function updateSaleMetaAction(
  saleId: number,
  payload: UpdateSaleMetaPayload
): Promise<UpdateSaleMetaResult> {
  const errors = validateUpdateSaleMetaInput(saleId, payload);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  const id = Number(saleId);

  // 1) Charger la vente existante
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
      errors: [
        {
          field: "root",
          message: "Vente introuvable pour mise à jour.",
        },
      ],
    };
  }

  // Option : empêcher la modification des ventes annulées
  if (existing.status === "CANCELLED") {
    return {
      ok: false,
      errors: [
        {
          field: "root",
          message: "Impossible de modifier une vente annulée.",
        },
      ],
    };
  }

  const update: SaleUpdate = {};

  // Commentaire
  if (payload.comment !== undefined) {
    update.comment = payload.comment;
  }

  // Canal de vente
  if (payload.sales_channel !== undefined) {
    update.sales_channel = String(payload.sales_channel);
  }

  // Date de paiement
  if (payload.paid_at !== undefined) {
    update.paid_at = payload.paid_at;
  }

  // Montant net vendeur
  let netChanged = false;
  let newNet: number | undefined = undefined;

  if (payload.net_seller_amount !== undefined) {
    const net = Number(payload.net_seller_amount);
    update.net_seller_amount = net;
    netChanged = true;
    newNet = net;
  }

  // Montant total payé par l'acheteur
  if (
    payload.buyer_paid_total !== undefined &&
    payload.buyer_paid_total !== null
  ) {
    update.buyer_paid_total = Number(payload.buyer_paid_total);
  } else if (payload.buyer_paid_total !== undefined) {
    update.buyer_paid_total = null;
  }

  // Taux de TVA
  if (payload.vat_rate !== undefined && payload.vat_rate !== null) {
    update.vat_rate = Number(payload.vat_rate);
  } else if (payload.vat_rate !== undefined) {
    update.vat_rate = null;
  }

  // Numéro de vente
  if (payload.sale_number !== undefined) {
    update.sale_number =
      payload.sale_number !== null
        ? String(payload.sale_number)
        : null;
  }

  // Si le net change, on recalcule la marge totale et le taux
  if (netChanged && newNet !== undefined) {
    const cost = Number(existing.total_cost_amount ?? 0);
    const totalMargin = newNet - cost;
    update.total_margin_amount = totalMargin;
    update.margin_rate = newNet > 0 ? totalMargin / newNet : null;
  }

  // 2) Appliquer la mise à jour
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
        {
          field: "root",
          message:
            "Impossible de mettre à jour les métadonnées de la vente.",
        },
      ],
    };
  }

  return {
    ok: true,
    errors: [],
    saleId: id,
  };
}