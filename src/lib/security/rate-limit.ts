export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

type RateLimitBucket = {
  windowStart: number;
  count: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

declare global {
  // eslint-disable-next-line no-var
  var __playnovusRateLimitStoreV1: RateLimitStore | undefined;
}

function getStore(): RateLimitStore {
  if (!globalThis.__playnovusRateLimitStoreV1) {
    globalThis.__playnovusRateLimitStoreV1 = new Map<string, RateLimitBucket>();
  }
  return globalThis.__playnovusRateLimitStoreV1;
}

function cleanupExpiredBuckets(store: RateLimitStore, nowMs: number, windowMs: number): void {
  if (store.size < 2048) {
    return;
  }

  for (const [bucketKey, bucket] of store.entries()) {
    if (nowMs - bucket.windowStart >= windowMs) {
      store.delete(bucketKey);
    }
  }
}

export function enforceRateLimit(
  scope: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowMs = Math.max(1_000, Math.floor(windowMs));
  const normalizedScope = scope.trim();
  const normalizedKey = key.trim().length > 0 ? key.trim() : "anonymous";
  const bucketKey = `${normalizedScope}:${normalizedKey}`;

  const nowMs = Date.now();
  const store = getStore();
  cleanupExpiredBuckets(store, nowMs, safeWindowMs);

  const existing = store.get(bucketKey);

  if (!existing || nowMs - existing.windowStart >= safeWindowMs) {
    store.set(bucketKey, { windowStart: nowMs, count: 1 });

    return {
      allowed: true,
      limit: safeLimit,
      remaining: Math.max(0, safeLimit - 1),
      retryAfterSeconds: 0,
      resetAt: nowMs + safeWindowMs,
    };
  }

  if (existing.count >= safeLimit) {
    const remainingMs = Math.max(0, safeWindowMs - (nowMs - existing.windowStart));
    return {
      allowed: false,
      limit: safeLimit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      resetAt: existing.windowStart + safeWindowMs,
    };
  }

  existing.count += 1;
  store.set(bucketKey, existing);

  return {
    allowed: true,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - existing.count),
    retryAfterSeconds: 0,
    resetAt: existing.windowStart + safeWindowMs,
  };
}

export function formatRateLimitRetryAfter(retryAfterSeconds: number): string {
  const safeRetryAfter = Math.max(1, Math.floor(retryAfterSeconds));
  if (safeRetryAfter < 60) {
    return `${safeRetryAfter}s`;
  }

  const minutes = Math.ceil(safeRetryAfter / 60);
  return `${minutes} min`;
}
