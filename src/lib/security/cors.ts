const DEFAULT_LOCAL_ALLOWED_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
];

function normalizeOrigin(rawOrigin: string): string | null {
  const trimmed = rawOrigin.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAllowedOrigins(): string[] {
  const configured = process.env.APP_ALLOWED_ORIGINS ?? "";
  const candidates = configured
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  const origins = candidates.length > 0 ? candidates : DEFAULT_LOCAL_ALLOWED_ORIGINS;
  return [...new Set(origins)];
}

export function isOriginAllowed(origin: string | null, allowedOrigins = resolveAllowedOrigins()): boolean {
  if (!origin) {
    // Requete same-origin (ou non CORS): on laisse passer, sans ouvrir d'origine externe.
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  return allowedOrigins.includes(normalizedOrigin);
}

export function buildCorsHeaders(input: {
  requestOrigin: string | null;
  allowedOrigins?: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
}): Headers {
  const allowMethods = input.allowMethods ?? ["GET", "OPTIONS"];
  const allowHeaders = input.allowHeaders ?? ["Content-Type", "Authorization"];
  const allowedOrigins = input.allowedOrigins ?? resolveAllowedOrigins();

  const headers = new Headers();
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", allowMethods.join(", "));
  headers.set("Access-Control-Allow-Headers", allowHeaders.join(", "));
  headers.set("Access-Control-Max-Age", "600");

  const normalizedOrigin = input.requestOrigin ? normalizeOrigin(input.requestOrigin) : null;
  if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
    headers.set("Access-Control-Allow-Origin", normalizedOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return headers;
}
