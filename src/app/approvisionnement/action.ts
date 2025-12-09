"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

type LotStatus = "draft" | "confirmed";

export type CreateLotInput = {
  purchaseDate: string;          // YYYY-MM-DD
  label?: string;
  supplier?: string;
  lotCode?: string;
  totalCost: number;
  totalPieces?: number;
  status?: "draft" | "confirmed";
  notes?: string;
};

type NormalizedLot = {
  purchaseDate: string;
  label: string | null;
  supplier: string | null;
  lotCode: string | null;
  totalCost: number;
  totalPieces: number;
  status: "draft" | "confirmed";
  notes: string | null;
};

// Fonction interne utilisée par les deux variantes
async function insertLot(normalized: NormalizedLot) {
  const { data, error } = await supabase
    .from("lots")
    .insert({
      lot_code: normalized.lotCode,
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

  if (error) {
    console.error("createLot error:", error);
    return {
      success: false as const,
      error:
        "Impossible d'enregistrer le lot. Détail technique : " +
        error.message,
    };
  }

  // on rafraîchit la page /approvisionnement
  revalidatePath("/approvisionnement");

  return {
    success: true as const,
    lotId: data?.id ?? null,
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
  const lotCode = (formData.get("lot_code") as string | null) ?? "";
  const totalCostRaw =
    (formData.get("total_cost") as string | null) ?? "";
  const totalPiecesRaw =
    (formData.get("total_pieces") as string | null) ?? "";
  const statusRaw = (formData.get("status") as string | null) ?? "draft";
  const notes = (formData.get("notes") as string | null) ?? "";

  // --- Validation minimale métier ---
  if (!purchaseDate) {
    return { success: false as const, error: "La date du lot est obligatoire." };
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
  const totalPieces = totalPiecesRaw ? Number(totalPiecesRaw) : 0;

  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return {
      success: false as const,
      error: "Le coût total doit être un nombre positif.",
    };
  }

  if (!Number.isInteger(totalPieces) || totalPieces < 0) {
    return {
      success: false as const,
      error: "Le nombre de pièces doit être un entier positif.",
    };
  }

  const status: "draft" | "confirmed" =
    statusRaw === "confirmed" ? "confirmed" : "draft";

  return insertLot({
    purchaseDate,
    label: label || null,
    supplier: supplier || null,
    lotCode: lotCode || null,
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

  const totalPieces =
    typeof input.totalPieces === "number" && input.totalPieces >= 0
      ? Math.floor(input.totalPieces)
      : 0;

  const status: "draft" | "confirmed" =
    input.status === "confirmed" ? "confirmed" : "draft";

  return insertLot({
    purchaseDate: input.purchaseDate,
    label: input.label?.trim() || null,
    supplier: input.supplier?.trim() || null,
    lotCode: input.lotCode?.trim() || null,
    totalCost: input.totalCost,
    totalPieces,
    status,
    notes: input.notes?.trim() || null,
  });
}

export async function updateLotFromDialog(
  lotId: number,
  args: {
    purchaseDate: string;
    label?: string;
    supplier?: string;
    lotCode?: string;
    totalCost: number;
    totalPieces?: number;
    status: "draft" | "confirmed";
    notes?: string;
  }
) {
  if (!lotId || lotId <= 0) {
    return {
      success: false,
      error: "Identifiant de lot invalide.",
    };
  }

  if (!args.purchaseDate) {
    return {
      success: false,
      error: "La date du lot est obligatoire.",
    };
  }

  if (!Number.isFinite(args.totalCost) || args.totalCost < 0) {
    return {
      success: false,
      error: "Le coût total doit être un nombre positif.",
    };
  }

  let totalPieces: number | undefined = undefined;
  if (typeof args.totalPieces === "number") {
    if (!Number.isInteger(args.totalPieces) || args.totalPieces < 0) {
      return {
        success: false,
        error: "Le nombre de pièces doit être un entier positif.",
      };
    }
    totalPieces = args.totalPieces;
  }

  const status: "draft" | "confirmed" =
    args.status === "confirmed" ? "confirmed" : "draft";

  const updatePayload: any = {
    purchase_date: args.purchaseDate,
    label: args.label ?? null,
    supplier: args.supplier ?? null,
    lot_code: args.lotCode ?? null,
    total_cost: args.totalCost,
    status,
    notes: args.notes ?? null,
  };

  // On ne touche à total_pieces que si une valeur a été fournie
  if (typeof totalPieces === "number") {
    updatePayload.total_pieces = totalPieces;
  }

  const { error } = await supabase
    .from("lots")
    .update(updatePayload)
    .eq("id", lotId);

  if (error) {
    console.error("updateLotFromDialog error:", error);
    return {
      success: false,
      error:
        "Impossible de mettre à jour le lot. Détail technique : " +
        error.message,
    };
  }

  return {
    success: true,
  };
}

export async function deleteLot(lotId: number) {
  // Sécurité minimale
  if (!lotId || Number.isNaN(lotId)) {
    return { success: false, error: "Lot invalide." };
  }

  const { error } = await supabase
    .from("lots")
    .delete()
    .eq("id", lotId);

  if (error) {
    console.error("deleteLot error:", error);
    return {
      success: false,
      error:
        "Impossible de supprimer ce lot. Détail technique : " +
        error.message,
    };
  }

  // On invalide les caches de la page d'approvisionnement
  revalidatePath("/approvisionnement");

  return { success: true };
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

  // Optionnel : verrouiller l’ajout si le lot est confirmé
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status")
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

  const { error: insertError } = await supabase.from("inventory").insert({
    lot_id: lotId,
    piece_ref: pieceRef,
    quantity,
    location: null,
  });

  if (insertError) {
    console.error("addPieceToLot insert error:", insertError);
    return {
      success: false,
      error:
        "Impossible d'ajouter la pièce au lot. Détail technique : " +
        insertError.message,
    };
  }

  // Raffraîchit la page du lot
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

  // Vérifie que le lot est toujours en brouillon
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status")
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

  // Vérifie que le lot est toujours en brouillon
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("status")
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

  revalidatePath(`/approvisionnement/${lotId}`);

  return { success: true as const };
}