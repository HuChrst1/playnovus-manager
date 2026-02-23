"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APP_HOME_PATH, LOGIN_PATH } from "@/lib/auth/constants";
import { applyAuthSessionCookies, nowInSeconds } from "@/lib/auth/session";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";

function normalizeFieldValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRememberValue(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "1" || value === "true";
}

function redirectToLoginWithError(errorCode: string): never {
  redirect(`${LOGIN_PATH}?error=${encodeURIComponent(errorCode)}`);
}

export async function loginWithPassword(formData: FormData): Promise<never> {
  const email = normalizeFieldValue(formData.get("email"));
  const password = normalizeFieldValue(formData.get("password"));
  const remember = parseRememberValue(formData.get("remember"));

  if (!email || !password) {
    redirectToLoginWithError("missing_fields");
  }

  const supabase = createSupabaseAuthClient();

  if (!supabase) {
    redirectToLoginWithError("configuration_error");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session?.access_token || !data.session.refresh_token) {
    redirectToLoginWithError("invalid_credentials");
  }

  const cookieStore = await cookies();
  const nowSeconds = nowInSeconds();

  applyAuthSessionCookies(
    cookieStore,
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      issuedAt: nowSeconds,
      lastSeenAt: nowSeconds,
      remember,
    },
    { secure: process.env.NODE_ENV === "production" }
  );

  redirect(APP_HOME_PATH);
}
