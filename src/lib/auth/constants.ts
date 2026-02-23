export const LOGIN_PATH = "/login";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const APP_HOME_PATH = "/";

export const LOGIN_NOTICE_QUERY_PARAM = "notice";
export const LOGIN_NOTICE_LOGOUT_SUCCESS = "logout_success";
export const LOGIN_NOTICE_SESSION_EXPIRED = "session_expired";

export const LEGACY_AUTH_SESSION_COOKIE = "playnovus_auth_token";
export const AUTH_ACCESS_TOKEN_COOKIE = "playnovus_auth_access_token";
export const AUTH_REFRESH_TOKEN_COOKIE = "playnovus_auth_refresh_token";
export const AUTH_ISSUED_AT_COOKIE = "playnovus_auth_issued_at";
export const AUTH_LAST_SEEN_COOKIE = "playnovus_auth_last_seen";
export const AUTH_REMEMBER_COOKIE = "playnovus_auth_remember";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_INACTIVITY_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_LAST_SEEN_TOUCH_INTERVAL_SECONDS = 60 * 5;

export const AUTH_STANDALONE_PATHS = [LOGIN_PATH, FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH] as const;

export function isAuthStandalonePath(pathname: string): boolean {
  return AUTH_STANDALONE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
