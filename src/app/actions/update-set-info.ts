"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

interface UpdateSetData {
  name: string;
  display_ref: string;
  version: string;
  year_start: number | null;
  year_end: number | null;
  theme: string;
}

export async function updateSetInfo(setId: string, data: UpdateSetData) {
  try {
    console.log(`📝 Mise à jour infos pour ${setId}`, data);

    const { error } = await supabase
      .from("sets_catalog")
      .update({
        name: data.name,
        display_ref: data.display_ref,
        version: data.version,
        year_start: data.year_start,
        year_end: data.year_end,
        theme: data.theme,
      })
      .eq("id", setId);

    if (error) throw error;

    // On rafraîchit la page pour voir les changements tout de suite
    revalidatePath(`/catalogue/${setId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur update infos:", error);
    return { success: false, error: "Erreur lors de la sauvegarde." };
  }
}