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
  if (parsed !== null) return String(parsed);

  if (typeof rawSaleNumber === "string" && rawSaleNumber.trim().length > 0) {
    const trimmed = rawSaleNumber.trim();
    return trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
  }

  if (typeof fallbackId === "number" && Number.isFinite(fallbackId) && fallbackId > 0) {
    return String(Math.trunc(fallbackId));
  }

  return "?";
}

export function formatSetReferenceDisplay(
  rawSetId: unknown,
  explicitDisplayRef?: string | null
): string {
  const displayRef = typeof explicitDisplayRef === "string" ? explicitDisplayRef.trim() : "";
  if (displayRef) return displayRef;

  if (typeof rawSetId !== "string") return "";

  const setId = rawSetId.trim();
  if (!setId) return "";

  const parts = setId
    .split("_")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length >= 2) {
    const head = parts[0];
    const allSame = parts.every((part) => part === head);
    if (allSame) return head;

    if (/^\d+$/.test(head)) return head;
  }

  return setId;
}
