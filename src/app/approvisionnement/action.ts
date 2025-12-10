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

  // Nb pièces : toujours 0 à la création, recalculé ensuite via inventory
  const totalPieces = 0;

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

  // Nb pièces : toujours 0 à la création, recalculé ensuite via inventory
  const totalPieces = 0;

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

  const status: LotStatus =
    args.status === "confirmed" ? "confirmed" : "draft";

  // 1) On récupère le statut actuel pour détecter un passage draft -> confirmed
  const { data: existingLot, error: fetchError } = await supabase
    .from("lots")
    .select("status")
    .eq("id", lotId)
    .single();

  if (fetchError || !existingLot) {
    console.error(
      "updateLotFromDialog - erreur lors de la lecture du lot:",
      fetchError
    );
    return {
      success: false,
      error: "Impossible de récupérer le lot avant mise à jour.",
    };
  }

  const previousStatus = (existingLot.status as LotStatus) ?? "draft";

  const updatePayload: any = {
    purchase_date: args.purchaseDate,
    label: args.label ?? null,
    supplier: args.supplier ?? null,
    lot_code: args.lotCode ?? null,
    total_cost: args.totalCost,
    status,
    notes: args.notes ?? null,
  };

  // ⚠️ On ne touche plus jamais à total_pieces ici :
  // il est recalculé automatiquement via les lignes d'inventaire.

  // 2) Mise à jour du lot
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
    };
  }

  // 3) Si on vient de passer de draft -> confirmed,
  //    on crée les mouvements IN pour ce lot
  if (previousStatus !== "confirmed" && status === "confirmed") {
    const movementsResult = await createStockMovementsForLot(lotId);

    if (!movementsResult.success) {
      // On log l'erreur mais on ne bloque pas la mise à jour du lot
      console.error(
        "updateLotFromDialog - erreur lors de la création des mouvements de stock:",
        movementsResult.error
      );
      // Optionnel : on pourrait renvoyer un warning dans le futur
    }
  }

  // 4) On rafraîchit les pages liées
  revalidatePath("/approvisionnement");
  revalidatePath(`/approvisionnement/${lotId}`);
  revalidatePath("/stock");

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