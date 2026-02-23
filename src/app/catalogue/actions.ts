"use server";

import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { TablesInsert } from "@/types/supabase";
import { requireActiveSession } from "@/lib/auth/require-active-session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { LOGIN_PATH } from "@/lib/auth/constants";

const CATALOGUE_RATE_LIMIT = {
  scope: "catalogue_mutations",
  limit: 30,
  windowMs: 5 * 60 * 1000,
} as const;

const SET_ID_REGEX = /^[A-Za-z0-9_-]+$/;

function redirectToCatalogueWithError(code: string): never {
  redirect(`/catalogue?error=${encodeURIComponent(code)}`);
}

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = value?.toString().trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    return null;
  }
  return normalized;
}

function parseOptionalYear(value: FormDataEntryValue | null): number | null {
  const raw = value?.toString().trim() ?? "";
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    return null;
  }
  return parsed;
}

function normalizeOptionalImageUrl(
  value: FormDataEntryValue | null
): { value: string | null; valid: boolean } {
  const raw = value?.toString().trim() ?? "";
  if (!raw) return { value: null, valid: true };

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { value: null, valid: false };
    }
    return { value: parsed.toString(), valid: true };
  } catch {
    return { value: null, valid: false };
  }
}

async function enforceCatalogueMutationGuard(): Promise<void> {
  try {
    const actor = await requireActiveSession();
    const limit = enforceRateLimit(
      CATALOGUE_RATE_LIMIT.scope,
      actor.userId,
      CATALOGUE_RATE_LIMIT.limit,
      CATALOGUE_RATE_LIMIT.windowMs
    );

    if (!limit.allowed) {
      redirectToCatalogueWithError("rate_limited");
    }
  } catch {
    redirect(`${LOGIN_PATH}?error=session_invalid`);
  }
}

/**
 * Création d’un set
 */
export async function createSet(formData: FormData) {
  await enforceCatalogueMutationGuard();

  const displayRef = normalizeOptionalText(formData.get("display_ref"), 64);
  const name = normalizeOptionalText(formData.get("name"), 160);
  const version = normalizeOptionalText(formData.get("version"), 64);
  const theme = normalizeOptionalText(formData.get("theme"), 120);
  const imageUrl = normalizeOptionalImageUrl(formData.get("image_url"));
  const yearStart = parseOptionalYear(formData.get("year_start"));
  const yearEnd = parseOptionalYear(formData.get("year_end"));

  if (!displayRef || !name) {
    redirectToCatalogueWithError("invalid_payload");
  }

  if (yearStart !== null && yearEnd !== null && yearStart > yearEnd) {
    redirectToCatalogueWithError("invalid_year_range");
  }

  if (!imageUrl.valid) {
    redirectToCatalogueWithError("invalid_image_url");
  }

  const insertPayload = {
    display_ref: displayRef,
    name,
    version,
    theme,
    image_url: imageUrl.value,
    year_start: yearStart,
    year_end: yearEnd,
  } satisfies Omit<TablesInsert<"sets_catalog">, "id">;

  const { data, error } = await supabase
    .from("sets_catalog")
    .insert(insertPayload as unknown as TablesInsert<"sets_catalog">)
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
  await enforceCatalogueMutationGuard();

  const id = formData.get("id")?.toString().trim() ?? "";

  if (!SET_ID_REGEX.test(id)) {
    console.error("deleteSet appelé sans id");
    redirectToCatalogueWithError("invalid_set_id");
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
