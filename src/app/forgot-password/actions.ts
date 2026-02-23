"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH } from "@/lib/auth/constants";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const FORGOT_PASSWORD_RATE_LIMIT = {
  scope: "auth_forgot_password",
  limit: 3,
  windowMs: 15 * 60 * 1000,
} as const;

function normalizeFieldValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
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
  const captchaToken = normalizeFieldValue(formData.get("captchaToken"));

  if (!email) {
    redirect(`${FORGOT_PASSWORD_PATH}?error=missing_email`);
  }

  if (!captchaToken) {
    redirect(`${FORGOT_PASSWORD_PATH}?error=captcha_required`);
  }

  const rateLimitKey = await getRequestRateLimitKey();
  const rateLimit = enforceRateLimit(
    FORGOT_PASSWORD_RATE_LIMIT.scope,
    rateLimitKey,
    FORGOT_PASSWORD_RATE_LIMIT.limit,
    FORGOT_PASSWORD_RATE_LIMIT.windowMs
  );
  if (!rateLimit.allowed) {
    redirect(`${FORGOT_PASSWORD_PATH}?error=rate_limited`);
  }

  const supabase = createSupabaseAuthClient();
  if (!supabase) {
    redirect(`${FORGOT_PASSWORD_PATH}?error=configuration_error`);
  }

  const redirectTo = await buildResetRedirectUrl();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
      captchaToken,
    });

    if (error) {
      if (isCaptchaErrorMessage(error.message)) {
        redirect(`${FORGOT_PASSWORD_PATH}?error=captcha_invalid`);
      }

      if (isRateLimitErrorMessage(error.message)) {
        redirect(`${FORGOT_PASSWORD_PATH}?error=rate_limited`);
      }
    }
  } catch {
    // Keep response neutral to avoid account enumeration.
  }

  redirect(`${FORGOT_PASSWORD_PATH}?sent=1`);
}
