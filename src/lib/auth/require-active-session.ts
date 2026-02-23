import { cookies } from "next/headers";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";
import {
  isSessionWindowExpired,
  nowInSeconds,
  readAuthSessionFromCookies,
} from "@/lib/auth/session";

export type AuthSessionFailureCode =
  | "request_context_missing"
  | "session_missing"
  | "session_expired"
  | "configuration_error"
  | "session_invalid";

export class AuthSessionError extends Error {
  code: AuthSessionFailureCode;

  constructor(code: AuthSessionFailureCode, message: string) {
    super(message);
    this.name = "AuthSessionError";
    this.code = code;
  }
}

export type ActiveSessionContext = {
  userId: string;
  email: string | null;
  displayName: string | null;
  accessToken: string;
  isLocalBypass: boolean;
};

function normalizeMetadataString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveDisplayName(userMetadata: unknown, appMetadata: unknown): string | null {
  const user = typeof userMetadata === "object" && userMetadata !== null ? userMetadata : {};
  const app = typeof appMetadata === "object" && appMetadata !== null ? appMetadata : {};

  const userRecord = user as Record<string, unknown>;
  const appRecord = app as Record<string, unknown>;

  return (
    normalizeMetadataString(userRecord.display_name) ??
    normalizeMetadataString(userRecord.full_name) ??
    normalizeMetadataString(userRecord.name) ??
    normalizeMetadataString(userRecord.alias) ??
    normalizeMetadataString(userRecord.username) ??
    normalizeMetadataString(userRecord.preferred_username) ??
    normalizeMetadataString(appRecord.display_name) ??
    normalizeMetadataString(appRecord.alias)
  );
}

function isLocalValidationBypassEnabled(): boolean {
  if (process.env.PLAYNOVUS_LOCAL_VALIDATION_BYPASS === "1") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return false;
}

function buildLocalValidationActor(): ActiveSessionContext {
  const pseudoUserId =
    normalizeMetadataString(process.env.PLAYNOVUS_LOCAL_VALIDATION_USER_ID) ??
    "local-validation-actor";

  return {
    userId: pseudoUserId,
    email: null,
    displayName: "Local validation actor",
    accessToken: "local-validation-token",
    isLocalBypass: true,
  };
}

export async function requireActiveSession(): Promise<ActiveSessionContext> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;

  try {
    cookieStore = await cookies();
  } catch {
    if (isLocalValidationBypassEnabled()) {
      return buildLocalValidationActor();
    }

    throw new AuthSessionError(
      "request_context_missing",
      "Contexte de session indisponible pour cette operation."
    );
  }

  const snapshot = readAuthSessionFromCookies(cookieStore);
  const currentSeconds = nowInSeconds();

  if (!snapshot.accessToken) {
    if (isLocalValidationBypassEnabled()) {
      return buildLocalValidationActor();
    }

    throw new AuthSessionError("session_missing", "Aucune session active detectee.");
  }

  if (isSessionWindowExpired(snapshot, currentSeconds)) {
    throw new AuthSessionError("session_expired", "La session a expire.");
  }

  const supabaseAuth = createSupabaseAuthClient();
  if (!supabaseAuth) {
    throw new AuthSessionError(
      "configuration_error",
      "Configuration Supabase Auth indisponible."
    );
  }

  const firstAttempt = await supabaseAuth.auth.getUser(snapshot.accessToken);
  if (!firstAttempt.error && firstAttempt.data.user?.id) {
    return {
      userId: firstAttempt.data.user.id,
      email: firstAttempt.data.user.email ?? null,
      displayName: resolveDisplayName(
        firstAttempt.data.user.user_metadata,
        firstAttempt.data.user.app_metadata
      ),
      accessToken: snapshot.accessToken,
      isLocalBypass: false,
    };
  }

  if (!snapshot.refreshToken) {
    throw new AuthSessionError("session_invalid", "Session invalide. Reconnecte-toi puis reessaie.");
  }

  const refreshAttempt = await supabaseAuth.auth.refreshSession({
    refresh_token: snapshot.refreshToken,
  });

  const refreshedSession = refreshAttempt.data.session;
  if (
    refreshAttempt.error ||
    !refreshedSession?.access_token ||
    !refreshAttempt.data.user?.id
  ) {
    throw new AuthSessionError("session_invalid", "Session invalide. Reconnecte-toi puis reessaie.");
  }

  return {
    userId: refreshAttempt.data.user.id,
    email: refreshAttempt.data.user.email ?? null,
    displayName: resolveDisplayName(
      refreshAttempt.data.user.user_metadata,
      refreshAttempt.data.user.app_metadata
    ),
    accessToken: refreshedSession.access_token,
    isLocalBypass: false,
  };
}

export function getAuthSessionErrorMessage(
  error: unknown,
  fallback = "Session invalide. Reconnecte-toi puis reessaie."
): string {
  if (error instanceof AuthSessionError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
