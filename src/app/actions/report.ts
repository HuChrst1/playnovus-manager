"use server";

import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import { readAuthSessionFromCookies } from "@/lib/auth/session";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";
import {
  isReportCategory,
  isReportClosedStatus,
  isReportStatus,
  isReportTargetScope,
  type ReportCategory,
  type ReportStatus,
  type ReportTargetScope,
} from "@/lib/report-types";

type ReportTicketRow = Tables<"report_tickets">;
type ReportTicketInsert = TablesInsert<"report_tickets">;
type ReportTicketUpdate = TablesUpdate<"report_tickets">;

type ReportTicketStatusRank = 0 | 1;
type ReportTicketActor = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

export type ReportTicketResult = {
  success: boolean;
  error?: string;
  ticket?: ReportTicketRow;
};

export type ReportTicketsResult = {
  success: boolean;
  error?: string;
  tickets?: ReportTicketRow[];
};

export type DeleteReportTicketResult = {
  success: boolean;
  error?: string;
};

export type CreateReportTicketInput = {
  target_scope: ReportTargetScope;
  category: ReportCategory;
  description: string;
};

export type UpdateReportTicketInput = {
  id: number;
  status: ReportStatus;
  closed: boolean;
};

const MAX_DESCRIPTION_LENGTH = 2000;

function readMetadataValue(metadata: unknown, key: string): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const rawValue = (metadata as Record<string, unknown>)[key];
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveDisplayName(user: User): string | null {
  const userMetadata = user.user_metadata;
  const appMetadata = user.app_metadata;

  return (
    readMetadataValue(userMetadata, "display_name") ??
    readMetadataValue(userMetadata, "full_name") ??
    readMetadataValue(userMetadata, "name") ??
    readMetadataValue(userMetadata, "alias") ??
    readMetadataValue(userMetadata, "username") ??
    readMetadataValue(userMetadata, "preferred_username") ??
    readMetadataValue(appMetadata, "display_name") ??
    readMetadataValue(appMetadata, "alias")
  );
}

async function resolveCurrentActor(): Promise<ReportTicketActor | null> {
  const cookieStore = await cookies();
  const session = readAuthSessionFromCookies(cookieStore);

  if (!session.accessToken) {
    return null;
  }

  const supabaseAuth = createSupabaseAuthClient();
  if (!supabaseAuth) {
    return null;
  }

  const { data, error } = await supabaseAuth.auth.getUser(session.accessToken);
  if (error || !data.user?.id) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    displayName: resolveDisplayName(data.user),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }

  return fallback;
}

function getStatusRank(status: string | null | undefined): ReportTicketStatusRank {
  return status === "OPEN" ? 0 : 1;
}

function sortTicketsByDefaultOrder(tickets: ReportTicketRow[]): ReportTicketRow[] {
  return [...tickets].sort((a, b) => {
    const rankDiff = getStatusRank(a.status) - getStatusRank(b.status);
    if (rankDiff !== 0) return rankDiff;

    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return timeB - timeA;
  });
}

function normalizeDescription(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function validateCreateInput(input: CreateReportTicketInput): string | null {
  if (!isReportTargetScope(input.target_scope)) {
    return "Cible invalide.";
  }

  if (!isReportCategory(input.category)) {
    return "Categorie invalide.";
  }

  const description = normalizeDescription(String(input.description ?? ""));
  if (!description) {
    return "La description est obligatoire.";
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return `La description ne doit pas depasser ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  }

  return null;
}

function validateUpdateInput(input: UpdateReportTicketInput): string | null {
  if (!Number.isFinite(input.id) || input.id <= 0) {
    return "Ticket invalide.";
  }

  if (!isReportStatus(input.status)) {
    return "Statut invalide.";
  }

  if (typeof input.closed !== "boolean") {
    return "Valeur de cloture invalide.";
  }

  return null;
}

export async function createReportTicketAction(
  input: CreateReportTicketInput
): Promise<ReportTicketResult> {
  const validationError = validateCreateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const description = normalizeDescription(input.description);
  const actor = await resolveCurrentActor();
  if (!actor) {
    return { success: false, error: "Session invalide. Reconnecte-toi puis reessaie." };
  }

  const payload: ReportTicketInsert = {
    target_scope: input.target_scope,
    category: input.category,
    description,
    status: "OPEN",
    closed_at: null,
    created_by_user_id: actor.userId,
    created_by_email: actor.email,
    created_by_display_name: actor.displayName,
    closed_by_user_id: null,
    closed_by_email: null,
    closed_by_display_name: null,
  };

  const { data, error } = await supabase
    .from("report_tickets")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Impossible de creer le ticket."),
    };
  }

  return { success: true, ticket: data };
}

export async function listReportTicketsAction(): Promise<ReportTicketsResult> {
  const { data, error } = await supabase
    .from("report_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Impossible de charger les tickets."),
    };
  }

  return { success: true, tickets: sortTicketsByDefaultOrder(data ?? []) };
}

export async function updateReportTicketAction(
  input: UpdateReportTicketInput
): Promise<ReportTicketResult> {
  const validationError = validateUpdateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { data: existing, error: existingError } = await supabase
    .from("report_tickets")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();

  if (existingError) {
    return {
      success: false,
      error: getErrorMessage(existingError, "Impossible de lire le ticket."),
    };
  }

  if (!existing) {
    return {
      success: false,
      error: "Ticket introuvable.",
    };
  }

  const payload: ReportTicketUpdate = {};
  const actor = await resolveCurrentActor();

  if (!actor) {
    return {
      success: false,
      error: "Session invalide. Reconnecte-toi puis reessaie.",
    };
  }

  if (input.closed) {
    if (!isReportClosedStatus(input.status)) {
      return {
        success: false,
        error: "Le statut d'un ticket cloture doit etre RESOLVED ou IGNORED.",
      };
    }

    payload.status = input.status;
    payload.closed_at = existing.closed_at ?? new Date().toISOString();
    payload.closed_by_user_id = actor.userId;
    payload.closed_by_email = actor.email;
    payload.closed_by_display_name = actor.displayName;
  } else {
    payload.status = "OPEN";
    payload.closed_at = null;
    payload.closed_by_user_id = null;
    payload.closed_by_email = null;
    payload.closed_by_display_name = null;
  }

  const { data, error } = await supabase
    .from("report_tickets")
    .update(payload)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Impossible de mettre a jour le ticket."),
    };
  }

  return { success: true, ticket: data };
}

export async function deleteReportTicketAction(
  id: number
): Promise<DeleteReportTicketResult> {
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: "Ticket invalide." };
  }

  const { data, error } = await supabase
    .from("report_tickets")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Impossible de supprimer le ticket."),
    };
  }

  if (!data) {
    return { success: false, error: "Ticket introuvable." };
  }

  return { success: true };
}
