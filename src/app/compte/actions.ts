"use server";

import { redirect } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";
import { supabaseServer } from "@/lib/supabase-server";
import {
  getAuthSessionErrorMessage,
  requireActiveSession,
} from "@/lib/auth/require-active-session";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const COMPTE_PATH = "/compte";
const MIN_PASSWORD_LENGTH = 8;
const CHANGE_PASSWORD_RATE_LIMIT = {
  scope: "compte_change_password",
  limit: 5,
  windowMs: 15 * 60 * 1000,
} as const;

type PasswordErrorCode =
  | "missing_fields"
  | "weak_password"
  | "mismatch"
  | "same_password"
  | "session_invalid"
  | "invalid_current_password"
  | "configuration_error"
  | "rate_limited"
  | "update_failed";

function normalizeFieldValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildCompteRedirect(params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params);
  return `${COMPTE_PATH}?${searchParams.toString()}`;
}

function redirectWithPasswordError(errorCode: PasswordErrorCode): never {
  redirect(buildCompteRedirect({ password_error: errorCode }));
}

function redirectWithPasswordSuccess(): never {
  redirect(buildCompteRedirect({ password: "updated" }));
}

export async function changePasswordAction(formData: FormData): Promise<never> {
  const currentPassword = normalizeFieldValue(formData.get("currentPassword"));
  const nextPassword = normalizeFieldValue(formData.get("nextPassword"));
  const confirmPassword = normalizeFieldValue(formData.get("confirmPassword"));

  if (!currentPassword || !nextPassword || !confirmPassword) {
    redirectWithPasswordError("missing_fields");
  }

  if (nextPassword.length < MIN_PASSWORD_LENGTH) {
    redirectWithPasswordError("weak_password");
  }

  if (nextPassword !== confirmPassword) {
    redirectWithPasswordError("mismatch");
  }

  if (nextPassword === currentPassword) {
    redirectWithPasswordError("same_password");
  }

  let actor;
  try {
    actor = await requireActiveSession();
  } catch (error) {
    const mappedError = getAuthSessionErrorMessage(error);
    if (mappedError.toLowerCase().includes("configuration")) {
      redirectWithPasswordError("configuration_error");
    }
    redirectWithPasswordError("session_invalid");
  }

  const rateLimit = enforceRateLimit(
    CHANGE_PASSWORD_RATE_LIMIT.scope,
    actor.userId,
    CHANGE_PASSWORD_RATE_LIMIT.limit,
    CHANGE_PASSWORD_RATE_LIMIT.windowMs
  );
  if (!rateLimit.allowed) {
    redirectWithPasswordError("rate_limited");
  }

  if (!actor.email) {
    redirectWithPasswordError("session_invalid");
  }

  const supabaseAuth = createSupabaseAuthClient();
  if (!supabaseAuth) {
    redirectWithPasswordError("configuration_error");
  }

  const { data: currentUserData, error: currentUserError } = await supabaseAuth.auth.getUser(
    actor.accessToken
  );
  const currentUser = currentUserData.user;

  if (currentUserError || !currentUser?.id || !currentUser.email) {
    redirectWithPasswordError("session_invalid");
  }

  const { error: reauthError, data: reauthData } = await supabaseAuth.auth.signInWithPassword({
    email: actor.email,
    password: currentPassword,
  });

  if (reauthError || !reauthData.session) {
    redirectWithPasswordError("invalid_current_password");
  }

  const { error: updateError } = await supabaseServer.auth.admin.updateUserById(currentUser.id, {
    password: nextPassword,
  });

  if (updateError) {
    redirectWithPasswordError("update_failed");
  }

  redirectWithPasswordSuccess();
}
