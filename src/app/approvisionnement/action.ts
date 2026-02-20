"use server";

import { supabase } from "@/lib/supabase";
import { parse } from "csv-parse/sync";
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
  | "LOT_CONFIRMATION_CONFLICT"
  | "LOT_CONFIRMATION_INCONSISTENT"
  | "LOT_CONFIRMATION_ROLLBACK_FAILED"
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

type LotInventoryMovementLine = {
  pieceRef: string;
  quantity: number;
  unitCost: number | null;
};

type LotInventorySnapshotResult =
  | {
      success: true;
      lines: LotInventoryMovementLine[];
      totalQuantity: number;
    }
  | {
      success: false;
      error: string;
    };

type LotMovementResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
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

type CsvDelimiter = "," | ";";

type ParsedCsvLine = {
  lineNumber: number;
  pieceRefRaw: string;
  quantityRaw: string;
};

export type ImportLotPiecesFromCsvReason =
  | "LOT_NOT_FOUND"
  | "LOT_NOT_DRAFT"
  | "EMPTY_CSV"
  | "CSV_PARSE_ERROR"
  | "NO_VALID_ROWS"
  | "IMPORT_FAILED";

export type CsvImportRejectedRow = {
  lineNumber: number;
  pieceRef: string;
  quantity: string;
  reason: string;
};

export type CsvImportAppliedRow = {
  pieceRef: string;
  quantity: number;
  action: "added" | "merged";
  lineNumbers: number[];
};

export type CsvImportSummary = {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  aggregatedRows: number;
  importedRows: number;
  mergedRows: number;
  appliedRows: number;
  totalImportedQuantity: number;
};

type ImportLotPiecesFromCsvFailure = {
  success: false;
  error: string;
  reason: ImportLotPiecesFromCsvReason;
  summary?: CsvImportSummary;
  rejectedRows?: CsvImportRejectedRow[];
};

type ImportLotPiecesFromCsvSuccess = {
  success: true;
  summary: CsvImportSummary;
  appliedRows: CsvImportAppliedRow[];
  rejectedRows: CsvImportRejectedRow[];
  warning?: string;
};

export type ImportLotPiecesFromCsvResult =
  | ImportLotPiecesFromCsvSuccess
  | ImportLotPiecesFromCsvFailure;

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

const normalizeCsvHeader = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const isExpectedCsvHeaderRow = (colA: string, colB: string): boolean => {
  const headerA = normalizeCsvHeader(colA);
  const headerB = normalizeCsvHeader(colB);
  const isPieceHeader =
    headerA === "numero de piece" || headerA === "numero piece";
  const isQuantityHeader =
    headerB === "quantite de piece" ||
    headerB === "quantite piece" ||
    headerB === "quantite";

  return isPieceHeader && isQuantityHeader;
};

const countDelimiter = (line: string, delimiter: CsvDelimiter): number => {
  return line.split(delimiter).length - 1;
};

const detectCsvDelimiter = (csvContent: string): CsvDelimiter => {
  const lines = csvContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 20);

  if (lines.length === 0) {
    return ",";
  }

  let semicolonScore = 0;
  let commaScore = 0;
  for (const line of lines) {
    semicolonScore += countDelimiter(line, ";");
    commaScore += countDelimiter(line, ",");
  }

  return semicolonScore > commaScore ? ";" : ",";
};

const parseCsvLinesForLotImport = (csvContent: string): ParsedCsvLine[] => {
  const delimiter = detectCsvDelimiter(csvContent);
  const rows = parse(csvContent, {
    bom: true,
    delimiter,
    relax_column_count: true,
    skip_empty_lines: false,
    trim: false,
  }) as string[][];

  const parsedLines: ParsedCsvLine[] = [];

  for (const [index, row] of rows.entries()) {
    const values = Array.isArray(row) ? row : [];
    const hasAnyCell = values.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasAnyCell) {
      continue;
    }

    const pieceRefRaw = String(values[0] ?? "");
    const quantityRaw = String(values[1] ?? "");
    if (isExpectedCsvHeaderRow(pieceRefRaw, quantityRaw)) {
      continue;
    }

    parsedLines.push({
      lineNumber: index + 1,
      pieceRefRaw,
      quantityRaw,
    });
  }

  return parsedLines;
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

async function readInventorySnapshotForLot(
  lotId: number
): Promise<LotInventorySnapshotResult> {
  if (!lotId || Number.isNaN(lotId)) {
    return { success: false, error: "Lot invalide pour les mouvements." };
  }

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

  const normalizedLines: LotInventoryMovementLine[] = [];
  let totalQuantity = 0;
  for (const rawLine of lines ?? []) {
    const pieceRef = (rawLine.piece_ref ?? "").trim();
    const quantity = Number(rawLine.quantity ?? 0);
    if (!pieceRef || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const rawUnitCost = rawLine.unit_cost;
    const parsedUnitCost =
      rawUnitCost !== null && rawUnitCost !== undefined
        ? Number(rawUnitCost)
        : null;
    const unitCost =
      parsedUnitCost !== null && Number.isFinite(parsedUnitCost)
        ? parsedUnitCost
        : null;

    normalizedLines.push({
      pieceRef,
      quantity,
      unitCost,
    });
    totalQuantity += quantity;
  }

  return {
    success: true,
    lines: normalizedLines,
    totalQuantity,
  };
}

function buildPurchaseMovementsPayload(
  lotId: number,
  inventoryLines: LotInventoryMovementLine[]
) {
  return inventoryLines.map((line) => ({
    piece_ref: line.pieceRef,
    lot_id: lotId,
    direction: "IN" as const,
    quantity: line.quantity,
    unit_cost: line.unitCost,
    source_type: "PURCHASE",
    source_id: String(lotId),
    comment: null as string | null,
  }));
}

async function insertPurchaseMovements(
  movementsPayload: ReturnType<typeof buildPurchaseMovementsPayload>
): Promise<LotMovementResult> {
  if (!movementsPayload.length) {
    return { success: true as const };
  }

  const { error: insertError } = await supabase
    .from("stock_movements")
    .insert(movementsPayload);

  if (insertError) {
    console.error(
      "insertPurchaseMovements - erreur lors de l'insertion des mouvements:",
      insertError
    );
    return {
      success: false as const,
      error:
        "Impossible d'enregistrer les mouvements de stock pour ce lot. " +
        insertError.message,
    };
  }

  revalidatePath("/stock");
  return { success: true as const };
}

async function sumPurchaseInQuantityForLot(lotId: number) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("quantity")
    .eq("source_type", "PURCHASE")
    .eq("direction", "IN")
    .eq("lot_id", lotId);

  if (error) {
    console.error("sumPurchaseInQuantityForLot - query error:", error);
    return {
      success: false as const,
      error:
        "Impossible de vérifier la cohérence des mouvements d'achat pour ce lot.",
    };
  }

  const quantity = (data ?? []).reduce(
    (sum, row) => sum + Number(row.quantity ?? 0),
    0
  );

  return { success: true as const, quantity };
}

async function createStockMovementsForLotFromSnapshot(
  lotId: number,
  inventoryLines: LotInventoryMovementLine[]
): Promise<LotMovementResult> {
  const movementsPayload = buildPurchaseMovementsPayload(lotId, inventoryLines);
  return insertPurchaseMovements(movementsPayload);
}

// Helper interne : crée des mouvements IN pour toutes les lignes d'un lot
async function createStockMovementsForLot(
  lotId: number
): Promise<LotMovementResult> {
  const snapshotResult = await readInventorySnapshotForLot(lotId);
  if (!snapshotResult.success) {
    return { success: false, error: snapshotResult.error };
  }

  // Aucun mouvement à créer → pas d'erreur
  if (!snapshotResult.lines.length) {
    return { success: true };
  }

  return createStockMovementsForLotFromSnapshot(lotId, snapshotResult.lines);
}

async function deletePurchaseMovementsForLot(
  lotId: number
): Promise<LotMovementResult> {
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

async function createPurchaseMovementsForLot(
  lotId: number,
  inventoryLines?: LotInventoryMovementLine[]
): Promise<LotMovementResult> {
  const cleanup = await deletePurchaseMovementsForLot(lotId);
  if (!cleanup.success) {
    return cleanup;
  }

  if (inventoryLines) {
    return createStockMovementsForLotFromSnapshot(lotId, inventoryLines);
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
    .select(
      "status, total_pieces, purchase_date, label, supplier, lot_code, total_cost, notes"
    )
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
  const previousTotalCostRaw = Number(existingLot.total_cost ?? 0);
  const previousTotalCost =
    Number.isFinite(previousTotalCostRaw) && previousTotalCostRaw >= 0
      ? previousTotalCostRaw
      : 0;

  const rollbackLotPayload: TablesUpdate<"lots"> = {
    purchase_date: existingLot.purchase_date,
    label: existingLot.label ?? null,
    supplier: existingLot.supplier ?? null,
    lot_code: existingLot.lot_code ?? null,
    total_cost: previousTotalCost,
    status: previousStatus,
    notes: existingLot.notes ?? null,
    total_pieces: Number.isFinite(currentTotalPieces) ? currentTotalPieces : 0,
  };

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

    const inventorySnapshot = await readInventorySnapshotForLot(lotId);
    if (!inventorySnapshot.success) {
      return {
        success: false,
        error: inventorySnapshot.error,
        reason: "UPDATE_FAILED",
      };
    }

    if (
      !Number.isFinite(inventorySnapshot.totalQuantity) ||
      inventorySnapshot.totalQuantity <= 0 ||
      inventorySnapshot.lines.length === 0
    ) {
      return {
        success: false,
        error:
          "Impossible de confirmer ce lot car aucune ligne d'inventaire valide n'a été trouvée. Recharge la page, ajoute au moins une pièce puis réessaie.",
        reason: "LOT_CONFIRMATION_INCONSISTENT",
      };
    }

    const movementResult = await createPurchaseMovementsForLot(
      lotId,
      inventorySnapshot.lines
    );
    if (!movementResult.success) {
      return {
        success: false,
        error:
          movementResult.error ??
          "Impossible de recréer les mouvements d'achat pour ce lot.",
        reason: "UPDATE_FAILED",
      };
    }

    const purchaseCheckBeforeUpdate = await sumPurchaseInQuantityForLot(lotId);
    if (
      !purchaseCheckBeforeUpdate.success ||
      purchaseCheckBeforeUpdate.quantity !== inventorySnapshot.totalQuantity
    ) {
      const cleanupAfterCheck = await deletePurchaseMovementsForLot(lotId);
      if (!cleanupAfterCheck.success) {
        return {
          success: false,
          error:
            "La confirmation a échoué et la restauration automatique des mouvements n'a pas abouti. Recharge la page puis vérifie le lot avant de réessayer.",
          reason: "LOT_CONFIRMATION_ROLLBACK_FAILED",
        };
      }

      return {
        success: false,
        error:
          "Impossible de confirmer ce lot car les mouvements d'achat préparés sont incohérents. Recharge la page puis réessaie.",
        reason: "LOT_CONFIRMATION_INCONSISTENT",
      };
    }

    const { data: updatedLot, error: updateError } = await supabase
      .from("lots")
      .update({
        ...updatePayload,
        total_pieces: inventorySnapshot.totalQuantity,
      })
      .eq("id", lotId)
      .eq("status", "draft")
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      console.error("updateLotFromDialog - error after createPurchaseMovementsForLot:", updateError);
      const rollbackMovements = await deletePurchaseMovementsForLot(lotId);
      const rollbackLot = await supabase
        .from("lots")
        .update(rollbackLotPayload)
        .eq("id", lotId);
      if (!rollbackMovements.success || rollbackLot.error) {
        console.error(
          "updateLotFromDialog - rollback failed after update error:",
          {
            rollbackMovements,
            rollbackLotError: rollbackLot.error,
          }
        );
        return {
          success: false,
          error:
            "La confirmation a échoué et le lot n'a pas pu être restauré automatiquement. Recharge la page puis vérifie le lot avant de réessayer.",
          reason: "LOT_CONFIRMATION_ROLLBACK_FAILED",
        };
      }
      return {
        success: false,
        error:
          "Impossible de confirmer le lot après préparation des mouvements de stock. Le lot est resté en brouillon.",
        reason: "LOT_CONFIRMATION_INCONSISTENT",
      };
    }

    if (!updatedLot) {
      const { data: latestLotStatusRow, error: latestLotStatusError } =
        await supabase
          .from("lots")
          .select("status")
          .eq("id", lotId)
          .maybeSingle();

      if (!latestLotStatusError && latestLotStatusRow?.status === "draft") {
        await deletePurchaseMovementsForLot(lotId);
      }

      return {
        success: false,
        error:
          "Le lot a été modifié en parallèle pendant la confirmation. Recharge la page puis réessaie.",
        reason: "LOT_CONFIRMATION_CONFLICT",
      };
    }

    const inventoryAfterConfirm = await readInventorySnapshotForLot(lotId);
    const purchaseAfterConfirm = await sumPurchaseInQuantityForLot(lotId);
    const postConditionOk =
      inventoryAfterConfirm.success &&
      purchaseAfterConfirm.success &&
      inventoryAfterConfirm.totalQuantity > 0 &&
      purchaseAfterConfirm.quantity === inventoryAfterConfirm.totalQuantity;

    if (!postConditionOk) {
      const rollbackMovements = await deletePurchaseMovementsForLot(lotId);
      const rollbackLot = await supabase
        .from("lots")
        .update(rollbackLotPayload)
        .eq("id", lotId);
      const purchaseAfterRollback = await sumPurchaseInQuantityForLot(lotId);
      const rollbackVerified =
        rollbackMovements.success &&
        !rollbackLot.error &&
        purchaseAfterRollback.success &&
        purchaseAfterRollback.quantity === 0;

      if (!rollbackVerified) {
        console.error(
          "updateLotFromDialog - rollback verification failed after post-check:",
          {
            rollbackMovements,
            rollbackLotError: rollbackLot.error,
            purchaseAfterRollback,
          }
        );
        return {
          success: false,
          error:
            "La confirmation a échoué et la restauration automatique n'a pas pu être vérifiée. Recharge la page puis vérifie le lot avant de réessayer.",
          reason: "LOT_CONFIRMATION_ROLLBACK_FAILED",
        };
      }

      return {
        success: false,
        error:
          "La confirmation a été annulée car une incohérence a été détectée entre inventaire et mouvements d'achat. Recharge la page puis réessaie.",
        reason: "LOT_CONFIRMATION_INCONSISTENT",
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

export async function importLotPiecesFromCsv(
  lotId: number,
  payload: {
    csvContent: string;
  }
): Promise<ImportLotPiecesFromCsvResult> {
  if (!lotId || Number.isNaN(lotId)) {
    return {
      success: false,
      error: "Lot invalide.",
      reason: "IMPORT_FAILED",
    };
  }

  const csvContent = payload.csvContent ?? "";
  if (!csvContent.trim()) {
    return {
      success: false,
      error:
        "Le contenu CSV est vide. Ajoute des lignes avant de lancer l'import.",
      reason: "EMPTY_CSV",
    };
  }

  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status")
    .eq("id", lotId)
    .maybeSingle();

  if (lotError) {
    console.error("importLotPiecesFromCsv - lot lookup error:", lotError);
    return {
      success: false,
      error: "Impossible de vérifier le statut du lot avant import.",
      reason: "IMPORT_FAILED",
    };
  }

  if (!lotRow) {
    return {
      success: false,
      error: "Lot introuvable.",
      reason: "LOT_NOT_FOUND",
    };
  }

  if (lotRow.status !== "draft") {
    return {
      success: false,
      error:
        "Ce lot est confirmé. L'import CSV est interdit. Repasse le lot en brouillon si tu dois le modifier.",
      reason: "LOT_NOT_DRAFT",
    };
  }

  let parsedLines: ParsedCsvLine[];
  try {
    parsedLines = parseCsvLinesForLotImport(csvContent);
  } catch (error) {
    console.error("importLotPiecesFromCsv - CSV parse error:", error);
    return {
      success: false,
      error:
        "Le CSV n'a pas pu être lu. Vérifie le format et réessaie (colonnes A/B attendues).",
      reason: "CSV_PARSE_ERROR",
    };
  }

  if (parsedLines.length === 0) {
    return {
      success: false,
      error:
        "Aucune ligne exploitable trouvée dans le CSV. Vérifie les colonnes A/B puis réessaie.",
      reason: "EMPTY_CSV",
    };
  }

  const rejectedRows: CsvImportRejectedRow[] = [];
  const aggregatedRowsByPiece = new Map<
    string,
    { pieceRef: string; quantity: number; lineNumbers: number[] }
  >();

  let totalRows = 0;
  let validRows = 0;

  for (const row of parsedLines) {
    const pieceRef = row.pieceRefRaw.trim();
    const quantityRaw = row.quantityRaw.trim();

    totalRows += 1;

    if (!pieceRef) {
      rejectedRows.push({
        lineNumber: row.lineNumber,
        pieceRef,
        quantity: quantityRaw,
        reason: "Référence de pièce vide.",
      });
      continue;
    }

    if (!quantityRaw) {
      rejectedRows.push({
        lineNumber: row.lineNumber,
        pieceRef,
        quantity: quantityRaw,
        reason: "Quantité vide.",
      });
      continue;
    }

    const quantity = Number(quantityRaw.replace(",", "."));
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      rejectedRows.push({
        lineNumber: row.lineNumber,
        pieceRef,
        quantity: quantityRaw,
        reason: "Quantité invalide (entier strictement positif attendu).",
      });
      continue;
    }

    validRows += 1;

    const current = aggregatedRowsByPiece.get(pieceRef);
    if (current) {
      current.quantity += quantity;
      current.lineNumbers.push(row.lineNumber);
      continue;
    }

    aggregatedRowsByPiece.set(pieceRef, {
      pieceRef,
      quantity,
      lineNumbers: [row.lineNumber],
    });
  }

  const aggregatedRows = Array.from(aggregatedRowsByPiece.values());
  if (aggregatedRows.length === 0) {
    const summary: CsvImportSummary = {
      totalRows,
      validRows,
      rejectedRows: rejectedRows.length,
      aggregatedRows: 0,
      importedRows: 0,
      mergedRows: 0,
      appliedRows: 0,
      totalImportedQuantity: 0,
    };

    return {
      success: false,
      error:
        "Toutes les lignes ont été rejetées. Corrige le CSV puis relance l'import.",
      reason: "NO_VALID_ROWS",
      summary,
      rejectedRows,
    };
  }

  const pieceRefs = aggregatedRows.map((row) => row.pieceRef);
  const existingRefSet = new Set<string>();
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("inventory")
    .select("piece_ref")
    .eq("lot_id", lotId)
    .in("piece_ref", pieceRefs);

  if (existingRowsError) {
    console.error(
      "importLotPiecesFromCsv - existing rows lookup error:",
      existingRowsError
    );
    return {
      success: false,
      error:
        "Impossible de vérifier les lignes existantes du lot avant import.",
      reason: "IMPORT_FAILED",
    };
  }

  for (const row of existingRows ?? []) {
    const pieceRef = row.piece_ref?.trim();
    if (pieceRef) {
      existingRefSet.add(pieceRef);
    }
  }

  const appliedRows: CsvImportAppliedRow[] = [];
  const importWarnings: string[] = [];

  let importedRows = 0;
  let mergedRows = 0;
  let totalImportedQuantity = 0;

  for (const row of aggregatedRows) {
    const action: CsvImportAppliedRow["action"] = existingRefSet.has(row.pieceRef)
      ? "merged"
      : "added";
    const addResult = await addPieceToLot(lotId, {
      pieceRef: row.pieceRef,
      quantity: row.quantity,
    });

    if (!addResult.success) {
      for (const lineNumber of row.lineNumbers) {
        rejectedRows.push({
          lineNumber,
          pieceRef: row.pieceRef,
          quantity: String(row.quantity),
          reason:
            addResult.error ??
            "Impossible d'importer cette référence pour le moment.",
        });
      }
      continue;
    }

    if (typeof addResult.warning === "string" && addResult.warning.length > 0) {
      importWarnings.push(`${row.pieceRef}: ${addResult.warning}`);
    }

    appliedRows.push({
      pieceRef: row.pieceRef,
      quantity: row.quantity,
      action,
      lineNumbers: row.lineNumbers,
    });

    if (action === "merged") {
      mergedRows += 1;
    } else {
      importedRows += 1;
    }

    totalImportedQuantity += row.quantity;
  }

  const summary: CsvImportSummary = {
    totalRows,
    validRows,
    rejectedRows: rejectedRows.length,
    aggregatedRows: aggregatedRows.length,
    importedRows,
    mergedRows,
    appliedRows: appliedRows.length,
    totalImportedQuantity,
  };

  if (appliedRows.length === 0) {
    return {
      success: false,
      error:
        "Aucune ligne n'a pu être importée. Consulte les rejets pour corriger le CSV.",
      reason: "NO_VALID_ROWS",
      summary,
      rejectedRows,
    };
  }

  const warnings: string[] = [];
  if (rejectedRows.length > 0) {
    warnings.push(
      "Certaines lignes ont été rejetées. Vérifie le rapport pour les corriger."
    );
  }
  if (importWarnings.length > 0) {
    warnings.push(importWarnings.join(" "));
  }

  return {
    success: true,
    summary,
    appliedRows,
    rejectedRows,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
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
