"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import {
  getAuthSessionErrorMessage,
  requireActiveSession,
} from "@/lib/auth/require-active-session";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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
      return { ok: false, error: `Trop de requetes. Reessaie dans ${limit.retryAfterSeconds}s.` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getAuthSessionErrorMessage(error) };
  }
}

function normalizeImageUrl(newUrl: string): string | null {
  const normalized = String(newUrl ?? "").trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function updateSetImage(setId: string, newUrl: string) {
  const guard = await enforceCatalogueMutationGuard();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const normalizedSetId = String(setId ?? "").trim();
  if (!SET_ID_REGEX.test(normalizedSetId)) {
    return { success: false, error: "Set invalide." };
  }

  const normalizedImageUrl = normalizeImageUrl(newUrl);
  if (!normalizedImageUrl) {
    return { success: false, error: "URL image invalide (http/https attendu)." };
  }

  try {
    console.log(`Mise a jour image pour ${normalizedSetId}`);

    // 1. Mise à jour dans Supabase
    const { error } = await supabase
      .from("sets_catalog")
      .update({ image_url: normalizedImageUrl })
      .eq("id", normalizedSetId);

    if (error) throw error;

    // 2. Rafraîchissement du cache pour voir le changement immédiatement
    // On rafraîchit la page catalogue et la page détail spécifique
    revalidatePath(`/catalogue`);
    revalidatePath(`/catalogue/${normalizedSetId}`);

    return { success: true };
  } catch (error) {
    console.error("Erreur update image:", error);
    return { success: false, error: "Impossible de mettre à jour l'image." };
  }
}
