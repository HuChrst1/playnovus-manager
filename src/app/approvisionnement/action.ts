"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { TablesUpdate } from "@/types/supabase";

type LotStatus = "draft" | "confirmed";
const DIRECT_CONFIRMED_CREATE_ERROR =
  "La création directe d'un lot confirmé n'est pas autorisée. Crée d'abord le lot en brouillon.";

export type CreateLotInput = {
  purchaseDate: string;          // YYYY-MM-DD
  label?: string;
  supplier?: string;
  totalCost: number;
  totalPieces?: number;
  status?: "draft" | "confirmed";
  notes?: string;
};

type NormalizedLot = {
  purchaseDate: string;
  label: string | null;
  supplier: string | null;
  totalCost: number;
  totalPieces: number;
  status: "draft" | "confirmed";
  notes: string | null;
};

const LOT_CODE_PREFIX = "LOT_";
const LOT_CODE_REGEX = /^LOT_(\d+)$/;
const LOT_CODE_INSERT_RETRY_MAX = 3;

type LotActionReason =
  | "LOT_NOT_FOUND"
  | "LOT_INITIAL_PROTECTED"
  | "LOT_USED_BY_SALES"
  | "DELETE_FAILED"
  | "UPDATE_FAILED";

type LotActionFailure = {
  success: false;
  error: string;
  reason?: LotActionReason;
  linkedSaleIds?: number[];
  linkedSalesCount?: number;
};

type LotActionSuccess = {
  success: true;
  warning?: string;
};

export type UpdateLotResult = LotActionSuccess | LotActionFailure;
export type DeleteLotResult = LotActionSuccess | LotActionFailure;

type LotSalesUsage = {
  usedBySales: boolean;
  linkedSaleIds: number[];
  linkedSalesCount: number;
  error?: string;
};

type NextLotCodeResult =
  | {
      success: true;
      lotCode: string;
    }
  | {
      success: false;
      error: string;
    };

type RenumberLotsResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

const extractLotSequence = (lotCode: string | null): number | null => {
  if (!lotCode) {
    return null;
  }

  const match = lotCode.trim().match(LOT_CODE_REGEX);
  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);
  if (!Number.isInteger(sequence) || sequence < 0) {
    return null;
  }

  return sequence;
};

const isLotCodeUniqueViolation = (error: {
  code?: string;
  message?: string;
}) => {
  if (error.code === "23505") {
    return true;
  }

  return (error.message ?? "").includes("lots_lot_code_key");
};

async function computeNextLotCode(): Promise<NextLotCodeResult> {
  const { data, error } = await supabase
    .from("lots")
    .select("lot_code")
    .like("lot_code", `${LOT_CODE_PREFIX}%`);

  if (error) {
    console.error("computeNextLotCode - erreur lecture lots:", error);
    return {
      success: false,
      error:
        "Impossible de calculer le prochain identifiant de lot. Merci de réessayer.",
    };
  }

  let maxSequence = 0;
  for (const row of data ?? []) {
    const parsedSequence = extractLotSequence(row.lot_code ?? null);
    if (parsedSequence !== null && parsedSequence > maxSequence) {
      maxSequence = parsedSequence;
    }
  }

  const nextSequence = Math.max(maxSequence + 1, 1);
  return {
    success: true,
    lotCode: `${LOT_CODE_PREFIX}${nextSequence}`,
  };
}

async function renumberLotsAfterDeletion(
  deletedSequence: number
): Promise<RenumberLotsResult> {
  const { data, error } = await supabase
    .from("lots")
    .select("id, lot_code");

  if (error) {
    console.error(
      "renumberLotsAfterDeletion - erreur lecture des lots:",
      error
    );
    return {
      success: false,
      error:
        "Le lot a été supprimé, mais impossible de renuméroter automatiquement les LotID.",
    };
  }

  const renumberTargets = (data ?? [])
    .map((lot) => ({
      id: lot.id,
      currentSequence: extractLotSequence(lot.lot_code ?? null),
    }))
    .filter(
      (lot): lot is { id: number; currentSequence: number } =>
        lot.currentSequence !== null && lot.currentSequence > deletedSequence
    )
    .sort((a, b) => a.currentSequence - b.currentSequence);

  for (const target of renumberTargets) {
    const nextCode = `${LOT_CODE_PREFIX}${target.currentSequence - 1}`;
    const { error: updateError } = await supabase
      .from("lots")
      .update({ lot_code: nextCode })
      .eq("id", target.id);

    if (updateError) {
      console.error(
        "renumberLotsAfterDeletion - erreur mise à jour lot_code:",
        updateError
      );
      return {
        success: false,
        error:
          "Le lot a été supprimé, mais la renumérotation automatique des LotID a échoué.",
      };
    }
  }

  return { success: true };
}

// Fonction interne utilisée par les deux variantes
async function insertLot(normalized: NormalizedLot) {
  for (
    let attempt = 1;
    attempt <= LOT_CODE_INSERT_RETRY_MAX;
    attempt += 1
  ) {
    const nextLotCodeResult = await computeNextLotCode();
    if (!nextLotCodeResult.success) {
      return {
        success: false as const,
        error: nextLotCodeResult.error,
      };
    }

    const { data, error } = await supabase
      .from("lots")
      .insert({
        lot_code: nextLotCodeResult.lotCode,
        label: normalized.label,
        supplier: normalized.supplier,
        purchase_date: normalized.purchaseDate,
        total_cost: normalized.totalCost,
        total_pieces: normalized.totalPieces,
        status: normalized.status,
        notes: normalized.notes,
      })
      .select("id")
      .single();

    if (!error) {
      // on rafraîchit la page /approvisionnement
      revalidatePath("/approvisionnement");

      return {
        success: true as const,
        lotId: data?.id ?? null,
      };
    }

    if (attempt < LOT_CODE_INSERT_RETRY_MAX && isLotCodeUniqueViolation(error)) {
      continue;
    }

    console.error("createLot error:", error);
    if (isLotCodeUniqueViolation(error)) {
      return {
        success: false as const,
        error:
          "Impossible de générer un identifiant de lot unique. Merci de réessayer.",
      };
    }

    return {
      success: false as const,
      error:
        "Impossible d'enregistrer le lot. Détail technique : " +
        error.message,
    };
  }

  return {
    success: false as const,
    error:
      "Impossible de générer un identifiant de lot unique. Merci de réessayer.",
  };
}

/**
 * Variante 1 — ta fonction d’origine, appelée via <form action={createLot}>
 * On la garde telle quelle mais elle passe maintenant par insertLot().
 */
export async function createLot(formData: FormData) {
  const purchaseDate =
    (formData.get("purchase_date") as string | null) ?? "";
  const label = (formData.get("label") as string | null) ?? "";
  const supplier = (formData.get("supplier") as string | null) ?? "";
  const totalCostRaw =
    (formData.get("total_cost") as string | null) ?? "";
  const statusRaw = (formData.get("status") as string | null) ?? "draft";
  const notes = (formData.get("notes") as string | null) ?? "";

  // --- Validation minimale métier ---
  if (!purchaseDate) {
    return {
      success: false as const,
      error: "La date du lot est obligatoire.",
    };
  }

  if (!totalCostRaw) {
    return {
      success: false as const,
      error: "Le coût total du lot est obligatoire.",
    };
  }

  const totalCost = Number(
    totalCostRaw.toString().replace(",", ".") // permet "120,50"
  );

  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return {
      success: false as const,
      error: "Le coût total doit être un nombre positif.",
    };
  }

  if (statusRaw === "confirmed") {
    return {
      success: false as const,
      error: DIRECT_CONFIRMED_CREATE_ERROR,
    };
  }

  // Nb pièces : toujours 0 à la création, recalculé ensuite via inventory
  const totalPieces = 0;

  const status = "draft" as const;

  return insertLot({
    purchaseDate,
    label: label || null,
    supplier: supplier || null,
    totalCost,
    totalPieces,
    status,
    notes: notes || null,
  });
}

/**
 * Variante 2 — nouvelle fonction typée pour la modale “Nouveau lot”.
 * On l’appellera depuis le composant client NewLotDialog.
 */
export async function createLotFromDialog(input: CreateLotInput) {
  if (!input.purchaseDate) {
    throw new Error("La date du lot est obligatoire.");
  }

  if (!Number.isFinite(input.totalCost) || input.totalCost <= 0) {
    throw new Error("Le coût total du lot doit être supérieur à 0.");
  }

  if (input.status === "confirmed") {
    throw new Error(DIRECT_CONFIRMED_CREATE_ERROR);
  }

  // Nb pièces : toujours 0 à la création, recalculé ensuite via inventory
  const totalPieces = 0;

  const status = "draft" as const;

  return insertLot({
    purchaseDate: input.purchaseDate,
    label: input.label?.trim() || null,
    supplier: input.supplier?.trim() || null,
    totalCost: input.totalCost,
    totalPieces,
    status,
    notes: input.notes?.trim() || null,
  });
}

// Helper interne : crée des mouvements IN pour toutes les lignes d'un lot
async function createStockMovementsForLot(lotId: number) {
  if (!lotId || Number.isNaN(lotId)) {
    return { success: false, error: "Lot invalide pour les mouvements." };
  }

  // 1) On récupère toutes les lignes d'inventaire du lot
  const { data: lines, error: linesError } = await supabase
    .from("inventory")
    .select("piece_ref, quantity, unit_cost")
    .eq("lot_id", lotId);

  if (linesError) {
    console.error(
      "createStockMovementsForLot - erreur lors de la lecture des lignes inventory:",
      linesError
    );
    return {
      success: false,
      error: "Impossible de lire les lignes d'inventaire pour ce lot.",
    };
  }

  const movementsPayload =
    (lines ?? [])
      .filter((line) => {
        const qty = Number(line.quantity ?? 0);
        return line.piece_ref && qty > 0;
      })
      .map((line) => ({
        piece_ref: line.piece_ref as string,
        lot_id: lotId,
        direction: "IN" as const,
        quantity: Number(line.quantity ?? 0),
        unit_cost:
          line.unit_cost !== null && line.unit_cost !== undefined
            ? Number(line.unit_cost)
            : null,
        source_type: "PURCHASE",
        source_id: String(lotId),
        comment: null as string | null,
      }));

  // Aucun mouvement à créer → pas d'erreur
  if (!movementsPayload.length) {
    return { success: true };
  }

  // 2) On insère tous les mouvements d'un coup
  const { error: insertError } = await supabase
    .from("stock_movements")
    .insert(movementsPayload);

  if (insertError) {
    console.error(
      "createStockMovementsForLot - erreur lors de l'insertion des mouvements:",
      insertError
    );
    return {
      success: false,
      error:
        "Impossible d'enregistrer les mouvements de stock pour ce lot. " +
        insertError.message,
    };
  }

  // On anticipe le futur : ces mouvements serviront au /stock
  revalidatePath("/stock");

  return { success: true };
}

async function deletePurchaseMovementsForLot(lotId: number) {
  if (!lotId || Number.isNaN(lotId)) {
    return { success: false as const, error: "Lot invalide pour suppression des mouvements." };
  }

  const sourceId = String(lotId);

  const { error: bySourceIdError } = await supabase
    .from("stock_movements")
    .delete()
    .eq("source_type", "PURCHASE")
    .eq("source_id", sourceId);

  if (bySourceIdError) {
    console.error("deletePurchaseMovementsForLot - delete by source_id error:", bySourceIdError);
    return {
      success: false as const,
      error:
        "Impossible de retirer les mouvements d'achat du lot. Détail technique : " +
        bySourceIdError.message,
    };
  }

  const { error: byLotIdError } = await supabase
    .from("stock_movements")
    .delete()
    .eq("source_type", "PURCHASE")
    .eq("lot_id", lotId);

  if (byLotIdError) {
    console.error("deletePurchaseMovementsForLot - delete by lot_id error:", byLotIdError);
    return {
      success: false as const,
      error:
        "Impossible de retirer les mouvements d'achat du lot. Détail technique : " +
        byLotIdError.message,
    };
  }

  return { success: true as const };
}

async function createPurchaseMovementsForLot(lotId: number) {
  const cleanup = await deletePurchaseMovementsForLot(lotId);
  if (!cleanup.success) {
    return cleanup;
  }
  return createStockMovementsForLot(lotId);
}

async function getLotSalesUsage(lotId: number): Promise<LotSalesUsage> {
  if (!lotId || Number.isNaN(lotId)) {
    return {
      usedBySales: false,
      linkedSaleIds: [],
      linkedSalesCount: 0,
      error: "Lot invalide pour vérification d'usage ventes.",
    };
  }

  const [
    { count: movementsCount, error: movementsCountError },
    { data: salePieceRows, error: salePiecesError },
  ] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("id", { head: true, count: "exact" })
      .eq("lot_id", lotId)
      .in("source_type", ["SALE", "SALE_CANCEL", "SALE_EDIT"]),
    supabase
      .from("sale_item_pieces")
      .select("sale_id")
      .eq("lot_id", lotId),
  ]);

  if (movementsCountError || salePiecesError) {
    console.error("getLotSalesUsage - query error:", {
      movementsCountError,
      salePiecesError,
    });
    return {
      usedBySales: false,
      linkedSaleIds: [],
      linkedSalesCount: 0,
      error:
        "Impossible de vérifier si le lot a déjà été utilisé dans des ventes.",
    };
  }

  const saleIdSet = new Set<number>();
  for (const row of salePieceRows ?? []) {
    const saleId = Number(row.sale_id);
    if (Number.isFinite(saleId) && saleId > 0) {
      saleIdSet.add(saleId);
    }
  }

  const linkedSaleIds = Array.from(saleIdSet).slice(0, 5);
  const linkedSalesCount = saleIdSet.size;
  const usedBySales = linkedSalesCount > 0 || (movementsCount ?? 0) > 0;

  return {
    usedBySales,
    linkedSaleIds,
    linkedSalesCount,
  };
}

export async function updateLotFromDialog(
  lotId: number,
  args: {
    purchaseDate: string;
    label?: string;
    supplier?: string;
    lotCode?: string;
    totalCost: number;
    totalPieces?: number; // gardé dans le type pour compat UI, mais ignoré
    status: "draft" | "confirmed";
    notes?: string;
  }
): Promise<UpdateLotResult> {
  if (!lotId || lotId <= 0) {
    return {
      success: false,
      error: "Identifiant de lot invalide.",
      reason: "UPDATE_FAILED",
    };
  }

  if (!args.purchaseDate) {
    return {
      success: false,
      error: "La date du lot est obligatoire.",
      reason: "UPDATE_FAILED",
    };
  }

  if (!Number.isFinite(args.totalCost) || args.totalCost < 0) {
    return {
      success: false,
      error: "Le coût total doit être un nombre positif.",
      reason: "UPDATE_FAILED",
    };
  }

  const nextStatus: LotStatus =
    args.status === "confirmed" ? "confirmed" : "draft";

  // 1) On récupère le statut actuel pour détecter les transitions
  const { data: existingLot, error: fetchError } = await supabase
    .from("lots")
    .select("status, total_pieces")
    .eq("id", lotId)
    .maybeSingle();

  if (fetchError) {
    console.error(
      "updateLotFromDialog - erreur lors de la lecture du lot:",
      fetchError
    );
    return {
      success: false,
      error: "Impossible de récupérer le lot avant mise à jour.",
      reason: "UPDATE_FAILED",
    };
  }

  if (!existingLot) {
    return {
      success: false,
      error: "Lot introuvable.",
      reason: "LOT_NOT_FOUND",
    };
  }

  const previousStatus = (existingLot.status as LotStatus) ?? "draft";
  const currentTotalPieces = Number(existingLot.total_pieces ?? 0);

  const updatePayload: TablesUpdate<"lots"> = {
    purchase_date: args.purchaseDate,
    label: args.label ?? null,
    supplier: args.supplier ?? null,
    lot_code: args.lotCode ?? null,
    total_cost: args.totalCost,
    status: nextStatus,
    notes: args.notes ?? null,
  };

  // 2) Cas sans changement de statut: metadata uniquement.
  if (previousStatus === nextStatus) {
    const { error: updateError } = await supabase
      .from("lots")
      .update(updatePayload)
      .eq("id", lotId);

    if (updateError) {
      console.error("updateLotFromDialog error:", updateError);
      return {
        success: false,
        error:
          "Impossible de mettre à jour le lot. Détail technique : " +
          updateError.message,
        reason: "UPDATE_FAILED",
      };
    }

    revalidatePath("/approvisionnement");
    revalidatePath(`/approvisionnement/${lotId}`);
    revalidatePath("/stock");
    revalidatePath("/historique-stock");

    return { success: true };
  }

  // 3) draft -> confirmed: recréer les mouvements d'achat puis passer le lot en confirmed.
  if (previousStatus === "draft" && nextStatus === "confirmed") {
    if (!Number.isFinite(currentTotalPieces) || currentTotalPieces <= 0) {
      return {
        success: false,
        error:
          "Impossible de confirmer un lot vide. Ajoute au moins une pièce avant de confirmer.",
        reason: "UPDATE_FAILED",
      };
    }

    const movementResult = await createPurchaseMovementsForLot(lotId);
    if (!movementResult.success) {
      return {
        success: false,
        error:
          movementResult.error ??
          "Impossible de recréer les mouvements d'achat pour ce lot.",
        reason: "UPDATE_FAILED",
      };
    }

    const { error: updateError } = await supabase
      .from("lots")
      .update(updatePayload)
      .eq("id", lotId);

    if (updateError) {
      console.error("updateLotFromDialog - error after createPurchaseMovementsForLot:", updateError);
      // rollback best-effort vers draft
      const rollbackResult = await deletePurchaseMovementsForLot(lotId);
      if (!rollbackResult.success) {
        console.error("updateLotFromDialog - rollback failed (delete PURCHASE):", rollbackResult.error);
      }
      return {
        success: false,
        error:
          "Impossible de confirmer le lot après préparation des mouvements de stock.",
        reason: "UPDATE_FAILED",
      };
    }

    revalidatePath("/approvisionnement");
    revalidatePath(`/approvisionnement/${lotId}`);
    revalidatePath("/stock");
    revalidatePath("/historique-stock");

    return { success: true };
  }

  // 4) confirmed -> draft: bloqué si lot déjà utilisé en ventes; sinon retrait des PURCHASE.
  if (previousStatus === "confirmed" && nextStatus === "draft") {
    const salesUsage = await getLotSalesUsage(lotId);
    if (salesUsage.error) {
      return {
        success: false,
        error: salesUsage.error,
        reason: "UPDATE_FAILED",
      };
    }

    if (salesUsage.usedBySales) {
      return {
        success: false,
        reason: "LOT_USED_BY_SALES",
        linkedSaleIds: salesUsage.linkedSaleIds,
        linkedSalesCount: salesUsage.linkedSalesCount,
        error:
          salesUsage.linkedSaleIds.length > 0
            ? `Ce lot a déjà été utilisé dans des ventes (#${salesUsage.linkedSaleIds.join(", #")}). Annule/supprime d'abord les ventes liées.`
            : "Ce lot a déjà été utilisé dans des ventes. Annule/supprime d'abord les ventes liées.",
      };
    }

    const deleteResult = await deletePurchaseMovementsForLot(lotId);
    if (!deleteResult.success) {
      return {
        success: false,
        error:
          deleteResult.error ??
          "Impossible de retirer les mouvements d'achat de ce lot.",
        reason: "UPDATE_FAILED",
      };
    }

    const { error: updateError } = await supabase
      .from("lots")
      .update(updatePayload)
      .eq("id", lotId);

    if (updateError) {
      console.error("updateLotFromDialog - error after deletePurchaseMovementsForLot:", updateError);
      // rollback best-effort vers confirmed
      const rollbackResult = await createPurchaseMovementsForLot(lotId);
      if (!rollbackResult.success) {
        console.error("updateLotFromDialog - rollback failed (recreate PURCHASE):", rollbackResult.error);
      }
      return {
        success: false,
        error:
          "Impossible de repasser le lot en brouillon après retrait des mouvements de stock.",
        reason: "UPDATE_FAILED",
      };
    }

    revalidatePath("/approvisionnement");
    revalidatePath(`/approvisionnement/${lotId}`);
    revalidatePath("/stock");
    revalidatePath("/historique-stock");

    return { success: true };
  }

  // Fallback défensif (ne devrait pas arriver avec le type LotStatus)
  const { error: fallbackUpdateError } = await supabase
    .from("lots")
    .update(updatePayload)
    .eq("id", lotId);

  if (fallbackUpdateError) {
    console.error("updateLotFromDialog - fallback update error:", fallbackUpdateError);
    return {
      success: false,
      error:
        "Impossible de mettre à jour le lot. Détail technique : " +
        fallbackUpdateError.message,
      reason: "UPDATE_FAILED",
    };
  }

  revalidatePath("/approvisionnement");
  revalidatePath(`/approvisionnement/${lotId}`);
  revalidatePath("/stock");
  revalidatePath("/historique-stock");

  return { success: true };
}

export async function deleteLot(lotId: number): Promise<DeleteLotResult> {
  // Sécurité minimale
  if (!lotId || Number.isNaN(lotId)) {
    return { success: false, error: "Lot invalide.", reason: "DELETE_FAILED" };
  }

  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("id, status, lot_code")
    .eq("id", lotId)
    .maybeSingle();

  if (lotError) {
    console.error("deleteLot - lot lookup error:", lotError);
    return {
      success: false,
      error: "Impossible de charger le lot avant suppression.",
      reason: "DELETE_FAILED",
    };
  }

  if (!lotRow) {
    return {
      success: false,
      error: "Lot introuvable.",
      reason: "LOT_NOT_FOUND",
    };
  }

  if ((lotRow.lot_code ?? "").trim() === "LOT_0") {
    return {
      success: false,
      error:
        "Le lot initial LOT_0 est protégé et ne peut pas être supprimé.",
      reason: "LOT_INITIAL_PROTECTED",
    };
  }

  const deletedLotSequence = extractLotSequence(lotRow.lot_code ?? null);

  const salesUsage = await getLotSalesUsage(lotId);
  if (salesUsage.error) {
    return {
      success: false,
      error: salesUsage.error,
      reason: "DELETE_FAILED",
    };
  }

  if (salesUsage.usedBySales) {
    return {
      success: false,
      reason: "LOT_USED_BY_SALES",
      linkedSaleIds: salesUsage.linkedSaleIds,
      linkedSalesCount: salesUsage.linkedSalesCount,
      error:
        salesUsage.linkedSaleIds.length > 0
          ? `Ce lot a déjà été utilisé dans des ventes (#${salesUsage.linkedSaleIds.join(", #")}). Annule/supprime d'abord les ventes liées.`
          : "Ce lot a déjà été utilisé dans des ventes. Annule/supprime d'abord les ventes liées.",
    };
  }

  const deletePurchaseResult = await deletePurchaseMovementsForLot(lotId);
  if (!deletePurchaseResult.success) {
    return {
      success: false,
      error:
        deletePurchaseResult.error ??
        "Impossible de retirer les mouvements d'achat de ce lot.",
      reason: "DELETE_FAILED",
    };
  }

  const { error: inventoryDeleteError } = await supabase
    .from("inventory")
    .delete()
    .eq("lot_id", lotId);

  if (inventoryDeleteError) {
    console.error("deleteLot - inventory delete error:", inventoryDeleteError);
    return {
      success: false,
      error:
        "Impossible de supprimer les lignes de pièces de ce lot. Détail technique : " +
        inventoryDeleteError.message,
      reason: "DELETE_FAILED",
    };
  }

  const { error: lotDeleteError } = await supabase
    .from("lots")
    .delete()
    .eq("id", lotId);

  if (lotDeleteError) {
    console.error("deleteLot - lot delete error:", lotDeleteError);
    return {
      success: false,
      error:
        "Impossible de supprimer ce lot. Détail technique : " +
        lotDeleteError.message,
      reason: "DELETE_FAILED",
    };
  }

  let warning: string | undefined;
  if (deletedLotSequence !== null && deletedLotSequence > 0) {
    const renumberResult = await renumberLotsAfterDeletion(deletedLotSequence);
    if (!renumberResult.success) {
      warning = renumberResult.error;
    }
  }

  revalidatePath("/approvisionnement");
  revalidatePath(`/approvisionnement/${lotId}`);
  revalidatePath("/stock");
  revalidatePath("/historique-stock");

  return { success: true, warning };
}

// ... tout le reste de action.ts au-dessus ...

export async function addPieceToLot(
  lotId: number,
  input: {
    pieceRef: string;
    quantity: number;
  }
) {
  if (!lotId || Number.isNaN(lotId)) {
    return { success: false, error: "Lot invalide." };
  }

  const pieceRef = input.pieceRef.trim();
  const quantity = input.quantity;

  if (!pieceRef) {
    return { success: false, error: "La référence de pièce est obligatoire." };
  }

  if (
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return {
      success: false,
      error: "La quantité doit être un entier strictement positif.",
    };
  }

  // 1) On récupère le lot avec son statut + coût total
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status, total_cost")
    .eq("id", lotId)
    .single();

  if (lotError || !lotRow) {
    console.error("addPieceToLot lot error:", lotError);
    return {
      success: false,
      error: "Impossible de vérifier le statut du lot.",
    };
  }

  if (lotRow.status !== "draft") {
    return {
      success: false,
      error:
        "Ce lot est confirmé. Tu ne peux plus ajouter de pièces (repasse-le en brouillon si besoin).",
    };
  }

  const totalCostNumber = Number(lotRow.total_cost ?? 0);
  if (!Number.isFinite(totalCostNumber) || totalCostNumber < 0) {
    return {
      success: false,
      error:
        "Le coût total du lot est invalide. Vérifie la valeur dans la fiche du lot.",
    };
  }

  // 2) 🔁 Fusionner les lignes sur (lot_id, piece_ref)
  const { data: existingLine, error: existingError } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("lot_id", lotId)
    .eq("piece_ref", pieceRef)
    .maybeSingle();

  if (existingError) {
    console.error(
      "addPieceToLot - erreur lors de la recherche de ligne existante:",
      existingError
    );
    return {
      success: false,
      error: "Impossible de vérifier les lignes existantes pour ce lot.",
    };
  }

  let dbError = null;

  if (existingLine) {
    // 👉 Une ligne existe déjà : on additionne les quantités
    const newQuantity = (existingLine.quantity ?? 0) + quantity;

    const { error } = await supabase
      .from("inventory")
      .update({ quantity: newQuantity })
      .eq("id", existingLine.id);

    dbError = error;
  } else {
    // 👉 Pas de ligne existante : on crée une nouvelle ligne
    const { error } = await supabase.from("inventory").insert({
      lot_id: lotId,
      piece_ref: pieceRef,
      quantity,
      location: null,
      // unit_cost sera mis à jour juste après pour toutes les lignes du lot
    });

    dbError = error;
  }

  if (dbError) {
    console.error("addPieceToLot insert/update error:", dbError);
    return {
      success: false,
      error:
        "Impossible d'ajouter la pièce au lot. Détail technique : " +
        dbError.message,
    };
  }

  // 3) On recalcule la quantité totale du lot à partir de toutes les lignes d'inventaire
  const { data: allLines, error: linesError } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("lot_id", lotId);

  if (linesError) {
    console.error(
      "addPieceToLot - erreur lors du recalcul des quantités du lot:",
      linesError
    );
    // On ne bloque pas l'ajout de la pièce, on retourne quand même success
    revalidatePath(`/approvisionnement/${lotId}`);
    return {
      success: true,
      warning:
        "Pièce ajoutée, mais impossible de recalculer le coût unitaire / le nombre de pièces du lot.",
    };
  }

  const totalQuantityForLot =
    allLines?.reduce((sum, line) => sum + (line.quantity ?? 0), 0) ?? 0;

  // 3.a) Met à jour le nombre total de pièces dans la table lots
  const { error: lotUpdateError } = await supabase
    .from("lots")
    .update({ total_pieces: totalQuantityForLot })
    .eq("id", lotId);

  if (lotUpdateError) {
    console.error(
      "addPieceToLot - erreur lors de la mise à jour de total_pieces:",
      lotUpdateError
    );
    // On continue quand même pour tenter de mettre à jour unit_cost
  }

  // 3.b) Si on a un coût total > 0 et des pièces, on met à jour unit_cost pour toutes les lignes du lot
  if (totalQuantityForLot > 0 && totalCostNumber > 0) {
    const unitCostForLot = totalCostNumber / totalQuantityForLot;

    if (Number.isFinite(unitCostForLot) && unitCostForLot >= 0) {
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ unit_cost: unitCostForLot })
        .eq("lot_id", lotId);

      if (updateError) {
        console.error(
          "addPieceToLot - erreur lors de la mise à jour de unit_cost:",
          updateError
        );
        revalidatePath(`/approvisionnement/${lotId}`);
        return {
          success: true,
          warning:
            "Pièce ajoutée, mais impossible de mettre à jour le coût unitaire des pièces du lot.",
        };
      }
    }
  }

  // 4) On rafraîchit la page du lot
  revalidatePath(`/approvisionnement/${lotId}`);

  return { success: true as const };
}

export async function deleteInventoryLine(lotId: number, lineId: number) {
  if (!lotId || !lineId || Number.isNaN(lotId) || Number.isNaN(lineId)) {
    return { success: false, error: "Paramètres invalides." };
  }

  // Vérifie que la ligne appartient bien à ce lot
  const { data: line, error: lineError } = await supabase
    .from("inventory")
    .select("id, lot_id")
    .eq("id", lineId)
    .single();

  if (lineError || !line || line.lot_id !== lotId) {
    console.error("deleteInventoryLine - line mismatch:", lineError);
    return {
      success: false,
      error: "Ligne introuvable ou ne correspondant pas à ce lot.",
    };
  }

  // Vérifie que le lot est toujours en brouillon + récupère total_cost
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status, total_cost")
    .eq("id", lotId)
    .single();

  if (lotError || !lotRow) {
    return {
      success: false,
      error: "Impossible de vérifier le statut du lot.",
    };
  }

  if (lotRow.status !== "draft") {
    return {
      success: false,
      error: "Ce lot est confirmé : tu ne peux plus modifier les lignes.",
    };
  }

  const totalCostNumber = Number(lotRow.total_cost ?? 0);
  if (!Number.isFinite(totalCostNumber) || totalCostNumber < 0) {
    return {
      success: false,
      error:
        "Le coût total du lot est invalide. Vérifie la valeur dans la fiche du lot.",
    };
  }

  const { error: deleteError } = await supabase
    .from("inventory")
    .delete()
    .eq("id", lineId);

  if (deleteError) {
    console.error("deleteInventoryLine error:", deleteError);
    return {
      success: false,
      error:
        "Impossible de supprimer cette ligne. Détail technique : " +
        deleteError.message,
    };
  }

  // Recalcul de la quantité totale du lot après suppression
  const { data: allLines, error: linesError } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("lot_id", lotId);

  if (linesError) {
    console.error(
      "deleteInventoryLine - erreur lors du recalcul des quantités du lot:",
      linesError
    );
    revalidatePath("/approvisionnement");
    revalidatePath(`/approvisionnement/${lotId}`);
    return {
      success: true,
      warning:
        "Ligne supprimée, mais impossible de recalculer le nombre de pièces / coût unitaire du lot.",
    };
  }

  const totalQuantityForLot =
    allLines?.reduce((sum, currentLine) => sum + (currentLine.quantity ?? 0), 0) ?? 0;

  const { error: lotUpdateError } = await supabase
    .from("lots")
    .update({ total_pieces: totalQuantityForLot })
    .eq("id", lotId);

  if (lotUpdateError) {
    console.error(
      "deleteInventoryLine - erreur lors de la mise à jour de total_pieces:",
      lotUpdateError
    );
  }

  if (totalQuantityForLot > 0 && totalCostNumber > 0) {
    const unitCostForLot = totalCostNumber / totalQuantityForLot;

    if (Number.isFinite(unitCostForLot) && unitCostForLot >= 0) {
      const { error: unitUpdateError } = await supabase
        .from("inventory")
        .update({ unit_cost: unitCostForLot })
        .eq("lot_id", lotId);

      if (unitUpdateError) {
        console.error(
          "deleteInventoryLine - erreur lors de la mise à jour de unit_cost:",
          unitUpdateError
        );
        revalidatePath("/approvisionnement");
        revalidatePath(`/approvisionnement/${lotId}`);
        return {
          success: true,
          warning:
            "Ligne supprimée, mais impossible de mettre à jour le coût unitaire des pièces du lot.",
        };
      }
    }
  }

  revalidatePath("/approvisionnement");
  revalidatePath(`/approvisionnement/${lotId}`);

  return { success: true as const };
}

export async function updateInventoryLine(
  lotId: number,
  lineId: number,
  args: {
    pieceRef: string;
    quantity: number;
  }
) {
  if (!lotId || !lineId || Number.isNaN(lotId) || Number.isNaN(lineId)) {
    return { success: false, error: "Paramètres invalides." };
  }

  const pieceRef = args.pieceRef.trim();
  const quantity = args.quantity;

  if (!pieceRef) {
    return {
      success: false,
      error: "La référence de pièce est obligatoire.",
    };
  }

  if (
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return {
      success: false,
      error: "La quantité doit être un entier strictement positif.",
    };
  }

  // Vérifie que la ligne appartient bien à ce lot
  const { data: line, error: lineError } = await supabase
    .from("inventory")
    .select("id, lot_id")
    .eq("id", lineId)
    .single();

  if (lineError || !line || line.lot_id !== lotId) {
    console.error("updateInventoryLine - line mismatch:", lineError);
    return {
      success: false,
      error: "Ligne introuvable ou ne correspondant pas à ce lot.",
    };
  }

  // Vérifie que le lot est toujours en brouillon + récupère total_cost
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status, total_cost")
    .eq("id", lotId)
    .single();

  if (lotError || !lotRow) {
    return {
      success: false,
      error: "Impossible de vérifier le statut du lot.",
    };
  }

  if (lotRow.status !== "draft") {
    return {
      success: false,
      error: "Ce lot est confirmé : tu ne peux plus modifier les lignes.",
    };
  }

  const totalCostNumber = Number(lotRow.total_cost ?? 0);
  if (!Number.isFinite(totalCostNumber) || totalCostNumber < 0) {
    return {
      success: false,
      error:
        "Le coût total du lot est invalide. Vérifie la valeur dans la fiche du lot.",
    };
  }

  // 1) Mise à jour de la ligne d'inventaire
  const { error: updateError } = await supabase
    .from("inventory")
    .update({
      piece_ref: pieceRef,
      quantity,
    })
    .eq("id", lineId);

  if (updateError) {
    console.error("updateInventoryLine error:", updateError);
    return {
      success: false,
      error:
        "Impossible de mettre à jour cette ligne. Détail technique : " +
        updateError.message,
    };
  }

  // 2) Recalcul de la quantité totale du lot
  const { data: allLines, error: linesError } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("lot_id", lotId);

  if (linesError) {
    console.error(
      "updateInventoryLine - erreur lors du recalcul des quantités du lot:",
      linesError
    );
    revalidatePath(`/approvisionnement/${lotId}`);
    return {
      success: true,
      warning:
        "Ligne mise à jour, mais impossible de recalculer le nombre de pièces / coût unitaire du lot.",
    };
  }

  const totalQuantityForLot =
    allLines?.reduce((sum, line) => sum + (line.quantity ?? 0), 0) ?? 0;

  // 2.a) Mise à jour du nombre total de pièces dans la table lots
  const { error: lotUpdateError } = await supabase
    .from("lots")
    .update({ total_pieces: totalQuantityForLot })
    .eq("id", lotId);

  if (lotUpdateError) {
    console.error(
      "updateInventoryLine - erreur lors de la mise à jour de total_pieces:",
      lotUpdateError
    );
    // On continue quand même pour tenter de mettre à jour unit_cost
  }

  // 2.b) Recalcul du coût unitaire pour toutes les lignes du lot
  if (totalQuantityForLot > 0 && totalCostNumber > 0) {
    const unitCostForLot = totalCostNumber / totalQuantityForLot;

    if (Number.isFinite(unitCostForLot) && unitCostForLot >= 0) {
      const { error: unitUpdateError } = await supabase
        .from("inventory")
        .update({ unit_cost: unitCostForLot })
        .eq("lot_id", lotId);

      if (unitUpdateError) {
        console.error(
          "updateInventoryLine - erreur lors de la mise à jour de unit_cost:",
          unitUpdateError
        );
        revalidatePath(`/approvisionnement/${lotId}`);
        return {
          success: true,
          warning:
            "Ligne mise à jour, mais impossible de mettre à jour le coût unitaire des pièces du lot.",
        };
      }
    }
  }

  // 3) Rafraîchit la page du lot
  revalidatePath(`/approvisionnement/${lotId}`);

  return { success: true as const };
}
