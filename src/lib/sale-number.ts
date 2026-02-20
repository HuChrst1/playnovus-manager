export function parseBusinessSaleNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
  if (!/^\d+$/.test(withoutPrefix)) return null;

  const parsed = Number(withoutPrefix);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;

  return parsed;
}

export function formatBusinessSaleNumberDisplay(
  rawSaleNumber: unknown,
  fallbackId?: number | null
): string {
  const parsed = parseBusinessSaleNumber(rawSaleNumber);
  if (parsed !== null) return `#${parsed}`;

  if (typeof rawSaleNumber === "string" && rawSaleNumber.trim().length > 0) {
    return rawSaleNumber.trim();
  }

  if (typeof fallbackId === "number" && Number.isFinite(fallbackId) && fallbackId > 0) {
    return `#${Math.trunc(fallbackId)}`;
  }

  return "#?";
}
