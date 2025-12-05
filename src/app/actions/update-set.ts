"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function updateSetImage(setId: string, newUrl: string) {
  try {
    console.log(`🖼️ Mise à jour image pour ${setId} -> ${newUrl}`);

    // 1. Mise à jour dans Supabase
    const { error } = await supabase
      .from("sets_catalog")
      .update({ image_url: newUrl })
      .eq("id", setId);

    if (error) throw error;

    // 2. Rafraîchissement du cache pour voir le changement immédiatement
    // On rafraîchit la page catalogue et la page détail spécifique
    revalidatePath(`/catalogue`);
    revalidatePath(`/catalogue/${setId}`);

    return { success: true };
  } catch (error) {
    console.error("Erreur update image:", error);
    return { success: false, error: "Impossible de mettre à jour l'image." };
  }
}