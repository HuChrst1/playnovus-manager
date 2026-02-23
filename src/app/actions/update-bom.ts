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
const PIECE_REF_REGEX = /^[A-Za-z0-9._-]+$/;

async function enforceCatalogueMutationGuard(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
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

    return { ok: true, userId: actor.userId };
  } catch (error) {
    return {
      ok: false,
      error: getAuthSessionErrorMessage(error),
    };
  }
}

function normalizeSetId(value: string): string {
  return value.trim();
}

function normalizePieceRef(value: string): string {
  return value.trim().toUpperCase();
}

function normalizePieceName(value: string): string {
  return value.trim();
}

// 1. AJOUTER UNE PIÈCE
export async function addSetPiece(setId: string, pieceRef: string, pieceName: string, quantity: number) {
  const guard = await enforceCatalogueMutationGuard();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const normalizedSetId = normalizeSetId(setId);
  const normalizedPieceRef = normalizePieceRef(pieceRef);
  const normalizedPieceName = normalizePieceName(pieceName);
  const normalizedQuantity = Number(quantity);

  if (!SET_ID_REGEX.test(normalizedSetId)) {
    return { success: false, error: "Set invalide." };
  }

  if (!PIECE_REF_REGEX.test(normalizedPieceRef)) {
    return { success: false, error: "Reference de piece invalide." };
  }

  if (!normalizedPieceName || normalizedPieceName.length > 120) {
    return { success: false, error: "Nom de piece invalide." };
  }

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    return { success: false, error: "La quantite doit etre un entier strictement positif." };
  }

  try {
    const { error } = await supabase.from("sets_bom").insert({
      set_id: normalizedSetId,
      piece_ref: normalizedPieceRef,
      piece_name: normalizedPieceName,
      quantity: normalizedQuantity,
    });

    if (error) throw error;
    revalidatePath(`/catalogue/${normalizedSetId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur ajout piece:", error);
    return { success: false, error: "Impossible d'ajouter la pièce." };
  }
}

// 2. MODIFIER UNE PIÈCE (Quantité ou Nom)
export async function updateSetPiece(id: number, setId: string, updates: { quantity?: number, piece_name?: string }) {
  const guard = await enforceCatalogueMutationGuard();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, error: "Identifiant de ligne invalide." };
  }

  const normalizedSetId = normalizeSetId(setId);
  if (!SET_ID_REGEX.test(normalizedSetId)) {
    return { success: false, error: "Set invalide." };
  }

  const payload: { quantity?: number; piece_name?: string } = {};

  if (updates.quantity !== undefined) {
    const quantity = Number(updates.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, error: "La quantite doit etre un entier strictement positif." };
    }
    payload.quantity = quantity;
  }

  if (updates.piece_name !== undefined) {
    const pieceName = normalizePieceName(updates.piece_name);
    if (!pieceName || pieceName.length > 120) {
      return { success: false, error: "Nom de piece invalide." };
    }
    payload.piece_name = pieceName;
  }

  if (Object.keys(payload).length === 0) {
    return { success: false, error: "Aucune modification valide a appliquer." };
  }

  try {
    const { error } = await supabase
      .from("sets_bom")
      .update(payload)
      .eq("id", id);

    if (error) throw error;
    revalidatePath(`/catalogue/${normalizedSetId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur update piece:", error);
    return { success: false, error: "Impossible de modifier la pièce." };
  }
}

// 3. SUPPRIMER UNE PIÈCE
export async function deleteSetPiece(id: number, setId: string) {
  const guard = await enforceCatalogueMutationGuard();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, error: "Identifiant de ligne invalide." };
  }

  const normalizedSetId = normalizeSetId(setId);
  if (!SET_ID_REGEX.test(normalizedSetId)) {
    return { success: false, error: "Set invalide." };
  }

  try {
    const { error } = await supabase
      .from("sets_bom")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath(`/catalogue/${normalizedSetId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur suppression piece:", error);
    return { success: false, error: "Impossible de supprimer la pièce." };
  }
}
