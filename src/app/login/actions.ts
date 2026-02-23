"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  APP_HOME_PATH,
  LOGIN_NOTICE_LOGOUT_SUCCESS,
  LOGIN_NOTICE_QUERY_PARAM,
  LOGIN_PATH,
} from "@/lib/auth/constants";
import {
  applyAuthSessionCookies,
  clearAuthSessionCookies,
  nowInSeconds,
  readAuthSessionFromCookies,
} from "@/lib/auth/session";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const LOGIN_RATE_LIMIT = {
  scope: "auth_login",
  limit: 5,
  windowMs: 5 * 60 * 1000,
} as const;

function normalizeFieldValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRememberValue(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "1" || value === "true";
}

function redirectToLoginWithError(errorCode: string): never {
  redirect(`${LOGIN_PATH}?error=${encodeURIComponent(errorCode)}`);
}

function isCaptchaErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("captcha") || normalized.includes("turnstile");
}

function isRateLimitErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("rate") && normalized.includes("limit");
}

async function getRequestRateLimitKey(): Promise<string> {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    if (forwardedFor) {
      const firstIp = forwardedFor.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }

    const realIp = headerStore.get("x-real-ip");
    if (realIp?.trim()) return realIp.trim();

    return headerStore.get("host") ?? "unknown-host";
  } catch {
    return "unknown-host";
  }
}

export async function loginWithPassword(formData: FormData): Promise<never> {
  const email = normalizeFieldValue(formData.get("email"));
  const password = normalizeFieldValue(formData.get("password"));
  const remember = parseRememberValue(formData.get("remember"));
  const captchaToken = normalizeFieldValue(formData.get("captchaToken"));

  if (!email || !password) {
    redirectToLoginWithError("missing_fields");
  }

  if (!captchaToken) {
    redirectToLoginWithError("captcha_required");
  }

  const rateLimitKey = await getRequestRateLimitKey();
  const rateLimit = enforceRateLimit(
    LOGIN_RATE_LIMIT.scope,
    rateLimitKey,
    LOGIN_RATE_LIMIT.limit,
    LOGIN_RATE_LIMIT.windowMs
  );
  if (!rateLimit.allowed) {
    redirectToLoginWithError("rate_limited");
  }

  const supabase = createSupabaseAuthClient();

  if (!supabase) {
    redirectToLoginWithError("configuration_error");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (error) {
    if (isCaptchaErrorMessage(error.message)) {
      redirectToLoginWithError("captcha_invalid");
    }

    if (isRateLimitErrorMessage(error.message)) {
      redirectToLoginWithError("rate_limited");
    }
  }

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

function buildLoginNoticeRedirect(notice: string): string {
  const searchParams = new URLSearchParams();
  searchParams.set(LOGIN_NOTICE_QUERY_PARAM, notice);
  return `${LOGIN_PATH}?${searchParams.toString()}`;
}

export async function logoutCurrentSession(): Promise<never> {
  const cookieStore = await cookies();
  const snapshot = readAuthSessionFromCookies(cookieStore);
  const supabase = createSupabaseAuthClient();

  if (supabase && snapshot.accessToken && snapshot.refreshToken) {
    try {
      await supabase.auth.setSession({
        access_token: snapshot.accessToken,
        refresh_token: snapshot.refreshToken,
      });
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Session cleanup must still complete even when Supabase sign-out fails.
    }
  }

  clearAuthSessionCookies(cookieStore);
  redirect(buildLoginNoticeRedirect(LOGIN_NOTICE_LOGOUT_SUCCESS));
}
