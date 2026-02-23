import { NextResponse, type NextRequest } from "next/server";
import { APP_HOME_PATH, LOGIN_PATH } from "@/lib/auth/constants";
import {
  applyAuthSessionCookies,
  applyLastSeenCookie,
  clearAuthSessionCookies,
  hasLegacySessionToken,
  hasSessionTokens,
  isSessionWindowExpired,
  nowInSeconds,
  readAuthSessionFromCookies,
  shouldTouchLastSeen,
  type AuthSessionSnapshot,
} from "@/lib/auth/session";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";

type SessionValidationResult = {
  valid: boolean;
  accessToken: string | null;
  refreshToken: string | null;
};

async function validateOrRefreshSession(snapshot: AuthSessionSnapshot): Promise<SessionValidationResult> {
  const supabase = createSupabaseAuthClient();

  if (!supabase) {
    return {
      valid: false,
      accessToken: null,
      refreshToken: null,
    };
  }

  if (!snapshot.accessToken) {
    return {
      valid: false,
      accessToken: null,
      refreshToken: null,
    };
  }

  const userAttempt = await supabase.auth.getUser(snapshot.accessToken);
  if (!userAttempt.error && userAttempt.data.user) {
    return {
      valid: true,
      accessToken: snapshot.accessToken,
      refreshToken: snapshot.refreshToken,
    };
  }

  if (!snapshot.refreshToken) {
    return {
      valid: false,
      accessToken: null,
      refreshToken: null,
    };
  }

  const refreshAttempt = await supabase.auth.refreshSession({
    refresh_token: snapshot.refreshToken,
  });

  const refreshedSession = refreshAttempt.data.session;
  if (refreshAttempt.error || !refreshedSession?.access_token || !refreshedSession.refresh_token) {
    return {
      valid: false,
      accessToken: null,
      refreshToken: null,
    };
  }

  return {
    valid: true,
    accessToken: refreshedSession.access_token,
    refreshToken: refreshedSession.refresh_token,
  };
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}

function redirectToHome(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(APP_HOME_PATH, request.url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPath = pathname === LOGIN_PATH;
  const snapshot = readAuthSessionFromCookies(request.cookies);
  const currentSeconds = nowInSeconds();
  const cookieOptions = { secure: process.env.NODE_ENV === "production" };

  if (hasLegacySessionToken(snapshot)) {
    const response = isLoginPath ? NextResponse.next() : redirectToLogin(request);
    clearAuthSessionCookies(response.cookies);
    return response;
  }

  if (!hasSessionTokens(snapshot)) {
    return isLoginPath ? NextResponse.next() : redirectToLogin(request);
  }

  if (isSessionWindowExpired(snapshot, currentSeconds)) {
    const response = isLoginPath ? NextResponse.next() : redirectToLogin(request);
    clearAuthSessionCookies(response.cookies);
    return response;
  }

  const sessionValidation = await validateOrRefreshSession(snapshot);
  if (!sessionValidation.valid || !sessionValidation.accessToken || !sessionValidation.refreshToken) {
    const response = isLoginPath ? NextResponse.next() : redirectToLogin(request);
    clearAuthSessionCookies(response.cookies);
    return response;
  }

  if (isLoginPath) {
    const response = redirectToHome(request);

    const hasRefreshedTokens =
      snapshot.accessToken !== sessionValidation.accessToken ||
      snapshot.refreshToken !== sessionValidation.refreshToken;

    if (hasRefreshedTokens) {
      applyAuthSessionCookies(
        response.cookies,
        {
          accessToken: sessionValidation.accessToken,
          refreshToken: sessionValidation.refreshToken,
          issuedAt: snapshot.issuedAt ?? currentSeconds,
          lastSeenAt: currentSeconds,
          remember: snapshot.remember,
        },
        cookieOptions
      );
      return response;
    }

    if (shouldTouchLastSeen(snapshot, currentSeconds)) {
      applyLastSeenCookie(response.cookies, { lastSeenAt: currentSeconds, remember: snapshot.remember }, cookieOptions);
    }

    return response;
  }

  const response = NextResponse.next();

  const hasRefreshedTokens =
    snapshot.accessToken !== sessionValidation.accessToken ||
    snapshot.refreshToken !== sessionValidation.refreshToken;

  if (hasRefreshedTokens) {
    applyAuthSessionCookies(
      response.cookies,
      {
        accessToken: sessionValidation.accessToken,
        refreshToken: sessionValidation.refreshToken,
        issuedAt: snapshot.issuedAt ?? currentSeconds,
        lastSeenAt: currentSeconds,
        remember: snapshot.remember,
      },
      cookieOptions
    );
    return response;
  }

  if (shouldTouchLastSeen(snapshot, currentSeconds)) {
    applyLastSeenCookie(response.cookies, { lastSeenAt: currentSeconds, remember: snapshot.remember }, cookieOptions);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/approvisionnement/:path*",
    "/ventes/:path*",
    "/stock/:path*",
    "/historique-stock/:path*",
    "/catalogue/:path*",
  ],
};
