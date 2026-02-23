"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import {
  getAuthSessionErrorMessage,
  requireActiveSession,
} from "@/lib/auth/require-active-session";
import { enforceRateLimit } from "@/lib/security/rate-limit";

interface UpdateSetData {
  name: string;
  display_ref: string;
  version: string;
  year_start: number | null;
  year_end: number | null;
  theme: string;
  image_url?: string | null;
}

const CATALOGUE_RATE_LIMIT = {
  scope: "catalogue_mutations",
  limit: 30,
  windowMs: 5 * 60 * 1000,
} as const;

const SET_ID_REGEX = /^[A-Za-z0-9_-]+$/;

async function enforceCatalogueMutationGuard(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireActiveSession();
    const limit = enforceRateLimit(
      CATALOGUE_RATE_LIMIT.scope,
      actor.userId,
      CATALOGUE_RATE_LIMIT.limit,
      CATALOGUE_RATE_LIMIT.windowMs
    );
    if (!limit.allowed) {
      return {
        ok: false,
        error: `Trop de requetes. Reessaie dans ${limit.retryAfterSeconds}s.`,
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getAuthSessionErrorMessage(error) };
  }
}

function normalizeText(value: string, maxLength: number): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }
  return normalized;
}

function normalizeOptionalText(
  value: string,
  maxLength: number
): { value: string | null; valid: boolean } {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return { value: null, valid: true };
  }
  if (normalized.length > maxLength) {
    return { value: null, valid: false };
  }
  return { value: normalized, valid: true };
}

function normalizeOptionalImageUrl(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function updateSetInfo(setId: string, data: UpdateSetData) {
  const guard = await enforceCatalogueMutationGuard();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const normalizedSetId = String(setId ?? "").trim();
  if (!SET_ID_REGEX.test(normalizedSetId)) {
    return { success: false, error: "Set invalide." };
  }

  const normalizedName = normalizeText(data.name, 160);
  if (!normalizedName) {
    return { success: false, error: "Nom invalide." };
  }

  const normalizedDisplayRef = normalizeText(data.display_ref, 64);
  if (!normalizedDisplayRef) {
    return { success: false, error: "Reference affichee invalide." };
  }

  const normalizedVersion = normalizeOptionalText(data.version, 64);
  const normalizedTheme = normalizeOptionalText(data.theme, 120);
  const normalizedImageUrl = normalizeOptionalImageUrl(data.image_url ?? null);

  if (!normalizedVersion.valid) {
    return { success: false, error: "Version invalide (64 caracteres max)." };
  }

  if (!normalizedTheme.valid) {
    return { success: false, error: "Theme invalide (120 caracteres max)." };
  }

  const yearStart =
    data.year_start === null || data.year_start === undefined
      ? null
      : Number(data.year_start);
  const yearEnd =
    data.year_end === null || data.year_end === undefined
      ? null
      : Number(data.year_end);

  if (yearStart !== null && (!Number.isInteger(yearStart) || yearStart < 1900 || yearStart > 2100)) {
    return { success: false, error: "Annee de debut invalide." };
  }

  if (yearEnd !== null && (!Number.isInteger(yearEnd) || yearEnd < 1900 || yearEnd > 2100)) {
    return { success: false, error: "Annee de fin invalide." };
  }

  if (yearStart !== null && yearEnd !== null && yearStart > yearEnd) {
    return { success: false, error: "L'annee de debut doit etre inferieure ou egale a l'annee de fin." };
  }

  const hasImageUrlInput = typeof data.image_url === "string" && data.image_url.trim().length > 0;
  if (hasImageUrlInput && !normalizedImageUrl) {
    return { success: false, error: "URL image invalide (http/https attendu)." };
  }

  try {
    console.log(`Mise a jour infos pour ${normalizedSetId}`);

    const { error } = await supabase
      .from("sets_catalog")
      .update({
        name: normalizedName,
        display_ref: normalizedDisplayRef,
        version: normalizedVersion.value,
        year_start: yearStart,
        year_end: yearEnd,
        theme: normalizedTheme.value,
        image_url: normalizedImageUrl,
      })
      .eq("id", normalizedSetId);

    if (error) throw error;

    // On rafraîchit la page pour voir les changements tout de suite
    revalidatePath("/catalogue");
    revalidatePath(`/catalogue/${normalizedSetId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur update infos:", error);
    return { success: false, error: "Erreur lors de la sauvegarde." };
  }
}
