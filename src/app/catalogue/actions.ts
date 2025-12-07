"use server";

import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Création d’un set
 */
export async function createSet(formData: FormData) {
  const display_ref = formData.get("display_ref")?.toString().trim() ?? "";
  const name = formData.get("name")?.toString().trim() ?? "";
  const version = formData.get("version")?.toString().trim() || null;
  const theme = formData.get("theme")?.toString().trim() || null;
  const image_url = formData.get("image_url")?.toString().trim() || null;

  const yearStartRaw = formData.get("year_start")?.toString().trim();
  const yearEndRaw = formData.get("year_end")?.toString().trim();

  const year_start =
    yearStartRaw && !Number.isNaN(Number(yearStartRaw))
      ? Number(yearStartRaw)
      : null;

  const year_end =
    yearEndRaw && !Number.isNaN(Number(yearEndRaw))
      ? Number(yearEndRaw)
      : null;

  if (!display_ref || !name) {
    return;
  }

  const { data, error } = await supabase
    .from("sets_catalog")
    .insert({
      display_ref,
      name,
      version,
      theme,
      image_url,
      year_start,
      year_end,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erreur createSet:", error);
    redirect("/catalogue");
  }

  redirect(`/catalogue/${encodeURIComponent(data.id)}`);
}

/**
 * Suppression d’un set
 */
export async function deleteSet(formData: FormData) {
  const id = formData.get("id")?.toString().trim();

  if (!id) {
    console.error("deleteSet appelé sans id");
    redirect("/catalogue");
  }

  const { error } = await supabase
    .from("sets_catalog")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erreur deleteSet:", error);
    // On revient quand même au catalogue
    redirect("/catalogue");
  }

  // Après suppression : retour au catalogue (page 1, filtres réinitialisés)
  redirect("/catalogue");
}
