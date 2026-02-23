import {
  AUTH_ACCESS_TOKEN_COOKIE,
  AUTH_ISSUED_AT_COOKIE,
  AUTH_LAST_SEEN_COOKIE,
  AUTH_REMEMBER_COOKIE,
  AUTH_REFRESH_TOKEN_COOKIE,
  LEGACY_AUTH_SESSION_COOKIE,
  SESSION_INACTIVITY_SECONDS,
  SESSION_LAST_SEEN_TOUCH_INTERVAL_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type CookieWriter = {
  set(options: {
    name: string;
    value: string;
    path: string;
    httpOnly: boolean;
    sameSite: "lax";
    secure: boolean;
    maxAge?: number;
  }): void;
  delete(name: string): void;
};

type SessionCookieOptions = {
  secure: boolean;
};

export type AuthSessionSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
  issuedAt: number | null;
  lastSeenAt: number | null;
  remember: boolean;
  legacyAccessToken: string | null;
};

type ApplySessionInput = {
  accessToken: string;
  refreshToken: string;
  issuedAt: number;
  lastSeenAt: number;
  remember: boolean;
};

type ApplyLastSeenInput = {
  lastSeenAt: number;
  remember: boolean;
};

function parseNumberCookie(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRememberCookie(value: string | null): boolean {
  return value === "1";
}

function getCookieMaxAge(remember: boolean): number | undefined {
  return remember ? SESSION_MAX_AGE_SECONDS : undefined;
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function readAuthSessionFromCookies(cookies: CookieReader): AuthSessionSnapshot {
  return {
    accessToken: cookies.get(AUTH_ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookies.get(AUTH_REFRESH_TOKEN_COOKIE)?.value ?? null,
    issuedAt: parseNumberCookie(cookies.get(AUTH_ISSUED_AT_COOKIE)?.value ?? null),
    lastSeenAt: parseNumberCookie(cookies.get(AUTH_LAST_SEEN_COOKIE)?.value ?? null),
    remember: parseRememberCookie(cookies.get(AUTH_REMEMBER_COOKIE)?.value ?? null),
    legacyAccessToken: cookies.get(LEGACY_AUTH_SESSION_COOKIE)?.value ?? null,
  };
}

export function hasLegacySessionToken(snapshot: AuthSessionSnapshot): boolean {
  return typeof snapshot.legacyAccessToken === "string" && snapshot.legacyAccessToken.length > 0;
}

export function hasSessionTokens(snapshot: AuthSessionSnapshot): boolean {
  return Boolean(snapshot.accessToken && snapshot.refreshToken);
}

export function isSessionWindowExpired(snapshot: AuthSessionSnapshot, currentSeconds: number): boolean {
  const lastActivity = snapshot.lastSeenAt ?? snapshot.issuedAt;

  if (!lastActivity) {
    return true;
  }

  if (currentSeconds - lastActivity > SESSION_INACTIVITY_SECONDS) {
    return true;
  }

  if (!snapshot.remember) {
    return false;
  }

  if (!snapshot.issuedAt) {
    return true;
  }

  return currentSeconds - snapshot.issuedAt > SESSION_MAX_AGE_SECONDS;
}

export function shouldTouchLastSeen(snapshot: AuthSessionSnapshot, currentSeconds: number): boolean {
  if (!snapshot.lastSeenAt) {
    return true;
  }

  return currentSeconds - snapshot.lastSeenAt >= SESSION_LAST_SEEN_TOUCH_INTERVAL_SECONDS;
}

export function applyAuthSessionCookies(
  cookies: CookieWriter,
  input: ApplySessionInput,
  options: SessionCookieOptions
): void {
  const maxAge = getCookieMaxAge(input.remember);

  cookies.set({
    name: AUTH_ACCESS_TOKEN_COOKIE,
    value: input.accessToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    maxAge,
  });
  cookies.set({
    name: AUTH_REFRESH_TOKEN_COOKIE,
    value: input.refreshToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    maxAge,
  });
  cookies.set({
    name: AUTH_ISSUED_AT_COOKIE,
    value: String(input.issuedAt),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    maxAge,
  });
  cookies.set({
    name: AUTH_LAST_SEEN_COOKIE,
    value: String(input.lastSeenAt),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    maxAge,
  });
  cookies.set({
    name: AUTH_REMEMBER_COOKIE,
    value: input.remember ? "1" : "0",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    maxAge,
  });
}

export function applyLastSeenCookie(
  cookies: CookieWriter,
  input: ApplyLastSeenInput,
  options: SessionCookieOptions
): void {
  const maxAge = getCookieMaxAge(input.remember);

  cookies.set({
    name: AUTH_LAST_SEEN_COOKIE,
    value: String(input.lastSeenAt),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    maxAge,
  });
}

export function clearAuthSessionCookies(cookies: CookieWriter): void {
  cookies.delete(LEGACY_AUTH_SESSION_COOKIE);
  cookies.delete(AUTH_ACCESS_TOKEN_COOKIE);
  cookies.delete(AUTH_REFRESH_TOKEN_COOKIE);
  cookies.delete(AUTH_ISSUED_AT_COOKIE);
  cookies.delete(AUTH_LAST_SEEN_COOKIE);
  cookies.delete(AUTH_REMEMBER_COOKIE);
}
