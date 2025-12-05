"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// 1. AJOUTER UNE PIÈCE
export async function addSetPiece(setId: string, pieceRef: string, pieceName: string, quantity: number) {
  try {
    const { error } = await supabase.from("sets_bom").insert({
      set_id: setId,
      piece_ref: pieceRef,
      piece_name: pieceName,
      quantity: quantity
    });

    if (error) throw error;
    revalidatePath(`/catalogue/${setId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur ajout pièce:", error);
    return { success: false, error: "Impossible d'ajouter la pièce." };
  }
}

// 2. MODIFIER UNE PIÈCE (Quantité ou Nom)
export async function updateSetPiece(id: number, setId: string, updates: { quantity?: number, piece_name?: string }) {
  try {
    const { error } = await supabase
      .from("sets_bom")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
    revalidatePath(`/catalogue/${setId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur update pièce:", error);
    return { success: false, error: "Impossible de modifier la pièce." };
  }
}

// 3. SUPPRIMER UNE PIÈCE
export async function deleteSetPiece(id: number, setId: string) {
  try {
    const { error } = await supabase
      .from("sets_bom")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath(`/catalogue/${setId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur suppression pièce:", error);
    return { success: false, error: "Impossible de supprimer la pièce." };
  }
}