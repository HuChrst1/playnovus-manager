"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH } from "@/lib/auth/constants";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";

function normalizeFieldValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildOriginFromHeaders(headerStore: Headers): string | null {
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) return null;

  const protocol =
    headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}

async function buildResetRedirectUrl(): Promise<string> {
  const headerStore = await headers();
  const origin = buildOriginFromHeaders(headerStore);

  if (origin) {
    return `${origin}${RESET_PASSWORD_PATH}`;
  }

  return `http://127.0.0.1:3000${RESET_PASSWORD_PATH}`;
}

export async function requestPasswordReset(formData: FormData): Promise<never> {
  const email = normalizeFieldValue(formData.get("email"));

  if (!email) {
    redirect(`${FORGOT_PASSWORD_PATH}?error=missing_email`);
  }

  const supabase = createSupabaseAuthClient();
  if (!supabase) {
    redirect(`${FORGOT_PASSWORD_PATH}?error=configuration_error`);
  }

  const redirectTo = await buildResetRedirectUrl();

  try {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // Keep response neutral to avoid account enumeration.
  }

  redirect(`${FORGOT_PASSWORD_PATH}?sent=1`);
}
